import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webhooks = await db.webhook.findMany({
      where: { agencyId: session.user.agencyId },
      include: {
        _count: { select: { deliveries: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ webhooks });
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
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId || !session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins/owners can manage webhooks
    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, url, description, events } = createWebhookSchema.parse(body);

    // Generate a signing secret
    const secret = `whsec_${crypto.randomBytes(32).toString("hex")}`;

    const webhook = await db.webhook.create({
      data: {
        agencyId: session.user.agencyId,
        name,
        url,
        secret,
        description,
        events,
        createdById: session.user.id,
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
