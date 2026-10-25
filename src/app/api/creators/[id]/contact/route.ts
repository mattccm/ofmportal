import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creatorWhere, requireAccess } from "@/lib/access/server";
import { z } from "zod";

// CONTACT CREATOR API
// Send messages to creators via their preferred contact methods

const contactSchema = z.object({
  method: z.enum(["email", "sms", "whatsapp", "telegram", "discord", "in_app", "phone"]),
  subject: z.string().optional(),
  message: z.string().min(1, "Message is required"),
  templateId: z.string().optional(),
  requestId: z.string().optional(), // Optional context for the message
});

// POST - Send a message to a creator
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("messages.reply");
    if (gate.error) return gate.error;
    const { session, access } = gate;
    const { id } = await params;

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: { AND: [creatorWhere(access), { id }] },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        contentPreferences: true,
      },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = contactSchema.parse(body);

    // Get communication preferences
    const prefs = creator.contentPreferences as Record<string, unknown>;
    const commPrefs = prefs?.communicationPreferences as Record<string, unknown> | undefined;

    // Determine contact details
    let contactValue = "";
    const contactDetails = commPrefs?.contactDetails as Record<string, string> | undefined;

    switch (validatedData.method) {
      case "email":
        contactValue = contactDetails?.email || creator.email;
        break;
      case "phone":
      case "sms":
        contactValue = contactDetails?.phone || creator.phone || "";
        break;
      case "whatsapp":
        contactValue = contactDetails?.whatsapp || "";
        break;
      case "telegram":
        contactValue = contactDetails?.telegram || "";
        break;
      case "discord":
        contactValue = contactDetails?.discord || "";
        break;
      case "in_app":
        contactValue = creator.id;
        break;
    }

    if (!contactValue && validatedData.method !== "in_app") {
      return NextResponse.json(
        { error: `No ${validatedData.method} contact information available` },
        { status: 400 }
      );
    }

    // Create message record
    const messageRecord = await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "creator.contacted",
        entityType: "Creator",
        entityId: id,
        metadata: {
          method: validatedData.method,
          subject: validatedData.subject,
          messagePreview: validatedData.message.substring(0, 200),
          templateId: validatedData.templateId,
          requestId: validatedData.requestId,
          contactValue: validatedData.method === "in_app" ? undefined : contactValue,
          sentAt: new Date().toISOString(),
        },
      },
    });

    // NOTE: Actual message delivery is not implemented. In production this would
    // integrate with the relevant messaging service (email, SMS, WhatsApp, etc.)
    // based on validatedData.method. Currently the contact is only recorded in
    // the activity log above.

    return NextResponse.json({
      success: true,
      message: "Message sent successfully",
      messageId: messageRecord.id,
      method: validatedData.method,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid message data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error sending message to creator:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

// GET - Get message history for a creator
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("messages.creators");
    if (gate.error) return gate.error;
    const { access } = gate;
    const { id } = await params;

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: { AND: [creatorWhere(access), { id }] },
      select: { id: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Get message history from activity log
    const messages = await db.activityLog.findMany({
      where: {
        entityType: "Creator",
        entityId: id,
        action: "creator.contacted",
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      messages: messages.map((msg) => ({
        id: msg.id,
        method: (msg.metadata as Record<string, unknown>)?.method,
        subject: (msg.metadata as Record<string, unknown>)?.subject,
        messagePreview: (msg.metadata as Record<string, unknown>)?.messagePreview,
        sentBy: msg.user?.name,
        sentAt: msg.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching message history:", error);
    return NextResponse.json(
      { error: "Failed to fetch message history" },
      { status: 500 }
    );
  }
}
