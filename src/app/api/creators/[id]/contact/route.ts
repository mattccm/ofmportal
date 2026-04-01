import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// CONTACT CREATOR API
// Send messages to creators via their preferred contact methods
// ============================================

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
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
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

    // Based on the method, send the actual message
    // In a production environment, this would integrate with actual messaging services
    switch (validatedData.method) {
      case "email":
        // In production: await sendEmail(contactValue, validatedData.subject, validatedData.message);
        console.log(`[EMAIL] To: ${contactValue}, Subject: ${validatedData.subject}`);
        break;

      case "sms":
        // In production: await sendSMS(contactValue, validatedData.message);
        console.log(`[SMS] To: ${contactValue}`);
        break;

      case "whatsapp":
        // In production: await sendWhatsApp(contactValue, validatedData.message);
        console.log(`[WHATSAPP] To: ${contactValue}`);
        break;

      case "telegram":
        // In production: await sendTelegram(contactValue, validatedData.message);
        console.log(`[TELEGRAM] To: ${contactValue}`);
        break;

      case "discord":
        // In production: await sendDiscordDM(contactValue, validatedData.message);
        console.log(`[DISCORD] To: ${contactValue}`);
        break;

      case "in_app":
        // Create an in-app notification for the creator
        // In production, this would create a notification record
        console.log(`[IN_APP] To creator: ${creator.id}`);
        break;

      case "phone":
        // Phone calls would typically be logged but initiated externally
        console.log(`[PHONE] Logged call to: ${contactValue}`);
        break;
    }

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
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
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
