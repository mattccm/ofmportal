import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { sendCreatorInviteEmail } from "@/lib/email";
import {
  parsePaginationParams,
  createPaginatedResponse,
  PAGE_SIZES,
} from "@/lib/pagination";
import { cache, cacheKeys, cacheTTL, invalidateCache } from "@/lib/cache";

const createCreatorSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  preferredContact: z.enum(["EMAIL", "SMS", "BOTH"]).default("EMAIL"),
  notes: z.string().optional(),
});

// Optimized select for list view (reduced payload)
const creatorListSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatar: true,
  inviteStatus: true,
  lastLoginAt: true,
  createdAt: true,
  _count: {
    select: {
      requests: true,
      uploads: true,
    },
  },
} as const;

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const pagination = parsePaginationParams(searchParams);

    // Optional filters
    const search = searchParams.get("search")?.toLowerCase();
    const status = searchParams.get("status");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Build where clause
    const where: Record<string, unknown> = {
      agencyId: session.user.agencyId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status && status !== "all") {
      where.inviteStatus = status;
    }

    // Build orderBy
    const validSortFields = ["createdAt", "name", "lastLoginAt"];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const orderBy = { [orderByField]: sortOrder === "asc" ? "asc" : "desc" };

    // Execute count and find in parallel for better performance
    const [total, creators] = await Promise.all([
      db.creator.count({ where }),
      db.creator.findMany({
        where,
        orderBy,
        skip: pagination.offset,
        take: pagination.limit,
        select: creatorListSelect,
      }),
    ]);

    // Transform response to match expected format
    const transformedCreators = creators.map((creator) => ({
      ...creator,
      // Add active requests count for backward compatibility
      requests: Array((creator as { _count: { requests: number } })._count.requests).fill({ id: "placeholder" }),
    }));

    return NextResponse.json(
      createPaginatedResponse(transformedCreators, total, pagination)
    );
  } catch (error) {
    console.error("Error fetching creators:", error);
    return NextResponse.json(
      { error: "Failed to fetch creators" },
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
    const validatedData = createCreatorSchema.parse(body);

    // Check if creator already exists in this agency
    const existingCreator = await db.creator.findUnique({
      where: {
        agencyId_email: {
          agencyId: session.user.agencyId,
          email: validatedData.email.toLowerCase(),
        },
      },
    });

    if (existingCreator) {
      return NextResponse.json(
        { error: "A creator with this email already exists in your agency" },
        { status: 400 }
      );
    }

    // Generate invite token
    const inviteToken = uuidv4();

    // Create creator
    const creator = await db.creator.create({
      data: {
        agencyId: session.user.agencyId,
        name: validatedData.name,
        email: validatedData.email.toLowerCase(),
        phone: validatedData.phone || null,
        preferredContact: validatedData.preferredContact,
        notes: validatedData.notes || null,
        inviteToken,
        inviteStatus: "PENDING",
        inviteSentAt: new Date(),
      },
    });

    // Generate invite link
    const inviteLink = `${process.env.APP_URL}/portal/setup/${inviteToken}`;

    // Send invitation email
    try {
      await sendCreatorInviteEmail({
        to: creator.email,
        creatorName: creator.name,
        agencyName: session.user.agencyName,
        inviteLink,
      });
    } catch (emailError) {
      console.error("Failed to send invite email:", emailError);
      // Continue - we still created the creator, just email failed
    }

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "creator.invited",
        entityType: "Creator",
        entityId: creator.id,
        metadata: {
          creatorName: creator.name,
          creatorEmail: creator.email,
        },
      },
    });

    // Invalidate creator list cache
    invalidateCache.creator(creator.id, session.user.agencyId);

    return NextResponse.json(
      {
        creator,
        inviteLink,
        message: "Creator invited successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating creator:", error);
    return NextResponse.json(
      { error: "Failed to invite creator" },
      { status: 500 }
    );
  }
}
