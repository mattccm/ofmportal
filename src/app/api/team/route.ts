import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import crypto from "crypto";
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

// POST - Invite a new team member
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only OWNER and ADMIN can invite team members
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to invite team members" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, name, role, customRoleId } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: "Email and name are required" },
        { status: 400 }
      );
    }

    if (!role && !customRoleId) {
      return NextResponse.json(
        { error: "Role or custom role is required" },
        { status: 400 }
      );
    }

    // Validate role if provided (and no custom role)
    const validRoles = ["ADMIN", "MANAGER", "MEMBER"];
    if (role && !customRoleId && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be ADMIN, MANAGER, or MEMBER" },
        { status: 400 }
      );
    }

    // Validate custom role if provided
    let customRole = null;
    if (customRoleId) {
      customRole = await db.customRole.findFirst({
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

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Generate a temporary password
    const tempPassword = crypto.randomBytes(16).toString("hex");
    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Determine the role to use
    const userRole = customRoleId ? "MEMBER" : role;
    const roleName = customRole ? customRole.name : userRole;

    // Create the new team member
    const newMember = await db.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        role: userRole,
        password: hashedPassword,
        agencyId: session.user.agencyId,
        customRoleId: customRoleId || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        customRoleId: true,
        createdAt: true,
      },
    });

    // Get agency name for the email
    const agency = await db.agency.findUnique({
      where: { id: session.user.agencyId },
      select: { name: true },
    });

    // Send invitation email
    const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const loginLink = `${appUrl}/login`;

    await sendEmail({
      to: email,
      subject: `You've been invited to join ${agency?.name || "CCM"}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to the Team!</h1>
            </div>

            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
              <p>Hi ${name},</p>

              <p>You've been invited to join <strong>${agency?.name || "CCM"}</strong> as a <strong>${roleName}</strong>.</p>

              <p>Here are your login credentials:</p>

              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
              </div>

              <p style="color: #666; font-size: 14px;">Please change your password after logging in for the first time.</p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${loginLink}" style="background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Log In Now</a>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
Hi ${name},

You've been invited to join ${agency?.name || "CCM"} as a ${roleName}.

Your login credentials:
Email: ${email}
Temporary Password: ${tempPassword}

Please change your password after logging in for the first time.

Log in here: ${loginLink}
      `.trim(),
    });

    // Log the activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "team.member_invited",
        entityType: "User",
        entityId: newMember.id,
        metadata: {
          invitedEmail: email,
          invitedRole: roleName,
          customRoleId: customRoleId || null,
          invitedBy: session.user.name,
        },
      },
    });

    return NextResponse.json({
      success: true,
      member: newMember,
      message: "Invitation sent successfully",
    });
  } catch (error) {
    console.error("Error inviting team member:", error);
    return NextResponse.json(
      { error: "Failed to invite team member" },
      { status: 500 }
    );
  }
}
