import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  daysBefore: z.array(z.number().min(0)).min(1, "At least one reminder day is required"),
  escalateDaysOverdue: z.number().min(1).optional().nullable(),
  sendEmail: z.boolean().default(true),
  sendSms: z.boolean().default(false),
  emailSubject: z.string().optional().nullable(),
  emailBody: z.string().optional().nullable(),
  smsBody: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

const updateTemplateSchema = createTemplateSchema.partial().extend({
  id: z.string(),
});

// ============================================
// GET - List all reminder templates for agency
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const where: { agencyId: string; isActive?: boolean } = {
      agencyId: session.user.agencyId,
    };

    if (!includeInactive) {
      where.isActive = true;
    }

    const templates = await db.reminderConfig.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching reminder templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch reminder templates" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create new reminder template
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role
    if (!["OWNER", "ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = createTemplateSchema.parse(body);

    // Validate that email template is provided if sendEmail is true
    if (validatedData.sendEmail && (!validatedData.emailSubject || !validatedData.emailBody)) {
      return NextResponse.json(
        { error: "Email subject and body are required when email reminders are enabled" },
        { status: 400 }
      );
    }

    // Validate that SMS template is provided if sendSms is true
    if (validatedData.sendSms && !validatedData.smsBody) {
      return NextResponse.json(
        { error: "SMS body is required when SMS reminders are enabled" },
        { status: 400 }
      );
    }

    const template = await db.reminderConfig.create({
      data: {
        agencyId: session.user.agencyId,
        name: validatedData.name,
        daysBefore: validatedData.daysBefore,
        escalateDaysOverdue: validatedData.escalateDaysOverdue,
        sendEmail: validatedData.sendEmail,
        sendSms: validatedData.sendSms,
        emailSubject: validatedData.emailSubject,
        emailBody: validatedData.emailBody,
        smsBody: validatedData.smsBody,
        isActive: validatedData.isActive,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating reminder template:", error);
    return NextResponse.json(
      { error: "Failed to create reminder template" },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Update reminder template
// ============================================

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role
    if (!["OWNER", "ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = updateTemplateSchema.parse(body);

    // Verify template belongs to agency
    const existingTemplate = await db.reminderConfig.findFirst({
      where: {
        id: validatedData.id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Merge with existing data for partial updates
    const sendEmail = validatedData.sendEmail ?? existingTemplate.sendEmail;
    const sendSms = validatedData.sendSms ?? existingTemplate.sendSms;
    const emailSubject = validatedData.emailSubject ?? existingTemplate.emailSubject;
    const emailBody = validatedData.emailBody ?? existingTemplate.emailBody;
    const smsBody = validatedData.smsBody ?? existingTemplate.smsBody;

    // Validate that email template is provided if sendEmail is true
    if (sendEmail && (!emailSubject || !emailBody)) {
      return NextResponse.json(
        { error: "Email subject and body are required when email reminders are enabled" },
        { status: 400 }
      );
    }

    // Validate that SMS template is provided if sendSms is true
    if (sendSms && !smsBody) {
      return NextResponse.json(
        { error: "SMS body is required when SMS reminders are enabled" },
        { status: 400 }
      );
    }

    const template = await db.reminderConfig.update({
      where: { id: validatedData.id },
      data: {
        name: validatedData.name,
        daysBefore: validatedData.daysBefore,
        escalateDaysOverdue: validatedData.escalateDaysOverdue,
        sendEmail: validatedData.sendEmail,
        sendSms: validatedData.sendSms,
        emailSubject: validatedData.emailSubject,
        emailBody: validatedData.emailBody,
        smsBody: validatedData.smsBody,
        isActive: validatedData.isActive,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating reminder template:", error);
    return NextResponse.json(
      { error: "Failed to update reminder template" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Delete reminder template
// ============================================

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    // Verify template belongs to agency
    const existingTemplate = await db.reminderConfig.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    await db.reminderConfig.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Template deleted successfully" });
  } catch (error) {
    console.error("Error deleting reminder template:", error);
    return NextResponse.json(
      { error: "Failed to delete reminder template" },
      { status: 500 }
    );
  }
}
