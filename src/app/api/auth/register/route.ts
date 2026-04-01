import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  agencyName: z.string().min(2, "Agency name must be at least 2 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: validatedData.email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    // Check if agency email already exists
    const existingAgency = await db.agency.findUnique({
      where: { email: validatedData.email.toLowerCase() },
    });

    if (existingAgency) {
      return NextResponse.json(
        { error: "An agency with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);

    // Create agency and user in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create agency
      const agency = await tx.agency.create({
        data: {
          name: validatedData.agencyName,
          email: validatedData.email.toLowerCase(),
        },
      });

      // Create user as owner
      const user = await tx.user.create({
        data: {
          name: validatedData.name,
          email: validatedData.email.toLowerCase(),
          password: hashedPassword,
          role: "OWNER",
          agencyId: agency.id,
        },
      });

      // Create default reminder config
      await tx.reminderConfig.create({
        data: {
          agencyId: agency.id,
          name: "Default Reminders",
          daysBefore: [7, 3, 1, 0],
          escalateDaysOverdue: 3,
          sendEmail: true,
          sendSms: false,
          emailSubject: "Reminder: Content due for {{requestTitle}}",
          emailBody:
            "Hi {{creatorName}},\n\nThis is a friendly reminder that your content for \"{{requestTitle}}\" is due on {{dueDate}}.\n\nPlease upload your content at: {{portalLink}}\n\nThank you!",
        },
      });

      return { agency, user };
    });

    return NextResponse.json(
      {
        message: "Account created successfully",
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
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

    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
