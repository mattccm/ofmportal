import { NextRequest, NextResponse } from "next/server";
import { requireAccess, requestWhere, creatorWhere } from "@/lib/access/server";
import { db } from "@/lib/db";
import {
  bulkRequestSchema,
  generateOperationId,
  parseTokens,
  calculateStaggeredDates,
  chunkArray,
  createUndoWindow,
} from "@/lib/bulk-operations";
import { sendNewRequestEmail } from "@/lib/email";
import { expandQuantityFields, type TemplateField } from "@/lib/template-types";
import { scheduleRemindersForRequest } from "@/lib/auto-reminder-scheduler";
import { z } from "zod";

interface BulkRequestResult {
  creatorId: string;
  creatorName?: string;
  requestId?: string;
  success: boolean;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAccess("requests.create");
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const body = await req.json();
    const validatedData = bulkRequestSchema.parse(body);

    // Validate bulk limits
    if (validatedData.requests.length > 500) {
      return NextResponse.json(
        { error: "Maximum 500 requests allowed per bulk operation" },
        { status: 400 }
      );
    }

    const operationId = generateOperationId();
    const results: BulkRequestResult[] = [];
    const createdRequestIds: string[] = [];
    const undoExpiresAt = createUndoWindow(30);

    // Get all creators to validate and fetch details
    const creatorIds = [...new Set(validatedData.requests.map((r) => r.creatorId))];
    const creators = await db.creator.findMany({
      where: { AND: [creatorWhere(access), { id: { in: creatorIds } }] },
    });

    const creatorMap = new Map(creators.map((c) => [c.id, c]));

    // Get template details if specified
    let template = null;
    if (validatedData.templateId) {
      template = await db.requestTemplate.findFirst({
        where: {
          id: validatedData.templateId,
          agencyId: session.user.agencyId,
        },
      });
    }

    // Build template fields and requirements once (same mapping as New Request)
    let templateFields: unknown[] = [];
    let baseRequirements: Record<string, unknown> = {};
    if (template) {
      let raw: unknown = template.fields;
      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw);
        } catch {
          raw = [];
        }
      }
      const expanded = Array.isArray(raw) ? expandQuantityFields(raw as TemplateField[]) : [];
      templateFields = expanded.map((f) => ({
        id: f.id,
        label: f.label,
        value: f.defaultValue !== undefined ? String(f.defaultValue) : "",
        type: f.type,
        required: f.required,
        helpText: f.helpText,
        richContent: f.richContent,
        acceptedFileTypes: f.acceptedFileTypes,
        maxFileSize: f.maxFileSize,
        maxFiles: f.maxFiles,
        minFiles: f.minFiles,
      }));
      if (template.richContent) baseRequirements = { _richContent: template.richContent };
    }

    // Calculate staggered dates if enabled
    let staggeredDates: Date[] | null = null;
    if (validatedData.staggerDates?.enabled) {
      const startDate = validatedData.requests[0]?.dueDate
        ? new Date(validatedData.requests[0].dueDate)
        : new Date();
      staggeredDates = calculateStaggeredDates(
        startDate,
        validatedData.requests.length,
        validatedData.staggerDates.intervalDays
      );
    }

    // Process requests in chunks for better performance
    const chunks = chunkArray(validatedData.requests, 50);
    let globalIndex = 0;

    for (const chunk of chunks) {
      const createPromises = chunk.map(async (requestData) => {
        const currentIndex = globalIndex++;
        const creator = creatorMap.get(requestData.creatorId);

        if (!creator) {
          return {
            creatorId: requestData.creatorId,
            success: false,
            error: "Creator not found",
          };
        }

        try {
          // Apply personalization tokens if enabled
          let title = requestData.title;
          let description = requestData.description || "";

          if (validatedData.personalization?.enabled) {
            const tokenData = {
              creator: {
                name: creator.name,
                // A hidden email never reaches a title through a token
                email: access.has("creatorInfo.email") ? creator.email : "",
              },
              due_date: requestData.dueDate || "",
              ...validatedData.personalization.tokens,
            };
            title = parseTokens(title, tokenData);
            description = parseTokens(description, tokenData);
          }

          // Calculate due date (staggered or individual)
          let dueDate: Date | null = null;
          if (staggeredDates && staggeredDates[currentIndex]) {
            dueDate = staggeredDates[currentIndex];
          } else if (requestData.dueDate) {
            dueDate = new Date(requestData.dueDate);
          } else if (template?.defaultDueDays) {
            dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + template.defaultDueDays);
          }

          // Create the request
          const request = await db.contentRequest.create({
            data: {
              title,
              description,
              dueDate,
              urgency: requestData.urgency || template?.defaultUrgency || "NORMAL",
              status: "PENDING",
              agencyId: session.user.agencyId,
              creatorId: creator.id,
              templateId: validatedData.templateId || null,
              fields: JSON.parse(JSON.stringify(templateFields)),
              requirements: JSON.parse(JSON.stringify(baseRequirements)),
            },
          });

          createdRequestIds.push(request.id);

          if (dueDate) {
            try {
              await scheduleRemindersForRequest(request.id);
            } catch (e) {
              console.error("Failed to schedule auto-reminders:", e);
            }
          }

          return {
            creatorId: creator.id,
            creatorName: creator.name,
            requestId: request.id,
            success: true,
          };
        } catch (error) {
          return {
            creatorId: requestData.creatorId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });

      const chunkResults = await Promise.all(createPromises);
      results.push(...chunkResults);
    }

    // Log the bulk operation
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "request.bulkCreate",
        entityType: "ContentRequest",
        entityId: operationId,
        metadata: {
          operationId,
          totalRequests: validatedData.requests.length,
          successCount: results.filter((r) => r.success).length,
          failedCount: results.filter((r) => !r.success).length,
          createdRequestIds,
          templateId: validatedData.templateId,
          sendNotifications: validatedData.sendNotifications,
          staggerDates: validatedData.staggerDates,
          undoExpiresAt: undoExpiresAt.toISOString(),
        },
      },
    });

    // Send notifications if enabled (async, don't block response)
    if (validatedData.sendNotifications) {
      const successfulRequests = results.filter((r) => r.success && r.requestId);

      // Fire and forget notifications
      Promise.all(
        successfulRequests.map(async (result) => {
          const creator = creatorMap.get(result.creatorId);
          if (!creator) return;

          try {
            await sendNewRequestEmail({
              to: creator.email,
              creatorName: creator.name,
              requestTitle: validatedData.requests.find(
                (r) => r.creatorId === result.creatorId
              )?.title || "New Content Request",
              portalLink: `${process.env.APP_URL}/portal/${creator.id}/requests/${result.requestId}`,
            });
          } catch (error) {
            console.error(`Failed to send notification to ${creator.email}:`, error);
          }
        })
      ).catch(console.error);
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failedCount === 0,
      operationId,
      created: successCount,
      failed: failedCount,
      total: validatedData.requests.length,
      results,
      createdRequestIds,
      canUndo: successCount > 0,
      undoExpiresAt: undoExpiresAt.toISOString(),
      errors: results.filter((r) => !r.success).map((r) => r.error),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating bulk requests:", error);
    return NextResponse.json(
      { error: "Failed to create bulk requests" },
      { status: 500 }
    );
  }
}

// Undo bulk request creation
export async function DELETE(req: NextRequest) {
  try {
    const gate = await requireAccess("requests.create");
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const { operationId, requestIds } = await req.json();

    if (!operationId || !requestIds || !Array.isArray(requestIds)) {
      return NextResponse.json(
        { error: "Operation ID and request IDs are required" },
        { status: 400 }
      );
    }

    // Verify the operation exists and is within undo window
    const operationLog = await db.activityLog.findFirst({
      where: {
        userId: session.user.id,
        entityId: operationId,
        action: "request.bulkCreate",
      },
    });

    if (!operationLog) {
      return NextResponse.json(
        { error: "Operation not found" },
        { status: 404 }
      );
    }

    const metadata = operationLog.metadata as { undoExpiresAt?: string };
    if (metadata.undoExpiresAt && new Date() > new Date(metadata.undoExpiresAt)) {
      return NextResponse.json(
        { error: "Undo window has expired" },
        { status: 400 }
      );
    }

    // Delete the created requests
    const deleteResult = await db.contentRequest.deleteMany({
      where: {
        ...requestWhere(access),
        id: { in: requestIds },
        status: "PENDING", // Only delete pending requests
      },
    });

    // Log the undo operation
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "request.bulkCreateUndo",
        entityType: "ContentRequest",
        entityId: operationId,
        metadata: {
          originalOperationId: operationId,
          deletedCount: deleteResult.count,
          requestIds,
        },
      },
    });

    return NextResponse.json({
      success: true,
      deleted: deleteResult.count,
      message: `Rolled back ${deleteResult.count} request(s)`,
    });
  } catch (error) {
    console.error("Error undoing bulk request creation:", error);
    return NextResponse.json(
      { error: "Failed to undo bulk operation" },
      { status: 500 }
    );
  }
}
