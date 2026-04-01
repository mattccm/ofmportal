import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendContentRequestEmail } from "@/lib/email";
import { sendContentRequestSms } from "@/lib/sms";
import { format } from "date-fns";

// Schema for individual request in batch
const batchRequestItemSchema = z.object({
  creatorId: z.string().min(1, "Creator ID is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  requirements: z
    .object({
      quantity: z.string().optional(),
      format: z.string().optional(),
      resolution: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  fields: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        value: z.string(),
        type: z.string(),
        required: z.boolean(),
      })
    )
    .optional(),
});

// Schema for batch creation request
const batchCreateSchema = z.object({
  templateId: z.string().optional().nullable(),
  requests: z.array(batchRequestItemSchema).min(1, "At least one request is required"),
  sendNotifications: z.boolean().default(true),
});

// Batch size limits for graceful handling
const MAX_BATCH_SIZE = 100;
const NOTIFICATION_BATCH_SIZE = 10;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = batchCreateSchema.parse(body);

    // Check batch size limit
    if (validatedData.requests.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        {
          error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} requests. Please split into smaller batches.`,
        },
        { status: 400 }
      );
    }

    // Collect all unique creator IDs
    const creatorIds = [...new Set(validatedData.requests.map((r) => r.creatorId))];

    // Verify all creators belong to this agency
    const creators = await db.creator.findMany({
      where: {
        id: { in: creatorIds },
        agencyId: session.user.agencyId,
      },
    });

    const creatorMap = new Map(creators.map((c) => [c.id, c]));

    // Validate all creator IDs exist
    const invalidCreatorIds = creatorIds.filter((id) => !creatorMap.has(id));
    if (invalidCreatorIds.length > 0) {
      return NextResponse.json(
        {
          error: `Some creators not found: ${invalidCreatorIds.join(", ")}`,
        },
        { status: 404 }
      );
    }

    // Get template if specified
    let template = null;
    if (validatedData.templateId) {
      template = await db.requestTemplate.findFirst({
        where: {
          id: validatedData.templateId,
          agencyId: session.user.agencyId,
        },
      });

      if (!template) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }
    }

    // Track results
    const results: {
      created: number;
      failed: number;
      errors: string[];
      requestIds: string[];
    } = {
      created: 0,
      failed: 0,
      errors: [],
      requestIds: [],
    };

    // Process requests in transaction for atomicity
    const createdRequests = await db.$transaction(async (tx) => {
      const requests = [];

      for (const requestData of validatedData.requests) {
        try {
          const creator = creatorMap.get(requestData.creatorId)!;

          // Create the content request
          const contentRequest = await tx.contentRequest.create({
            data: {
              agencyId: session.user.agencyId,
              creatorId: requestData.creatorId,
              templateId: validatedData.templateId || null,
              title: requestData.title,
              description: requestData.description || null,
              dueDate: requestData.dueDate ? new Date(requestData.dueDate) : null,
              urgency: requestData.urgency,
              requirements: JSON.parse(JSON.stringify(requestData.requirements || {})),
              fields: JSON.parse(JSON.stringify(requestData.fields || (template ? template.fields : []))),
              status: "PENDING",
            },
            include: {
              creator: true,
            },
          });

          requests.push(contentRequest);
          results.created++;
          results.requestIds.push(contentRequest.id);

          // Log activity
          await tx.activityLog.create({
            data: {
              userId: session.user.id,
              action: "request.created.batch",
              entityType: "ContentRequest",
              entityId: contentRequest.id,
              metadata: {
                title: requestData.title,
                creatorName: creator.name,
                batchCreation: true,
              },
            },
          });
        } catch (error) {
          results.failed++;
          results.errors.push(
            `Failed to create request for creator ${requestData.creatorId}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }

      return requests;
    });

    // Send notifications in batches (non-blocking)
    if (validatedData.sendNotifications && createdRequests.length > 0) {
      // Process notifications asynchronously
      sendBatchNotifications(
        createdRequests,
        session.user.agencyName || "Agency",
        NOTIFICATION_BATCH_SIZE
      ).catch((error) => {
        console.error("Failed to send some notifications:", error);
      });
    }

    return NextResponse.json(
      {
        success: results.failed === 0,
        created: results.created,
        failed: results.failed,
        errors: results.errors,
        requestIds: results.requestIds,
      },
      { status: results.created > 0 ? 201 : 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating batch requests:", error);
    return NextResponse.json(
      { error: "Failed to create batch requests" },
      { status: 500 }
    );
  }
}

// Helper function to send notifications in batches
async function sendBatchNotifications(
  requests: Array<{
    id: string;
    title: string;
    dueDate: Date | null;
    creator: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      preferredContact: string;
    };
  }>,
  agencyName: string,
  batchSize: number
) {
  const batches = [];
  for (let i = 0; i < requests.length; i += batchSize) {
    batches.push(requests.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    await Promise.allSettled(
      batch.map(async (request) => {
        const portalLink = `${process.env.APP_URL}/portal/${request.creator.id}/requests/${request.id}`;
        const dueDate = request.dueDate
          ? format(request.dueDate, "MMMM d, yyyy")
          : "No specific due date";

        // Send email
        try {
          await sendContentRequestEmail({
            to: request.creator.email,
            creatorName: request.creator.name,
            agencyName,
            requestTitle: request.title,
            dueDate,
            portalLink,
          });
        } catch (error) {
          console.error(`Failed to send email to ${request.creator.email}:`, error);
        }

        // Send SMS if preferred
        if (
          request.creator.phone &&
          (request.creator.preferredContact === "SMS" ||
            request.creator.preferredContact === "BOTH")
        ) {
          try {
            await sendContentRequestSms({
              to: request.creator.phone,
              creatorName: request.creator.name,
              requestTitle: request.title,
              portalLink,
            });
          } catch (error) {
            console.error(`Failed to send SMS to ${request.creator.phone}:`, error);
          }
        }
      })
    );

    // Small delay between batches to avoid rate limiting
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

// GET endpoint to check batch creation status (for future async implementation)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get("batchId");

    if (!batchId) {
      return NextResponse.json(
        { error: "Batch ID is required" },
        { status: 400 }
      );
    }

    // For now, return a placeholder - can be extended for async batch tracking
    return NextResponse.json({
      batchId,
      status: "completed",
      message: "Batch request creation is synchronous in the current implementation",
    });
  } catch (error) {
    console.error("Error checking batch status:", error);
    return NextResponse.json(
      { error: "Failed to check batch status" },
      { status: 500 }
    );
  }
}
