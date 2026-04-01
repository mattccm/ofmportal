import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { FeedbackType, FeedbackStatus } from "@/types/feedback";

// Schema for creating feedback
const createFeedbackSchema = z.object({
  type: z.enum(["BUG", "FEATURE_REQUEST", "GENERAL"]),
  rating: z.number().min(1).max(5),
  message: z.string().min(1, "Message is required").max(2000),
  screenshotUrl: z.string().url().optional(),
  pageUrl: z.string().optional(),
  userAgent: z.string().optional(),
});

// Schema for updating feedback (admin only)
const updateFeedbackSchema = z.object({
  id: z.string(),
  status: z.enum(["NEW", "REVIEWED", "IMPLEMENTED"]).optional(),
  adminReply: z.string().max(2000).optional(),
});

// GET - Fetch feedback list (admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin or owner
    if (session.user.role !== "ADMIN" && session.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as FeedbackType | null;
    const status = searchParams.get("status") as FeedbackStatus | null;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build where clause
    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (status) where.status = status;

    // Get total count
    const total = await db.feedback.count({ where });

    // Get feedback with pagination
    const feedback = await db.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      feedback,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching feedback:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}

// POST - Create new feedback
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createFeedbackSchema.parse(body);

    const feedback = await db.feedback.create({
      data: {
        userId: session.user.id,
        userName: session.user.name || "Anonymous",
        userEmail: session.user.email || "",
        type: validatedData.type,
        rating: validatedData.rating,
        message: validatedData.message,
        screenshotUrl: validatedData.screenshotUrl || null,
        pageUrl: validatedData.pageUrl || null,
        userAgent: validatedData.userAgent || null,
        status: "NEW",
      },
    });

    return NextResponse.json(feedback, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating feedback:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}

// PATCH - Update feedback status/reply (admin only)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin or owner
    if (session.user.role !== "ADMIN" && session.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = updateFeedbackSchema.parse(body);

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (validatedData.status) {
      updateData.status = validatedData.status;
    }

    if (validatedData.adminReply !== undefined) {
      updateData.adminReply = validatedData.adminReply;
      updateData.repliedAt = new Date();
      updateData.repliedBy = session.user.name || session.user.email;
    }

    const feedback = await db.feedback.update({
      where: { id: validatedData.id },
      data: updateData,
    });

    return NextResponse.json(feedback);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating feedback:", error);
    return NextResponse.json(
      { error: "Failed to update feedback" },
      { status: 500 }
    );
  }
}
