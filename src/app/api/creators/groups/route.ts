import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// Schema for creating/updating a creator group
const groupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
  memberIds: z.array(z.string()).optional(),
});

// GET - List all creator groups for the agency
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const groups = await db.creatorGroup.findMany({
      where: { agencyId: session.user.agencyId },
      orderBy: { createdAt: "desc" },
      include: {
        members: {
          orderBy: { sortOrder: "asc" },
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                inviteStatus: true,
              },
            },
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    // Transform the data for easier consumption
    const transformedGroups = groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      color: group.color,
      memberCount: group._count.members,
      members: group.members.map((m) => ({
        id: m.creator.id,
        name: m.creator.name,
        email: m.creator.email,
        avatar: m.creator.avatar,
        inviteStatus: m.creator.inviteStatus,
        sortOrder: m.sortOrder,
      })),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    }));

    return NextResponse.json(transformedGroups);
  } catch (error) {
    console.error("Error fetching creator groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch creator groups" },
      { status: 500 }
    );
  }
}

// POST - Create a new creator group
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = groupSchema.parse(body);

    // Check if group with same name already exists
    const existingGroup = await db.creatorGroup.findUnique({
      where: {
        agencyId_name: {
          agencyId: session.user.agencyId,
          name: validatedData.name,
        },
      },
    });

    if (existingGroup) {
      return NextResponse.json(
        { error: "A group with this name already exists" },
        { status: 400 }
      );
    }

    // Verify all member IDs belong to the agency
    if (validatedData.memberIds && validatedData.memberIds.length > 0) {
      const validCreators = await db.creator.findMany({
        where: {
          id: { in: validatedData.memberIds },
          agencyId: session.user.agencyId,
        },
        select: { id: true },
      });

      const validIds = new Set(validCreators.map((c) => c.id));
      const invalidIds = validatedData.memberIds.filter((id) => !validIds.has(id));

      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: "Some creator IDs are invalid" },
          { status: 400 }
        );
      }
    }

    // Create the group with members
    const group = await db.creatorGroup.create({
      data: {
        agencyId: session.user.agencyId,
        name: validatedData.name,
        description: validatedData.description,
        color: validatedData.color,
        members: validatedData.memberIds
          ? {
              create: validatedData.memberIds.map((creatorId, index) => ({
                creatorId,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      include: {
        members: {
          orderBy: { sortOrder: "asc" },
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                inviteStatus: true,
              },
            },
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "creator_group.created",
        entityType: "CreatorGroup",
        entityId: group.id,
        metadata: {
          groupName: group.name,
          memberCount: group._count.members,
        },
      },
    });

    const transformedGroup = {
      id: group.id,
      name: group.name,
      description: group.description,
      color: group.color,
      memberCount: group._count.members,
      members: group.members.map((m) => ({
        id: m.creator.id,
        name: m.creator.name,
        email: m.creator.email,
        avatar: m.creator.avatar,
        inviteStatus: m.creator.inviteStatus,
        sortOrder: m.sortOrder,
      })),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };

    return NextResponse.json(transformedGroup, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating creator group:", error);
    return NextResponse.json(
      { error: "Failed to create creator group" },
      { status: 500 }
    );
  }
}
