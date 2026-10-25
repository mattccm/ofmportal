import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma, UserRole } from "@prisma/client";
import { requireAccess, staffWhere } from "@/lib/access/server";

// GET - The team page's list: teammates this person may see ("team.view", team scope applied)
export async function GET(request: NextRequest) {
  try {
    const gate = await requireAccess("team.view");
    if (gate.error) return gate.error;
    const { access } = gate;

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const search = searchParams.get("search");

    // Build the where clause
    const where: Prisma.UserWhereInput = staffWhere(access);

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
