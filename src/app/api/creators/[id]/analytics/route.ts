import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { subDays, startOfDay, format, startOfWeek, endOfWeek } from "date-fns";

// GET - Fetch creator performance analytics
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      select: { id: true, createdAt: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "90d";

    // Calculate date range
    let daysBack = 90;
    if (range === "7d") daysBack = 7;
    else if (range === "30d") daysBack = 30;
    else if (range === "365d") daysBack = 365;

    const startDate = startOfDay(subDays(new Date(), daysBack));
    const previousStartDate = startOfDay(subDays(startDate, daysBack));

    // Get uploads in current period
    const currentPeriodUploads = await db.upload.findMany({
      where: {
        creatorId: id,
        uploadStatus: "COMPLETED",
        uploadedAt: { gte: startDate },
      },
      select: {
        id: true,
        status: true,
        uploadedAt: true,
        fileType: true,
        createdAt: true,
      },
    });

    // Get uploads in previous period for comparison
    const previousPeriodUploads = await db.upload.findMany({
      where: {
        creatorId: id,
        uploadStatus: "COMPLETED",
        uploadedAt: {
          gte: previousStartDate,
          lt: startDate,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    // Calculate upload frequency by week
    const uploadsByWeek: Record<string, { week: string; count: number; approved: number; rejected: number }> = {};
    const weeksInRange = Math.ceil(daysBack / 7);

    for (let i = 0; i < weeksInRange; i++) {
      const weekStart = startOfWeek(subDays(new Date(), i * 7));
      const weekKey = format(weekStart, "yyyy-MM-dd");
      uploadsByWeek[weekKey] = {
        week: format(weekStart, "MMM d"),
        count: 0,
        approved: 0,
        rejected: 0,
      };
    }

    currentPeriodUploads.forEach((upload) => {
      if (upload.uploadedAt) {
        const weekStart = startOfWeek(upload.uploadedAt);
        const weekKey = format(weekStart, "yyyy-MM-dd");
        if (uploadsByWeek[weekKey]) {
          uploadsByWeek[weekKey].count++;
          if (upload.status === "APPROVED") {
            uploadsByWeek[weekKey].approved++;
          } else if (upload.status === "REJECTED") {
            uploadsByWeek[weekKey].rejected++;
          }
        }
      }
    });

    const uploadFrequency = Object.values(uploadsByWeek).reverse();

    // Calculate approval rate over time (monthly)
    const monthlyApprovalRate: { month: string; rate: number; total: number }[] = [];
    const uploadsByMonth: Record<string, { approved: number; total: number }> = {};

    currentPeriodUploads.forEach((upload) => {
      if (upload.uploadedAt) {
        const monthKey = format(upload.uploadedAt, "yyyy-MM");
        if (!uploadsByMonth[monthKey]) {
          uploadsByMonth[monthKey] = { approved: 0, total: 0 };
        }
        uploadsByMonth[monthKey].total++;
        if (upload.status === "APPROVED") {
          uploadsByMonth[monthKey].approved++;
        }
      }
    });

    Object.entries(uploadsByMonth).forEach(([monthKey, data]) => {
      monthlyApprovalRate.push({
        month: format(new Date(monthKey + "-01"), "MMM yyyy"),
        rate: data.total > 0 ? Math.round((data.approved / data.total) * 100) : 0,
        total: data.total,
      });
    });

    // Calculate response time trend (time from request creation to first upload)
    const requestsWithUploads = await db.contentRequest.findMany({
      where: {
        creatorId: id,
        agencyId: session.user.agencyId,
        createdAt: { gte: startDate },
        uploads: { some: {} },
      },
      include: {
        uploads: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    const responseTimesByWeek: Record<string, { times: number[]; week: string }> = {};

    requestsWithUploads.forEach((request) => {
      if (request.uploads[0]) {
        const weekStart = startOfWeek(request.createdAt);
        const weekKey = format(weekStart, "yyyy-MM-dd");
        if (!responseTimesByWeek[weekKey]) {
          responseTimesByWeek[weekKey] = { times: [], week: format(weekStart, "MMM d") };
        }
        const responseTimeHours =
          (request.uploads[0].createdAt.getTime() - request.createdAt.getTime()) / (1000 * 60 * 60);
        responseTimesByWeek[weekKey].times.push(responseTimeHours);
      }
    });

    const responseTimeTrend = Object.values(responseTimesByWeek).map((data) => ({
      week: data.week,
      avgHours:
        data.times.length > 0
          ? Math.round((data.times.reduce((a, b) => a + b, 0) / data.times.length) * 10) / 10
          : 0,
    }));

    // Content type breakdown
    const contentTypeBreakdown: Record<string, number> = {};

    currentPeriodUploads.forEach((upload) => {
      let type = "Other";
      if (upload.fileType.startsWith("image/")) type = "Images";
      else if (upload.fileType.startsWith("video/")) type = "Videos";
      else if (upload.fileType.startsWith("audio/")) type = "Audio";
      else if (
        upload.fileType.includes("pdf") ||
        upload.fileType.includes("document")
      )
        type = "Documents";

      contentTypeBreakdown[type] = (contentTypeBreakdown[type] || 0) + 1;
    });

    const contentTypes = Object.entries(contentTypeBreakdown).map(([type, count]) => ({
      type,
      count,
      percentage: currentPeriodUploads.length > 0
        ? Math.round((count / currentPeriodUploads.length) * 100)
        : 0,
    }));

    // Calculate overall stats
    const currentApproved = currentPeriodUploads.filter((u) => u.status === "APPROVED").length;
    const previousApproved = previousPeriodUploads.filter((u) => u.status === "APPROVED").length;

    const currentApprovalRate =
      currentPeriodUploads.length > 0
        ? Math.round((currentApproved / currentPeriodUploads.length) * 100)
        : 0;
    const previousApprovalRate =
      previousPeriodUploads.length > 0
        ? Math.round((previousApproved / previousPeriodUploads.length) * 100)
        : 0;

    // Daily upload activity for heatmap
    const dailyActivity: { date: string; count: number }[] = [];
    const uploadsByDay: Record<string, number> = {};

    for (let i = 0; i < daysBack; i++) {
      const day = subDays(new Date(), i);
      const dayKey = format(day, "yyyy-MM-dd");
      uploadsByDay[dayKey] = 0;
    }

    currentPeriodUploads.forEach((upload) => {
      if (upload.uploadedAt) {
        const dayKey = format(upload.uploadedAt, "yyyy-MM-dd");
        if (uploadsByDay.hasOwnProperty(dayKey)) {
          uploadsByDay[dayKey]++;
        }
      }
    });

    Object.entries(uploadsByDay).forEach(([date, count]) => {
      dailyActivity.push({ date, count });
    });

    return NextResponse.json({
      overview: {
        totalUploads: currentPeriodUploads.length,
        previousTotalUploads: previousPeriodUploads.length,
        approvalRate: currentApprovalRate,
        previousApprovalRate,
        approved: currentApproved,
        rejected: currentPeriodUploads.filter((u) => u.status === "REJECTED").length,
        pending: currentPeriodUploads.filter((u) => u.status === "PENDING").length,
      },
      uploadFrequency,
      approvalRateOverTime: monthlyApprovalRate,
      responseTimeTrend,
      contentTypeBreakdown: contentTypes,
      dailyActivity: dailyActivity.reverse(),
    });
  } catch (error) {
    console.error("Error fetching creator analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
