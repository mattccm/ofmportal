import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { WEBHOOK_EVENTS, type WebhookEventType } from "@/lib/webhooks";

const validEvents = Object.keys(WEBHOOK_EVENTS) as WebhookEventType[];

const updateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), {
      message: "Webhook URL must use HTTPS",
    })
    .optional(),
  description: z.string().max(500).optional(),
  events: z
    .array(z.enum(validEvents as [string, ...string[]]))
    .min(1, "At least one event is required")
    .optional(),
  active: z.boolean().optional(),
});

/**
 * GET /api/webhooks/[id] — Get webhook details with recent deliveries
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webhook = await db.webhook.findFirst({
      where: { id, agencyId: session.user.agencyId },
      include: {
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 25,
          select: {
            id: true,
            eventType: true,
            status: true,
            httpStatus: true,
            error: true,
            duration: true,
            attempt: true,
            createdAt: true,
          },
        },
        _count: { select: { deliveries: true } },
      },
    });

    if (!webhook) {
      return NextResponse.json(
        { error: "Webhook not found" },
        { status: 404 }
      );
    }

    // Mask the secret
    return NextResponse.json({
      webhook: {
        ...webhook,
        secret: `${webhook.secret.slice(0, 10)}...`,
      },
    });
  } catch (error) {
    console.error("Get webhook error:", error);
    return NextResponse.json(
      { error: "Failed to get webhook" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/webhooks/[id] — Update a webhook
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify ownership
    const existing = await db.webhook.findFirst({
      where: { id, agencyId: session.user.agencyId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Webhook not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const data = updateWebhookSchema.parse(body);

    // If re-enabling, reset the fail count
    const updateData: Record<string, unknown> = { ...data };
    if (data.active === true && !existing.active) {
      updateData.failCount = 0;
    }

    const webhook = await db.webhook.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      webhook: {
        ...webhook,
        secret: `${webhook.secret.slice(0, 10)}...`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Update webhook error:", error);
    return NextResponse.json(
      { error: "Failed to update webhook" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/webhooks/[id] — Delete a webhook and all its delivery history
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify ownership
    const existing = await db.webhook.findFirst({
      where: { id, agencyId: session.user.agencyId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Webhook not found" },
        { status: 404 }
      );
    }

    // Cascade delete handles deliveries
    await db.webhook.delete({ where: { id } });

    return NextResponse.json({ message: "Webhook deleted" });
  } catch (error) {
    console.error("Delete webhook error:", error);
    return NextResponse.json(
      { error: "Failed to delete webhook" },
      { status: 500 }
    );
  }
}
