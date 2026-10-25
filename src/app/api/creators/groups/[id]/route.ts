import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creatorScopeWhere, creatorWhere, requireAccess } from "@/lib/access/server";
import { z } from "zod";
import { CREATOR_PICKER_KEYS, groupInclude, shapeGroup } from "../../creator-access";

// Schema for updating a creator group
const updateGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional().nullable(),
  memberIds: z.array(z.string()).optional(),
});

// GET - Get a single creator group by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess(CREATOR_PICKER_KEYS);
    if (gate.error) return gate.error;
    const { session, access } = gate;

    const { id } = await params;

    const group = await db.creatorGroup.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      include: groupInclude(access),
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const transformedGroup = shapeGroup(access, group);

    return NextResponse.json(transformedGroup);
  } catch (error) {
    console.error("Error fetching creator group:", error);
    return NextResponse.json(
      { error: "Failed to fetch creator group" },
      { status: 500 }
    );
  }
}

// PATCH - Update a creator group
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("creators.groups");
    if (gate.error) return gate.error;
    const { session, access } = gate;

    const { id } = await params;
    const body = await req.json();
    const validatedData = updateGroupSchema.parse(body);

    // Check if group exists and belongs to the agency
    const existingGroup = await db.creatorGroup.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existingGroup) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // If name is being changed, check for duplicates
    if (validatedData.name && validatedData.name !== existingGroup.name) {
      const duplicateGroup = await db.creatorGroup.findUnique({
        where: {
          agencyId_name: {
            agencyId: session.user.agencyId,
            name: validatedData.name,
          },
        },
      });

      if (duplicateGroup) {
        return NextResponse.json(
          { error: "A group with this name already exists" },
          { status: 400 }
        );
      }
    }

    // Verify all member IDs belong to the agency if provided
    if (validatedData.memberIds) {
      if (validatedData.memberIds.length > 0) {
        const validCreators = await db.creator.findMany({
          where: { AND: [creatorWhere(access), { id: { in: validatedData.memberIds } }] },
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

      // Update members: delete existing and create new. Members outside
      // this person's creator scope are invisible to them, so they stay.
      await db.creatorGroupMember.deleteMany({
        where: { groupId: id, creator: creatorScopeWhere(access) },
      });

      if (validatedData.memberIds.length > 0) {
        await db.creatorGroupMember.createMany({
          data: validatedData.memberIds.map((creatorId, index) => ({
            groupId: id,
            creatorId,
            sortOrder: index,
          })),
        });
      }
    }

    // Update the group
    const group = await db.creatorGroup.update({
      where: { id },
      data: {
        name: validatedData.name,
        description: validatedData.description,
        color: validatedData.color,
      },
      include: groupInclude(access),
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "creator_group.updated",
        entityType: "CreatorGroup",
        entityId: group.id,
        metadata: {
          groupName: group.name,
          memberCount: group._count.members,
        },
      },
    });

    const transformedGroup = shapeGroup(access, group);

    return NextResponse.json(transformedGroup);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating creator group:", error);
    return NextResponse.json(
      { error: "Failed to update creator group" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a creator group
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("creators.groups");
    if (gate.error) return gate.error;
    const { session } = gate;

    const { id } = await params;

    // Check if group exists and belongs to the agency
    const existingGroup = await db.creatorGroup.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      select: {
        id: true,
        name: true,
        _count: { select: { members: true } },
      },
    });

    if (!existingGroup) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Delete the group (cascades to members)
    await db.creatorGroup.delete({
      where: { id },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "creator_group.deleted",
        entityType: "CreatorGroup",
        entityId: id,
        metadata: {
          groupName: existingGroup.name,
          memberCount: existingGroup._count.members,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting creator group:", error);
    return NextResponse.json(
      { error: "Failed to delete creator group" },
      { status: 500 }
    );
  }
}
