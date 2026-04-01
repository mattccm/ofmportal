import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface SavedReportConfig {
  id: string;
  name: string;
  reportType: string;
  dateRange: string;
  groupBy: string;
  filters: {
    creatorIds?: string[];
    teamMemberIds?: string[];
    requestTypes?: string[];
  };
  schedule?: {
    enabled: boolean;
    frequency: "daily" | "weekly" | "monthly";
    recipients: string[];
    lastSentAt?: string;
    nextSendAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// We'll store saved reports in the User's preferences JSON field
// In production, this would be a separate table

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const preferences = user?.preferences as Record<string, unknown> || {};
    const savedReports = (preferences.savedReports as SavedReportConfig[]) || [];

    return NextResponse.json({ savedReports });
  } catch (error) {
    console.error("Saved Reports GET error:", error);
    return NextResponse.json({ error: "Failed to fetch saved reports" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, reportType, dateRange, groupBy, filters, schedule } = body;

    if (!name || !reportType) {
      return NextResponse.json(
        { error: "Name and report type are required" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const preferences = (user?.preferences as Record<string, unknown>) || {};
    const savedReports = (preferences.savedReports as SavedReportConfig[]) || [];

    // Create new saved report
    const newReport: SavedReportConfig = {
      id: crypto.randomUUID(),
      name,
      reportType,
      dateRange: dateRange || "this_month",
      groupBy: groupBy || "week",
      filters: filters || {},
      schedule: schedule || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    savedReports.push(newReport);

    // Update user preferences
    await db.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...preferences,
          savedReports,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ savedReport: newReport }, { status: 201 });
  } catch (error) {
    console.error("Saved Reports POST error:", error);
    return NextResponse.json({ error: "Failed to save report" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, reportType, dateRange, groupBy, filters, schedule } = body;

    if (!id) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const preferences = (user?.preferences as Record<string, unknown>) || {};
    const savedReports = (preferences.savedReports as SavedReportConfig[]) || [];

    const reportIndex = savedReports.findIndex((r) => r.id === id);

    if (reportIndex === -1) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Update the report
    savedReports[reportIndex] = {
      ...savedReports[reportIndex],
      name: name || savedReports[reportIndex].name,
      reportType: reportType || savedReports[reportIndex].reportType,
      dateRange: dateRange || savedReports[reportIndex].dateRange,
      groupBy: groupBy || savedReports[reportIndex].groupBy,
      filters: filters || savedReports[reportIndex].filters,
      schedule: schedule !== undefined ? schedule : savedReports[reportIndex].schedule,
      updatedAt: new Date().toISOString(),
    };

    // Update user preferences
    await db.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...preferences,
          savedReports,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ savedReport: savedReports[reportIndex] });
  } catch (error) {
    console.error("Saved Reports PUT error:", error);
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const preferences = (user?.preferences as Record<string, unknown>) || {};
    const savedReports = (preferences.savedReports as SavedReportConfig[]) || [];

    const reportIndex = savedReports.findIndex((r) => r.id === id);

    if (reportIndex === -1) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Remove the report
    savedReports.splice(reportIndex, 1);

    // Update user preferences
    await db.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...preferences,
          savedReports,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Saved Reports DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete report" }, { status: 500 });
  }
}
