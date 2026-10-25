import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { excludePseudoUsers } from "@/lib/staff";
import { Prisma, UserRole } from "@prisma/client";

// GET - List all team members for the current agency
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const search = searchParams.get("search");

    // Build the where clause
    const where: Prisma.UserWhereInput = {
      agencyId: session.user.agencyId,
      ...excludePseudoUsers,
    };

    if (role && role !== "ALL" && Object.values(UserRole).includes(role as UserRole)) {
      where.role = role as UserRole;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const members = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        lastActiveAt: true,
        createdAt: true,
        twoFactorEnabled: true,
        customRoleId: true,
        customRole: {
          select: {
            id: true,
            name: true,
            color: true,
            description: true,
          },
        },
        permissionOverrides: true,
        assignedCreatorIds: true,
        templateVisibility: true,
        allowedCategoryIds: true,
        activityRestrictions: true,
        activityLogs: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            metadata: true,
            createdAt: true,
          },
        },
      },
      orderBy: [
        { role: "asc" },
        { name: "asc" },
      ],
    });

    // Calculate online status for each member
    const membersWithStatus = members.map((member) => {
      const isOnline = member.lastActiveAt
        ? new Date().getTime() - new Date(member.lastActiveAt).getTime() < 5 * 60 * 1000 // 5 minutes
        : false;

      return {
        ...member,
        isOnline,
      };
    });

    return NextResponse.json({ members: membersWithStatus });
  } catch (error) {
    console.error("Error fetching team members:", error);
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 }
    );
  }
}
