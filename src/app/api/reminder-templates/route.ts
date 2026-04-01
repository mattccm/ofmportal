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
  description: z.string().optional().nullable(),
  tierType: z.enum(["UPCOMING", "DUE_TODAY", "OVERDUE"]),
  daysMin: z.number().int().min(0),
  daysMax: z.number().int().min(0).optional().nullable(),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional().nullable(),
  emailSubject: z.string().min(1, "Email subject is required"),
  emailBody: z.string().min(1, "Email body is required"),
  smsBody: z.string().optional().nullable(),
  tone: z.enum(["FRIENDLY", "NORMAL", "FIRM", "URGENT"]).default("NORMAL"),
  priority: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const updateTemplateSchema = createTemplateSchema.partial().extend({
  id: z.string(),
});

// ============================================
// GET - List all tiered reminder templates
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const tierType = searchParams.get("tierType");

    const where: {
      agencyId: string;
      isActive?: boolean;
      tierType?: "UPCOMING" | "DUE_TODAY" | "OVERDUE";
    } = {
      agencyId: session.user.agencyId,
    };

    if (!includeInactive) {
      where.isActive = true;
    }

    if (tierType && ["UPCOMING", "DUE_TODAY", "OVERDUE"].includes(tierType)) {
      where.tierType = tierType as "UPCOMING" | "DUE_TODAY" | "OVERDUE";
    }

    const templates = await db.reminderTemplate.findMany({
      where,
      orderBy: [{ tierType: "asc" }, { priority: "desc" }, { daysMin: "asc" }],
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
// POST - Create new tiered reminder template
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["OWNER", "ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = createTemplateSchema.parse(body);

    // Validate days range
    if (validatedData.daysMax !== null && validatedData.daysMax !== undefined) {
      if (validatedData.daysMax < validatedData.daysMin) {
        return NextResponse.json(
          { error: "Maximum days must be greater than or equal to minimum days" },
          { status: 400 }
        );
      }
    }

    // For DUE_TODAY, days should be 0
    if (validatedData.tierType === "DUE_TODAY") {
      validatedData.daysMin = 0;
      validatedData.daysMax = 0;
    }

    const template = await db.reminderTemplate.create({
      data: {
        agencyId: session.user.agencyId,
        name: validatedData.name,
        description: validatedData.description,
        tierType: validatedData.tierType,
        daysMin: validatedData.daysMin,
        daysMax: validatedData.daysMax,
        urgency: validatedData.urgency,
        emailSubject: validatedData.emailSubject,
        emailBody: validatedData.emailBody,
        smsBody: validatedData.smsBody,
        tone: validatedData.tone,
        priority: validatedData.priority,
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

    if (!["OWNER", "ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = updateTemplateSchema.parse(body);

    // Verify template belongs to agency
    const existingTemplate = await db.reminderTemplate.findFirst({
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

    // Validate days range if both are provided
    const daysMin = validatedData.daysMin ?? existingTemplate.daysMin;
    const daysMax = validatedData.daysMax ?? existingTemplate.daysMax;

    if (daysMax !== null && daysMax !== undefined && daysMax < daysMin) {
      return NextResponse.json(
        { error: "Maximum days must be greater than or equal to minimum days" },
        { status: 400 }
      );
    }

    const { id, ...updateData } = validatedData;

    const template = await db.reminderTemplate.update({
      where: { id },
      data: updateData,
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
    const existingTemplate = await db.reminderTemplate.findFirst({
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

    await db.reminderTemplate.delete({
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
