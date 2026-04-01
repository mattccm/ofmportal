import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_ROLES } from "@/types/permissions";
import { isAdminOrHigher, PermissionUser } from "@/lib/permissions";

// Helper to convert session user to PermissionUser
function sessionToPermissionUser(session: any): PermissionUser {
  return {
    id: session.user.id,
    role: session.user.role,
    agencyId: session.user.agencyId,
  };
}

// POST - Duplicate a role
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can duplicate roles
    const user = sessionToPermissionUser(session);
    if (!isAdminOrHigher(user)) {
      return NextResponse.json(
        { error: "You do not have permission to duplicate roles" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check if it's a default role
    const defaultRole = DEFAULT_ROLES.find((r) => r.id === id);

    let sourceRole: any;

    if (defaultRole) {
      // Use the default role as source
      sourceRole = {
        name: defaultRole.name,
        description: defaultRole.description,
        permissions: defaultRole.permissions,
        creatorVisibility: defaultRole.creatorVisibility,
        dataFieldVisibility: defaultRole.dataFieldVisibility,
        teamMemberVisibility: defaultRole.teamMemberVisibility,
        color: defaultRole.color,
      };
    } else {
      // Find the custom role
      sourceRole = await db.customRole.findFirst({
        where: {
          id,
          agencyId: session.user.agencyId,
        },
      });

      if (!sourceRole) {
        return NextResponse.json(
          { error: "Role not found" },
          { status: 404 }
        );
      }
    }

    // Generate a unique name for the duplicate
    let newName = `${sourceRole.name} (Copy)`;
    let counter = 1;

    // Check for existing roles with similar names
    while (true) {
      const existingRole = await db.customRole.findFirst({
        where: {
          agencyId: session.user.agencyId,
          name: {
            equals: newName,
            mode: "insensitive",
          },
        },
      });

      if (!existingRole) {
        break;
      }

      counter++;
      newName = `${sourceRole.name} (Copy ${counter})`;
    }

    // Create the duplicate role
    const duplicatedRole = await db.customRole.create({
      data: {
        name: newName,
        description: sourceRole.description
          ? `Duplicate of ${sourceRole.name}. ${sourceRole.description}`
          : `Duplicate of ${sourceRole.name}`,
        permissions: sourceRole.permissions,
        creatorVisibility: sourceRole.creatorVisibility,
        dataFieldVisibility: sourceRole.dataFieldVisibility,
        teamMemberVisibility: sourceRole.teamMemberVisibility,
        color: sourceRole.color,
        agencyId: session.user.agencyId,
      },
    });

    // Log the activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "role.duplicated",
        entityType: "CustomRole",
        entityId: duplicatedRole.id,
        metadata: {
          sourceRoleName: sourceRole.name,
          newRoleName: newName,
        },
      },
    });

    return NextResponse.json({
      success: true,
      role: {
        id: duplicatedRole.id,
        name: duplicatedRole.name,
        description: duplicatedRole.description,
        permissions: duplicatedRole.permissions,
        creatorVisibility: duplicatedRole.creatorVisibility,
        dataFieldVisibility: duplicatedRole.dataFieldVisibility,
        teamMemberVisibility: duplicatedRole.teamMemberVisibility,
        isSystem: false,
        color: duplicatedRole.color,
        createdAt: duplicatedRole.createdAt,
        updatedAt: duplicatedRole.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error duplicating role:", error);
    return NextResponse.json(
      { error: "Failed to duplicate role" },
      { status: 500 }
    );
  }
}
