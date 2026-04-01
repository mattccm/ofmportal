import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  DEFAULT_TEMPLATES,
  EmailTemplateType,
  getAllTemplateConfigs,
  getTemplateConfig,
  renderTemplate,
  getSampleData,
} from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const updateTemplateSchema = z.object({
  type: z.enum([
    "WELCOME",
    "REQUEST_SENT",
    "UPLOAD_RECEIVED",
    "REQUEST_APPROVED",
    "REQUEST_REJECTED",
    "REMINDER_UPCOMING",
    "REMINDER_DUE_TODAY",
    "REMINDER_OVERDUE",
    "PASSWORD_RESET",
    "REVISION_REQUESTED",
  ]),
  subject: z.string().min(1, "Subject is required"),
  htmlContent: z.string().min(1, "HTML content is required"),
  textContent: z.string().optional(),
  isActive: z.boolean().optional(),
});

const testSendSchema = z.object({
  type: z.enum([
    "WELCOME",
    "REQUEST_SENT",
    "UPLOAD_RECEIVED",
    "REQUEST_APPROVED",
    "REQUEST_REJECTED",
    "REMINDER_UPCOMING",
    "REMINDER_DUE_TODAY",
    "REMINDER_OVERDUE",
    "PASSWORD_RESET",
    "REVISION_REQUESTED",
  ]),
  email: z.string().email("Valid email is required"),
});

const resetTemplateSchema = z.object({
  type: z.enum([
    "WELCOME",
    "REQUEST_SENT",
    "UPLOAD_RECEIVED",
    "REQUEST_APPROVED",
    "REQUEST_REJECTED",
    "REMINDER_UPCOMING",
    "REMINDER_DUE_TODAY",
    "REMINDER_OVERDUE",
    "PASSWORD_RESET",
    "REVISION_REQUESTED",
  ]),
});

// ============================================
// GET - Get all templates for agency
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get custom templates from database
    const customTemplates = await db.emailTemplate.findMany({
      where: {
        agencyId: session.user.agencyId,
      },
    });

    // Create a map of custom templates by type
    const customTemplateMap = new Map(
      customTemplates.map((t) => [t.type, t])
    );

    // Get all template configs and merge with custom templates
    const allConfigs = getAllTemplateConfigs();
    const templates = allConfigs.map((config) => {
      const customTemplate = customTemplateMap.get(config.type);

      if (customTemplate) {
        return {
          id: customTemplate.id,
          type: customTemplate.type,
          name: config.name,
          description: config.description,
          variables: config.variables,
          subject: customTemplate.subject,
          htmlContent: customTemplate.htmlContent,
          textContent: customTemplate.textContent,
          isCustom: customTemplate.isCustom,
          isActive: customTemplate.isActive,
          createdAt: customTemplate.createdAt,
          updatedAt: customTemplate.updatedAt,
        };
      }

      // Return default template
      return {
        id: null,
        type: config.type,
        name: config.name,
        description: config.description,
        variables: config.variables,
        subject: config.defaultSubject,
        htmlContent: config.defaultHtml,
        textContent: config.defaultText,
        isCustom: false,
        isActive: true,
        createdAt: null,
        updatedAt: null,
      };
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching email templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch email templates" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Update or create template
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = updateTemplateSchema.parse(body);

    const config = getTemplateConfig(validatedData.type as EmailTemplateType);

    // Upsert the template
    const template = await db.emailTemplate.upsert({
      where: {
        agencyId_type: {
          agencyId: session.user.agencyId,
          type: validatedData.type,
        },
      },
      update: {
        subject: validatedData.subject,
        htmlContent: validatedData.htmlContent,
        textContent: validatedData.textContent || null,
        isCustom: true,
        isActive: validatedData.isActive ?? true,
        updatedAt: new Date(),
      },
      create: {
        agencyId: session.user.agencyId,
        type: validatedData.type,
        name: config.name,
        description: config.description,
        subject: validatedData.subject,
        htmlContent: validatedData.htmlContent,
        textContent: validatedData.textContent || null,
        isCustom: true,
        isActive: validatedData.isActive ?? true,
      },
    });

    return NextResponse.json({
      id: template.id,
      type: template.type,
      name: config.name,
      description: config.description,
      variables: config.variables,
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
      isCustom: template.isCustom,
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating email template:", error);
    return NextResponse.json(
      { error: "Failed to update email template" },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Reset template to default
// ============================================

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = resetTemplateSchema.parse(body);

    // Delete the custom template if it exists
    await db.emailTemplate.deleteMany({
      where: {
        agencyId: session.user.agencyId,
        type: validatedData.type,
      },
    });

    // Return the default template
    const config = getTemplateConfig(validatedData.type as EmailTemplateType);

    return NextResponse.json({
      id: null,
      type: config.type,
      name: config.name,
      description: config.description,
      variables: config.variables,
      subject: config.defaultSubject,
      htmlContent: config.defaultHtml,
      textContent: config.defaultText,
      isCustom: false,
      isActive: true,
      createdAt: null,
      updatedAt: null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error resetting email template:", error);
    return NextResponse.json(
      { error: "Failed to reset email template" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Send test email
// ============================================

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = testSendSchema.parse(body);

    // Get the template (custom or default)
    const customTemplate = await db.emailTemplate.findUnique({
      where: {
        agencyId_type: {
          agencyId: session.user.agencyId,
          type: validatedData.type,
        },
      },
    });

    const config = getTemplateConfig(validatedData.type as EmailTemplateType);
    const subject = customTemplate?.subject || config.defaultSubject;
    const htmlContent = customTemplate?.htmlContent || config.defaultHtml;
    const textContent = customTemplate?.textContent || config.defaultText;

    // Get sample data for the template
    const sampleData = getSampleData(validatedData.type as EmailTemplateType);

    // Render the template with sample data
    const renderedSubject = renderTemplate(subject, sampleData);
    const renderedHtml = renderTemplate(htmlContent, sampleData);
    const renderedText = textContent
      ? renderTemplate(textContent, sampleData)
      : undefined;

    // Send the test email
    const result = await sendEmail({
      to: validatedData.email,
      subject: `[TEST] ${renderedSubject}`,
      html: renderedHtml,
      text: renderedText,
    });

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${validatedData.email}`,
      mock: result.mock || false,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error sending test email:", error);
    return NextResponse.json(
      { error: "Failed to send test email" },
      { status: 500 }
    );
  }
}
