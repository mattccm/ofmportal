import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Role,
  Permission,
  CreatorVisibility,
  DataFieldVisibility,
  TeamMemberVisibility,
  PermissionOverride,
  ActivityRestrictions,
  DEFAULT_ROLES,
} from "@/types/permissions";
import { getRole } from "@/lib/permissions";

// GET - Get current user's permissions and role
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user with custom role if any
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: {
        customRole: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let role: Role | null = null;

    // Check if user has a custom role
    if (user.customRole) {
      role = {
        id: user.customRole.id,
        name: user.customRole.name,
        description: user.customRole.description || undefined,
        permissions: user.customRole.permissions as unknown as Permission[],
        creatorVisibility: user.customRole.creatorVisibility as unknown as CreatorVisibility,
        dataFieldVisibility: user.customRole.dataFieldVisibility as unknown as DataFieldVisibility,
        teamMemberVisibility: user.customRole.teamMemberVisibility as unknown as TeamMemberVisibility,
        isSystem: false,
        color: user.customRole.color || undefined,
        createdAt: user.customRole.createdAt,
        updatedAt: user.customRole.updatedAt,
      };
    } else {
      // Use default role based on user.role
      const defaultRole = getRole(user.role);
      if (defaultRole) {
        role = defaultRole;
      }
    }

    // Get permission overrides if any (stored in user metadata or separate table)
    const permissionOverrides = user.permissionOverrides as unknown as PermissionOverride[] | undefined;
    const assignedCreatorIds = user.assignedCreatorIds as unknown as string[] | undefined;
    const activityRestrictions = user.activityRestrictions as unknown as ActivityRestrictions | undefined;

    return NextResponse.json({
      role,
      permissionOverrides,
      assignedCreatorIds,
      activityRestrictions,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
    });
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch user permissions" },
      { status: 500 }
    );
  }
}

// PUT - Update a team member's permissions (admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can update user permissions
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to update user permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      userId,
      roleId,
      customRoleId,
      permissionOverrides,
      assignedCreatorIds,
      activityRestrictions,
    } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Verify the target user belongs to the same agency
    const targetUser = await db.user.findFirst({
      where: {
        id: userId,
        agencyId: session.user.agencyId,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Don't allow modifying owner permissions unless you're the owner
    if (targetUser.role === "OWNER" && session.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Cannot modify owner permissions" },
        { status: 403 }
      );
    }

    // Validate custom role if provided
    if (customRoleId) {
      const customRole = await db.customRole.findFirst({
        where: {
          id: customRoleId,
          agencyId: session.user.agencyId,
        },
      });

      if (!customRole) {
        return NextResponse.json(
          { error: "Custom role not found" },
          { status: 400 }
        );
      }
    }

    // Validate default role if provided
    if (roleId && !customRoleId) {
      const defaultRole = DEFAULT_ROLES.find(
        (r) => r.id === roleId || r.name.toLowerCase() === roleId.toLowerCase()
      );
      if (!defaultRole) {
        return NextResponse.json(
          { error: "Invalid role" },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: any = {};

    if (roleId && !customRoleId) {
      // Map roleId to UserRole enum
      const roleMap: Record<string, string> = {
        owner: "OWNER",
        admin: "ADMIN",
        manager: "MANAGER",
        editor: "MEMBER",
        viewer: "MEMBER",
      };
      updateData.role = roleMap[roleId.toLowerCase()] || "MEMBER";
      updateData.customRoleId = null;
    }

    if (customRoleId) {
      updateData.customRoleId = customRoleId;
    }

    if (permissionOverrides !== undefined) {
      updateData.permissionOverrides = permissionOverrides;
    }

    if (assignedCreatorIds !== undefined) {
      updateData.assignedCreatorIds = assignedCreatorIds;
    }

    if (activityRestrictions !== undefined) {
      updateData.activityRestrictions = activityRestrictions;
    }

    // Update the user
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        customRole: true,
      },
    });

    // Log the activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "user.permissions_updated",
        entityType: "User",
        entityId: userId,
        metadata: {
          targetUserName: updatedUser.name,
          changes: Object.keys(updateData),
        },
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        customRoleId: updatedUser.customRoleId,
        permissionOverrides: updatedUser.permissionOverrides,
        assignedCreatorIds: updatedUser.assignedCreatorIds,
        activityRestrictions: updatedUser.activityRestrictions,
      },
    });
  } catch (error) {
    console.error("Error updating user permissions:", error);
    return NextResponse.json(
      { error: "Failed to update user permissions" },
      { status: 500 }
    );
  }
}
