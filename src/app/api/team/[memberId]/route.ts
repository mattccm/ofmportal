import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// PATCH - Update team member role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { memberId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only OWNER and ADMIN can update team members
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to update team members" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { role } = body;

    if (!role) {
      return NextResponse.json(
        { error: "Role is required" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ["OWNER", "ADMIN", "MANAGER", "MEMBER"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    // Get the member to update
    const member = await db.user.findUnique({
      where: { id: memberId },
      select: { id: true, role: true, agencyId: true, name: true },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Ensure member belongs to the same agency
    if (member.agencyId !== session.user.agencyId) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Prevent demoting the last OWNER
    if (member.role === "OWNER" && role !== "OWNER") {
      const ownerCount = await db.user.count({
        where: {
          agencyId: session.user.agencyId,
          role: "OWNER",
        },
      });

      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Cannot change the role of the last owner. Assign another owner first." },
          { status: 400 }
        );
      }
    }

    // Only OWNER can assign OWNER role
    if (role === "OWNER" && session.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only owners can assign the owner role" },
        { status: 403 }
      );
    }

    // Update the member's role
    const updatedMember = await db.user.update({
      where: { id: memberId },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    // Log the activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "team.role_updated",
        entityType: "User",
        entityId: memberId,
        metadata: {
          memberName: member.name,
          previousRole: member.role,
          newRole: role,
          updatedBy: session.user.name,
        },
      },
    });

    return NextResponse.json({
      success: true,
      member: updatedMember,
    });
  } catch (error) {
    console.error("Error updating team member:", error);
    return NextResponse.json(
      { error: "Failed to update team member" },
      { status: 500 }
    );
  }
}

// DELETE - Remove team member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { memberId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only OWNER and ADMIN can remove team members
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to remove team members" },
        { status: 403 }
      );
    }

    // Get the member to delete
    const member = await db.user.findUnique({
      where: { id: memberId },
      select: { id: true, role: true, agencyId: true, name: true, email: true },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Ensure member belongs to the same agency
    if (member.agencyId !== session.user.agencyId) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Cannot remove yourself
    if (member.id === session.user.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the team" },
        { status: 400 }
      );
    }

    // Prevent removing the last OWNER
    if (member.role === "OWNER") {
      const ownerCount = await db.user.count({
        where: {
          agencyId: session.user.agencyId,
          role: "OWNER",
        },
      });

      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last owner" },
          { status: 400 }
        );
      }
    }

    // ADMINs cannot remove OWNERs or other ADMINs
    if (session.user.role === "ADMIN" && ["OWNER", "ADMIN"].includes(member.role)) {
      return NextResponse.json(
        { error: "Admins cannot remove owners or other admins" },
        { status: 403 }
      );
    }

    // Delete the member
    await db.user.delete({
      where: { id: memberId },
    });

    // Log the activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "team.member_removed",
        entityType: "User",
        entityId: memberId,
        metadata: {
          removedMemberName: member.name,
          removedMemberEmail: member.email,
          removedMemberRole: member.role,
          removedBy: session.user.name,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Team member removed successfully",
    });
  } catch (error) {
    console.error("Error removing team member:", error);
    return NextResponse.json(
      { error: "Failed to remove team member" },
      { status: 500 }
    );
  }
}
