import { db } from "./db";
import crypto from "crypto";

// WEBHOOK EVENT TYPES

export const WEBHOOK_EVENTS = {
  // Upload events
  "upload.completed": "Fired when a creator finishes uploading a file",
  "upload.approved": "Fired when an upload is approved",
  "upload.rejected": "Fired when an upload is rejected",

  // Request events
  "request.created": "Fired when a new content request is created",
  "request.submitted": "Fired when a creator submits content for a request",
  "request.approved": "Fired when a request is fully approved",

  // Creator events
  "creator.joined": "Fired when a creator accepts their invite",
  "creator.uploaded": "Fired when a creator uploads any file",

  // Comment events
  "comment.created": "Fired when a new comment is added",
} as const;

export type WebhookEventType = keyof typeof WEBHOOK_EVENTS;

// PAYLOAD SIGNING

function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

// EVENT DISPATCHER

interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Dispatch a webhook event to all active webhooks subscribed to this event type.
 * Deliveries are non-blocking — failures don't affect the caller.
 */
export async function dispatchWebhookEvent(
  agencyId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  try {
    // Find all active webhooks for this agency that subscribe to this event
    const webhooks = await db.webhook.findMany({
      where: {
        agencyId,
        active: true,
        events: { has: eventType },
      },
    });

    if (webhooks.length === 0) return;

    const payload: WebhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data,
    };

    const payloadString = JSON.stringify(payload);

    // Deliver to each webhook (non-blocking)
    await Promise.allSettled(
      webhooks.map((webhook) => deliverWebhook(webhook, eventType, payloadString))
    );
  } catch (error) {
    // Webhook dispatch should never break the main flow
    console.error("[Webhooks] Dispatch error:", error);
  }
}

/**
 * Deliver a webhook event to a single endpoint (first attempt — creates the delivery row)
 */
async function deliverWebhook(
  webhook: { id: string; url: string; secret: string; failCount: number },
  eventType: string,
  payloadString: string
): Promise<void> {
  // Create delivery record — one row tracks this logical delivery across retries
  const delivery = await db.webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      eventType,
      payload: JSON.parse(payloadString),
      status: "PENDING",
    },
  });

  await attemptDelivery(
    webhook,
    { id: delivery.id, attempt: delivery.attempt, maxRetries: delivery.maxRetries },
    eventType,
    payloadString
  );
}

/**
 * Attempt delivery for an existing delivery row and record the result on that row
 */
async function attemptDelivery(
  webhook: { id: string; url: string; secret: string; failCount: number },
  delivery: { id: string; attempt: number; maxRetries: number },
  eventType: string,
  payloadString: string
): Promise<boolean> {
  const signature = signPayload(payloadString, webhook.secret);
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": `sha256=${signature}`,
        "X-Webhook-Event": eventType,
        "X-Webhook-Delivery": delivery.id,
        "User-Agent": "UploadPortal-Webhook/1.0",
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const duration = Date.now() - startTime;
    const responseBody = await response.text().catch(() => "");

    if (response.ok) {
      // Success — reset consecutive-failure count
      await db.$transaction([
        db.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "SUCCESS",
            httpStatus: response.status,
            responseBody: responseBody.substring(0, 1000),
            duration,
            nextRetry: null,
          },
        }),
        db.webhook.update({
          where: { id: webhook.id },
          data: {
            failCount: 0,
            lastDeliveryAt: new Date(),
            lastDeliveryStatus: response.status,
          },
        }),
      ]);
      return true;
    }

    // HTTP error
    await handleDeliveryFailure(
      delivery,
      webhook,
      response.status,
      `HTTP ${response.status}: ${responseBody.substring(0, 500)}`,
      duration
    );
    return false;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    await handleDeliveryFailure(delivery, webhook, null, errorMsg, duration);
    return false;
  }
}

/**
 * Handle a failed webhook delivery — increment fail count, schedule retry, auto-disable
 */
async function handleDeliveryFailure(
  delivery: { id: string; attempt: number; maxRetries: number },
  webhook: { id: string; failCount: number },
  httpStatus: number | null,
  error: string,
  duration: number
): Promise<void> {
  const newFailCount = webhook.failCount + 1;
  const shouldDisable = newFailCount >= 10; // Auto-disable after 10 consecutive failures

  // Calculate retry delay with exponential backoff (1min, 5min, 30min)
  const retryDelays = [60, 300, 1800]; // seconds
  const shouldRetry = delivery.attempt < delivery.maxRetries && !shouldDisable;

  const nextRetry = shouldRetry
    ? new Date(Date.now() + (retryDelays[delivery.attempt - 1] || 1800) * 1000)
    : null;

  await db.$transaction([
    db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: shouldRetry ? "RETRYING" : "FAILED",
        httpStatus,
        error: error.substring(0, 1000),
        duration,
        nextRetry,
      },
    }),
    db.webhook.update({
      where: { id: webhook.id },
      data: {
        failCount: newFailCount,
        active: shouldDisable ? false : undefined,
        lastDeliveryAt: new Date(),
        lastDeliveryStatus: httpStatus,
      },
    }),
  ]);
}

// Well above the 10s fetch timeout and the function max duration
const STRANDED_DELIVERY_MS = 15 * 60 * 1000;

/**
 * Retry failed webhook deliveries (called from cron)
 */
export async function retryFailedDeliveries(): Promise<{ retried: number; succeeded: number; failed: number }> {
  const results = { retried: 0, succeeded: 0, failed: 0 };

  const now = new Date();
  // Callers dispatch fire-and-forget, so a serverless freeze can strand a
  // delivery as PENDING. Recover those well after any real in-flight attempt.
  const strandedCutoff = new Date(now.getTime() - STRANDED_DELIVERY_MS);

  const pendingRetries = await db.webhookDelivery.findMany({
    where: {
      OR: [
        { status: "RETRYING", nextRetry: { lte: now } },
        // First attempt never finished
        { status: "PENDING", nextRetry: null, createdAt: { lt: strandedCutoff } },
        // Retry claim whose lease expired without finishing
        { status: "PENDING", nextRetry: { lte: now } },
      ],
    },
    include: {
      webhook: {
        select: { id: true, url: true, secret: true, failCount: true, active: true },
      },
    },
    take: 20, // Process 20 retries per run
    orderBy: { createdAt: "asc" },
  });

  for (const delivery of pendingRetries) {
    if (!delivery.webhook.active) {
      await db.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: "FAILED", error: "Webhook disabled" },
      });
      results.failed++;
      continue;
    }

    // Claim the row atomically so overlapping runs can't double-send.
    // nextRetry acts as a lease: if this attempt is killed mid-fetch the row
    // is picked up again once the lease expires.
    const claimed = await db.webhookDelivery.updateMany({
      where: { id: delivery.id, status: delivery.status, attempt: delivery.attempt },
      data: {
        status: "PENDING",
        attempt: { increment: 1 },
        nextRetry: new Date(Date.now() + STRANDED_DELIVERY_MS),
      },
    });
    if (claimed.count === 0) continue;

    results.retried++;

    const succeeded = await attemptDelivery(
      delivery.webhook,
      {
        id: delivery.id,
        attempt: delivery.attempt + 1,
        maxRetries: delivery.maxRetries,
      },
      delivery.eventType,
      JSON.stringify(delivery.payload)
    );

    if (succeeded) results.succeeded++;
    else results.failed++;
  }

  return results;
}
