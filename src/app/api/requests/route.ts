import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendContentRequestEmail } from "@/lib/email";
import { sendContentRequestSms } from "@/lib/sms";
import { format } from "date-fns";
import {
  parsePaginationParams,
  createPaginatedResponse,
} from "@/lib/pagination";
import { invalidateCache } from "@/lib/cache";
import {
  scheduleRemindersForRequest,
  formatReminderSchedule,
} from "@/lib/auto-reminder-scheduler";

const createRequestSchema = z.object({
  creatorId: z.string().min(1, "Creator is required"),
  templateId: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  requirements: z.object({
    quantity: z.string().optional(),
    format: z.string().optional(),
    resolution: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
  fields: z.array(z.object({
    id: z.string(),
    label: z.string(),
    value: z.string(),
    type: z.string(),
    required: z.boolean(),
  })).optional(),
  sendNotification: z.boolean().default(true),
  saveAsDraft: z.boolean().default(false),
});

// Optimized select for list view (reduced payload)
const requestListSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  urgency: true,
  dueDate: true,
  createdAt: true,
  viewedByCreator: true,
  creator: {
    select: { id: true, name: true, email: true },
  },
  template: {
    select: { id: true, name: true },
  },
  _count: {
    select: { uploads: true, comments: true },
  },
};

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const pagination = parsePaginationParams(searchParams);

    // Optional filters
    const status = searchParams.get("status");
    const creatorId = searchParams.get("creatorId");
    const urgency = searchParams.get("urgency");
    const search = searchParams.get("search")?.toLowerCase();
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Build where clause
    const where: Record<string, unknown> = { agencyId: session.user.agencyId };

    if (status && status !== "all") {
      // Support multiple statuses separated by comma
      const statuses = status.split(",");
      where.status = statuses.length > 1 ? { in: statuses } : statuses[0];
    }

    if (creatorId && creatorId !== "all") {
      where.creatorId = creatorId;
    }

    if (urgency && urgency !== "all") {
      where.urgency = urgency;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { creator: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Build orderBy with priority-aware sorting
    let orderBy: Record<string, string> | Record<string, string>[] = { createdAt: "desc" };

    if (sortBy === "priority") {
      // Sort by urgency (URGENT first) then by due date
      orderBy = [
        {
          urgency: "desc", // URGENT > HIGH > NORMAL > LOW (alphabetically reversed)
        },
        { dueDate: "asc" }, // Closest due dates first
        { createdAt: "desc" },
      ];
    } else if (sortBy === "dueDate") {
      orderBy = [{ dueDate: sortOrder === "asc" ? "asc" : "desc" }, { createdAt: "desc" }];
    } else {
      const validSortFields = ["createdAt", "title", "status"];
      const orderByField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
      orderBy = { [orderByField]: sortOrder === "asc" ? "asc" : "desc" };
    }

    // Execute count and find in parallel for better performance
    const [total, requests] = await Promise.all([
      db.contentRequest.count({ where }),
      db.contentRequest.findMany({
        where,
        orderBy,
        skip: pagination.offset,
        take: pagination.limit,
        select: requestListSelect,
      }),
    ]);

    return NextResponse.json(
      createPaginatedResponse(requests, total, pagination)
    );
  } catch (error) {
    console.error("Error fetching requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createRequestSchema.parse(body);

    // Verify creator belongs to this agency
    const creator = await db.creator.findFirst({
      where: {
        id: validatedData.creatorId,
        agencyId: session.user.agencyId,
      },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    // Create the request
    const contentRequest = await db.contentRequest.create({
      data: {
        agencyId: session.user.agencyId,
        creatorId: validatedData.creatorId,
        templateId: validatedData.templateId || null,
        title: validatedData.title,
        description: validatedData.description || null,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        urgency: validatedData.urgency,
        requirements: validatedData.requirements || {},
        fields: validatedData.fields || [],
        status: validatedData.saveAsDraft ? "DRAFT" : "PENDING",
      },
      include: {
        creator: true,
      },
    });

    // Send notification if requested (and not a draft)
    if (validatedData.sendNotification && !validatedData.saveAsDraft) {
      const portalLink = `${process.env.APP_URL}/portal/${creator.id}/requests/${contentRequest.id}`;
      const dueDate = validatedData.dueDate
        ? format(new Date(validatedData.dueDate), "MMMM d, yyyy")
        : "No specific due date";

      // Send email
      try {
        await sendContentRequestEmail({
          to: creator.email,
          creatorName: creator.name,
          agencyName: session.user.agencyName,
          requestTitle: validatedData.title,
          dueDate,
          portalLink,
        });
      } catch (error) {
        console.error("Failed to send request email:", error);
      }

      // Send SMS if preferred
      if (creator.phone && (creator.preferredContact === "SMS" || creator.preferredContact === "BOTH")) {
        try {
          await sendContentRequestSms({
            to: creator.phone,
            creatorName: creator.name,
            requestTitle: validatedData.title,
            portalLink,
          });
        } catch (error) {
          console.error("Failed to send request SMS:", error);
        }
      }
    }

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: validatedData.saveAsDraft ? "request.drafted" : "request.created",
        entityType: "ContentRequest",
        entityId: contentRequest.id,
        metadata: {
          title: validatedData.title,
          creatorName: creator.name,
          isDraft: validatedData.saveAsDraft,
        },
      },
    });

    // Schedule auto-reminders if request has a due date and is not a draft
    let reminderScheduleResult = null;
    if (validatedData.dueDate && !validatedData.saveAsDraft) {
      try {
        reminderScheduleResult = await scheduleRemindersForRequest(contentRequest.id);
      } catch (error) {
        // Log but don't fail the request creation
        console.error("Failed to schedule auto-reminders:", error);
      }
    }

    // Invalidate request list cache
    invalidateCache.request(contentRequest.id, session.user.agencyId);

    return NextResponse.json({
      ...contentRequest,
      reminderSchedule: reminderScheduleResult
        ? {
            count: reminderScheduleResult.remindersCreated,
            summary: formatReminderSchedule(reminderScheduleResult.reminders),
            configSource: reminderScheduleResult.config.source,
          }
        : null,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating request:", error);
    return NextResponse.json(
      { error: "Failed to create request" },
      { status: 500 }
    );
  }
}
