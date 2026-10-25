import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/access/server";
import { db } from "@/lib/db";
import { z } from "zod";
import crypto from "crypto";
import { WEBHOOK_EVENTS, type WebhookEventType } from "@/lib/webhooks";

const validEvents = Object.keys(WEBHOOK_EVENTS) as WebhookEventType[];

const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url().refine((u) => u.startsWith("https://"), {
    message: "Webhook URL must use HTTPS",
  }),
  description: z.string().max(500).optional(),
  events: z
    .array(z.enum(validEvents as [string, ...string[]]))
    .min(1, "At least one event is required"),
});

/**
 * GET /api/webhooks — List all webhooks for the agency
 */
export async function GET() {
  try {
    const gate = await requireAccess("settings.integrations");
    if (gate.error) return gate.error;
    const { access } = gate;

    const webhooks = await db.webhook.findMany({
      where: { agencyId: access.agencyId },
      include: {
        _count: { select: { deliveries: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Mask secrets: they are only shown once, at creation
    return NextResponse.json({
      webhooks: webhooks.map((w) => ({ ...w, secret: `${w.secret.slice(0, 10)}...` })),
    });
  } catch (error) {
    console.error("List webhooks error:", error);
    return NextResponse.json(
      { error: "Failed to list webhooks" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks — Create a new webhook
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireAccess("settings.integrations");
    if (gate.error) return gate.error;
    const { access } = gate;

    const body = await req.json();
    const { name, url, description, events } = createWebhookSchema.parse(body);

    // Generate a signing secret
    const secret = `whsec_${crypto.randomBytes(32).toString("hex")}`;

    const webhook = await db.webhook.create({
      data: {
        agencyId: access.agencyId,
        name,
        url,
        secret,
        description,
        events,
        createdById: access.userId,
      },
    });

    return NextResponse.json({
      webhook: {
        ...webhook,
        // Only show secret on creation
        secret,
      },
      message:
        "Webhook created. Save the signing secret — it won't be shown again.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Create webhook error:", error);
    return NextResponse.json(
      { error: "Failed to create webhook" },
      { status: 500 }
    );
  }
}
