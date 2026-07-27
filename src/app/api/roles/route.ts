import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Role,
  Permission,
  CreatorVisibility,
  DataFieldVisibility,
  TeamMemberVisibility,
  DEFAULT_ROLES,
  validateRolePermissions,
} from "@/types/permissions";
import { isAdminOrHigher, PermissionUser } from "@/lib/permissions";

// Helper to convert session user to PermissionUser
function sessionToPermissionUser(session: Session): PermissionUser {
  return {
    id: session.user.id,
    role: session.user.role,
    agencyId: session.user.agencyId,
  };
}

// GET - List all roles for the agency
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch custom roles from database
    const customRoles = await db.customRole.findMany({
      where: {
        agencyId: session.user.agencyId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Transform database roles to Role type
    const roles: Role[] = customRoles.map((dbRole) => ({
      id: dbRole.id,
      name: dbRole.name,
      description: dbRole.description || undefined,
      permissions: dbRole.permissions as unknown as Permission[],
      creatorVisibility: dbRole.creatorVisibility as unknown as CreatorVisibility,
      dataFieldVisibility: dbRole.dataFieldVisibility as unknown as DataFieldVisibility,
      teamMemberVisibility: dbRole.teamMemberVisibility as unknown as TeamMemberVisibility,
      isSystem: false,
      color: dbRole.color || undefined,
      createdAt: dbRole.createdAt,
      updatedAt: dbRole.updatedAt,
    }));

    // Include default roles in response
    const allRoles = [
      ...DEFAULT_ROLES.map((r) => ({
        ...r,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      ...roles,
    ];

    return NextResponse.json({ roles: allRoles });
  } catch (error) {
    console.error("Error fetching roles:", error);
    return NextResponse.json(
      { error: "Failed to fetch roles" },
      { status: 500 }
    );
  }
}

// POST - Create a new custom role
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can create roles
    const user = sessionToPermissionUser(session);
    if (!isAdminOrHigher(user)) {
      return NextResponse.json(
        { error: "You do not have permission to create roles" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      permissions,
      creatorVisibility,
      dataFieldVisibility,
      teamMemberVisibility,
      color,
    } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Role name is required" },
        { status: 400 }
      );
    }

    // Validate permissions
    const validation = validateRolePermissions(permissions || []);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(", ") },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existingRole = await db.customRole.findFirst({
      where: {
        agencyId: session.user.agencyId,
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    if (existingRole) {
      return NextResponse.json(
        { error: "A role with this name already exists" },
        { status: 400 }
      );
    }

    // Also check against default role names
    const isDefaultName = DEFAULT_ROLES.some(
      (r) => r.name.toLowerCase() === name.toLowerCase()
    );
    if (isDefaultName) {
      return NextResponse.json(
        { error: "Cannot use a system role name" },
        { status: 400 }
      );
    }

    // Create the role
    const newRole = await db.customRole.create({
      data: {
        name,
        description: description || null,
        permissions: permissions || [],
        creatorVisibility: creatorVisibility || { type: "assigned" },
        dataFieldVisibility: dataFieldVisibility || {
          creatorFields: {
            name: { view: true, edit: false },
            email: { view: true, edit: false },
            phone: { view: false, edit: false },
            earnings: false,
            personalNotes: { view: false, edit: false },
            contracts: false,
            paymentInfo: false,
            avatar: { view: true, edit: false },
            socialLinks: { view: true, edit: false },
          },
          requestFields: {
            internalNotes: { view: false, edit: false },
            creatorCompensation: false,
          },
        },
        teamMemberVisibility: teamMemberVisibility || {
          canSeeOwnProfile: true,
          canEditOwnProfile: false,
          canSeeOtherMembers: true,
          canSeeOtherMemberActivity: false,
          canSeeMemberEarnings: false,
          memberFieldVisibility: {
            email: true,
            phone: false,
            role: true,
            lastActive: false,
          },
        },
        color: color || null,
        agencyId: session.user.agencyId,
      },
    });

    // Log the activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "role.created",
        entityType: "CustomRole",
        entityId: newRole.id,
        metadata: {
          roleName: name,
        },
      },
    });

    return NextResponse.json({
      success: true,
      role: {
        id: newRole.id,
        name: newRole.name,
        description: newRole.description,
        permissions: newRole.permissions,
        creatorVisibility: newRole.creatorVisibility,
        dataFieldVisibility: newRole.dataFieldVisibility,
        teamMemberVisibility: newRole.teamMemberVisibility,
        isSystem: false,
        color: newRole.color,
        createdAt: newRole.createdAt,
        updatedAt: newRole.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error creating role:", error);
    return NextResponse.json(
      { error: "Failed to create role" },
      { status: 500 }
    );
  }
}

// PUT - Update a custom role
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can update roles
    const user = sessionToPermissionUser(session);
    if (!isAdminOrHigher(user)) {
      return NextResponse.json(
        { error: "You do not have permission to update roles" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      id,
      name,
      description,
      permissions,
      creatorVisibility,
      dataFieldVisibility,
      teamMemberVisibility,
      color,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Role ID is required" },
        { status: 400 }
      );
    }

    // Default (system) roles have no DB row until they are edited. When a
    // default role is saved, materialize an agency-level override into the
    // CustomRole table (keyed by name, flagged isSystem) so the edit persists
    // and is resolved for users on that role.
    const defaultRole = DEFAULT_ROLES.find(
      (r) => r.id === String(id).toLowerCase()
    );

    if (defaultRole) {
      // The Owner role is fully locked and cannot be modified.
      if (defaultRole.id === "owner") {
        return NextResponse.json(
          { error: "The Owner role cannot be modified" },
          { status: 403 }
        );
      }

      // Validate permissions if provided
      if (permissions) {
        const validation = validateRolePermissions(permissions);
        if (!validation.valid) {
          return NextResponse.json(
            { error: validation.errors.join(", ") },
            { status: 400 }
          );
        }
      }

      const materialized = await db.customRole.upsert({
        where: {
          agencyId_name: {
            agencyId: session.user.agencyId,
            name: defaultRole.name,
          },
        },
        create: {
          agencyId: session.user.agencyId,
          name: defaultRole.name,
          isSystem: true,
          description:
            description !== undefined
              ? description || null
              : defaultRole.description ?? null,
          permissions: (permissions ??
            defaultRole.permissions) as unknown as Prisma.InputJsonValue,
          creatorVisibility: (creatorVisibility ??
            defaultRole.creatorVisibility) as unknown as Prisma.InputJsonValue,
          dataFieldVisibility: (dataFieldVisibility ??
            defaultRole.dataFieldVisibility) as unknown as Prisma.InputJsonValue,
          teamMemberVisibility: (teamMemberVisibility ??
            defaultRole.teamMemberVisibility) as unknown as Prisma.InputJsonValue,
          color:
            color !== undefined ? color || null : defaultRole.color ?? null,
        },
        update: {
          ...(permissions && {
            permissions: permissions as unknown as Prisma.InputJsonValue,
          }),
          ...(description !== undefined && { description: description || null }),
          ...(creatorVisibility && {
            creatorVisibility:
              creatorVisibility as unknown as Prisma.InputJsonValue,
          }),
          ...(dataFieldVisibility && {
            dataFieldVisibility:
              dataFieldVisibility as unknown as Prisma.InputJsonValue,
          }),
          ...(teamMemberVisibility && {
            teamMemberVisibility:
              teamMemberVisibility as unknown as Prisma.InputJsonValue,
          }),
          ...(color !== undefined && { color: color || null }),
        },
      });

      // Log the activity
      await db.activityLog.create({
        data: {
          userId: session.user.id,
          action: "role.updated",
          entityType: "CustomRole",
          entityId: materialized.id,
          metadata: {
            roleName: materialized.name,
            systemRole: defaultRole.id,
            changes: Object.keys(body).filter((k) => k !== "id"),
          },
        },
      });

      return NextResponse.json({
        success: true,
        role: {
          id: defaultRole.id,
          name: materialized.name,
          description: materialized.description,
          permissions: materialized.permissions,
          creatorVisibility: materialized.creatorVisibility,
          dataFieldVisibility: materialized.dataFieldVisibility,
          teamMemberVisibility: materialized.teamMemberVisibility,
          isSystem: true,
          color: materialized.color,
          createdAt: materialized.createdAt,
          updatedAt: materialized.updatedAt,
        },
      });
    }

    // Check if role exists and belongs to this agency
    const existingRole = await db.customRole.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      );
    }

    // Validate permissions if provided
    if (permissions) {
      const validation = validateRolePermissions(permissions);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.errors.join(", ") },
          { status: 400 }
        );
      }
    }

    // Check for duplicate name if name is being changed
    if (name && name !== existingRole.name) {
      const duplicateRole = await db.customRole.findFirst({
        where: {
          agencyId: session.user.agencyId,
          name: {
            equals: name,
            mode: "insensitive",
          },
          id: {
            not: id,
          },
        },
      });

      if (duplicateRole) {
        return NextResponse.json(
          { error: "A role with this name already exists" },
          { status: 400 }
        );
      }

      // Check against default role names
      const isDefaultName = DEFAULT_ROLES.some(
        (r) => r.name.toLowerCase() === name.toLowerCase()
      );
      if (isDefaultName) {
        return NextResponse.json(
          { error: "Cannot use a system role name" },
          { status: 400 }
        );
      }
    }

    // Update the role
    const updatedRole = await db.customRole.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(permissions && { permissions }),
        ...(creatorVisibility && { creatorVisibility }),
        ...(dataFieldVisibility && { dataFieldVisibility }),
        ...(teamMemberVisibility && { teamMemberVisibility }),
        ...(color !== undefined && { color: color || null }),
      },
    });

    // Log the activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "role.updated",
        entityType: "CustomRole",
        entityId: updatedRole.id,
        metadata: {
          roleName: updatedRole.name,
          changes: Object.keys(body).filter((k) => k !== "id"),
        },
      },
    });

    return NextResponse.json({
      success: true,
      role: {
        id: updatedRole.id,
        name: updatedRole.name,
        description: updatedRole.description,
        permissions: updatedRole.permissions,
        creatorVisibility: updatedRole.creatorVisibility,
        dataFieldVisibility: updatedRole.dataFieldVisibility,
        teamMemberVisibility: updatedRole.teamMemberVisibility,
        isSystem: false,
        color: updatedRole.color,
        createdAt: updatedRole.createdAt,
        updatedAt: updatedRole.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating role:", error);
    return NextResponse.json(
      { error: "Failed to update role" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a custom role
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can delete roles
    const user = sessionToPermissionUser(session);
    if (!isAdminOrHigher(user)) {
      return NextResponse.json(
        { error: "You do not have permission to delete roles" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Role ID is required" },
        { status: 400 }
      );
    }

    // Check if role exists and belongs to this agency
    const existingRole = await db.customRole.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      );
    }

    // Check if any users are assigned to this role
    const usersWithRole = await db.user.count({
      where: {
        agencyId: session.user.agencyId,
        customRoleId: id,
      },
    });

    if (usersWithRole > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete role. ${usersWithRole} user(s) are currently assigned to this role.`,
        },
        { status: 400 }
      );
    }

    // Delete the role
    await db.customRole.delete({
      where: { id },
    });

    // Log the activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "role.deleted",
        entityType: "CustomRole",
        entityId: id,
        metadata: {
          roleName: existingRole.name,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting role:", error);
    return NextResponse.json(
      { error: "Failed to delete role" },
      { status: 500 }
    );
  }
}
