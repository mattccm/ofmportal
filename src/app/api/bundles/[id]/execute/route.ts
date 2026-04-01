import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendContentRequestEmail } from "@/lib/email";
import { sendContentRequestSms } from "@/lib/sms";
import { format, addDays } from "date-fns";
import type { BundleExecutionResult } from "@/types/request-bundles";

// ============================================
// VALIDATION SCHEMA
// ============================================

const executeSchema = z.object({
  creatorIds: z.array(z.string()).min(1, "At least one creator is required"),
  sendNotifications: z.boolean().default(true),
  startDate: z.string().optional(), // ISO date string
  overrides: z
    .array(
      z.object({
        templateId: z.string(),
        dueDate: z.string().optional(),
        urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
        sendNotification: z.boolean().optional(),
      })
    )
    .optional(),
});

// ============================================
// POST - Execute bundle
// ============================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: bundleId } = await params;
    const body = await req.json();
    const validatedData = executeSchema.parse(body);

    // Fetch bundle
    const bundle = await db.requestBundle.findFirst({
      where: {
        id: bundleId,
        agencyId: session.user.agencyId,
      },
    });

    if (!bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    const templateIds = bundle.templateIds as string[];
    const templateConfigs = bundle.templateConfigs as {
      templateId: string;
      defaultDueDays?: number;
      defaultUrgency?: string;
      autoAssign?: boolean;
      staggerDays?: number;
    }[];

    // Verify creators belong to this agency
    const creators = await db.creator.findMany({
      where: {
        id: { in: validatedData.creatorIds },
        agencyId: session.user.agencyId,
      },
    });

    if (creators.length !== validatedData.creatorIds.length) {
      return NextResponse.json(
        { error: "One or more creators not found or unauthorized" },
        { status: 400 }
      );
    }

    // Fetch templates
    const templates = await db.requestTemplate.findMany({
      where: {
        id: { in: templateIds },
        agencyId: session.user.agencyId,
      },
    });

    const templateMap = new Map(templates.map((t) => [t.id, t]));

    // Build override map for quick lookup
    const overrideMap = new Map(
      (validatedData.overrides || []).map((o) => [o.templateId, o])
    );

    // Calculate base date
    const startDate = validatedData.startDate
      ? new Date(validatedData.startDate)
      : new Date();

    // Results tracking
    const result: BundleExecutionResult = {
      bundleId,
      bundleName: bundle.name,
      createdRequests: [],
      failedRequests: [],
      totalCreated: 0,
      totalFailed: 0,
    };

    // Create requests for each creator and template
    for (const creator of creators) {
      for (const templateId of templateIds) {
        try {
          const template = templateMap.get(templateId);
          if (!template) {
            result.failedRequests.push({
              templateId,
              creatorId: creator.id,
              error: `Template ${templateId} not found`,
            });
            result.totalFailed++;
            continue;
          }

          // Get config and override
          const config = templateConfigs.find((c) => c.templateId === templateId) || {} as {
            templateId?: string;
            staggerDays?: number;
            defaultDueDays?: number;
            defaultUrgency?: string;
          };
          const override = overrideMap.get(templateId);

          // Calculate due date
          const staggerDays = config.staggerDays || 0;
          const dueDays = config.defaultDueDays || template.defaultDueDays;
          const dueDate = override?.dueDate
            ? new Date(override.dueDate)
            : addDays(addDays(startDate, staggerDays), dueDays);

          // Determine urgency
          const urgency = (
            override?.urgency ||
            config.defaultUrgency ||
            template.defaultUrgency
          ) as "LOW" | "NORMAL" | "HIGH" | "URGENT";

          // Parse template fields
          let fields: unknown[] = [];
          try {
            if (typeof template.fields === "string") {
              fields = JSON.parse(template.fields);
            } else if (Array.isArray(template.fields)) {
              fields = template.fields;
            }
          } catch {
            fields = [];
          }

          // Create request
          const contentRequest = await db.contentRequest.create({
            data: {
              agencyId: session.user.agencyId,
              creatorId: creator.id,
              templateId: template.id,
              title: template.name,
              description: template.description || null,
              dueDate,
              urgency,
              requirements: {},
              fields: (fields as Array<{ id?: string; label?: string; type?: string; required?: boolean }>).map((f) => ({
                id: f.id,
                label: f.label,
                value: "",
                type: f.type,
                required: f.required,
              })),
              status: "PENDING",
            },
          });

          // Track success
          result.createdRequests.push({
            requestId: contentRequest.id,
            templateId: template.id,
            templateName: template.name,
            creatorId: creator.id,
            creatorName: creator.name,
            title: contentRequest.title,
            dueDate: format(dueDate, "MMM d, yyyy"),
            status: contentRequest.status,
          });
          result.totalCreated++;

          // Send notification if enabled
          const shouldNotify =
            override?.sendNotification ?? validatedData.sendNotifications;

          if (shouldNotify) {
            const portalLink = `${process.env.APP_URL}/portal/${creator.id}/requests/${contentRequest.id}`;
            const dueDateFormatted = format(dueDate, "MMMM d, yyyy");

            // Send email
            try {
              await sendContentRequestEmail({
                to: creator.email,
                creatorName: creator.name,
                agencyName: session.user.agencyName,
                requestTitle: template.name,
                dueDate: dueDateFormatted,
                portalLink,
              });
            } catch (emailError) {
              console.error("Failed to send request email:", emailError);
            }

            // Send SMS if preferred
            if (
              creator.phone &&
              (creator.preferredContact === "SMS" ||
                creator.preferredContact === "BOTH")
            ) {
              try {
                await sendContentRequestSms({
                  to: creator.phone,
                  creatorName: creator.name,
                  requestTitle: template.name,
                  portalLink,
                });
              } catch (smsError) {
                console.error("Failed to send request SMS:", smsError);
              }
            }
          }
        } catch (error) {
          console.error(
            `Failed to create request for template ${templateId} and creator ${creator.id}:`,
            error
          );
          result.failedRequests.push({
            templateId,
            creatorId: creator.id,
            error:
              error instanceof Error
                ? error.message
                : "Unknown error occurred",
          });
          result.totalFailed++;
        }
      }
    }

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "bundle.executed",
        entityType: "RequestBundle",
        entityId: bundleId,
        metadata: {
          bundleName: bundle.name,
          creatorCount: creators.length,
          requestsCreated: result.totalCreated,
          requestsFailed: result.totalFailed,
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error executing bundle:", error);
    return NextResponse.json(
      { error: "Failed to execute bundle" },
      { status: 500 }
    );
  }
}
