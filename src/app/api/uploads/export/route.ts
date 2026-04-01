import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateReviewReport, reportToCsv } from "@/lib/upload-review";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    // Parse filter options
    const ids = searchParams.get("ids");
    const status = searchParams.get("status");
    const creator = searchParams.get("creator");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const options: {
      uploadIds?: string[];
      status?: string;
      creatorId?: string;
      dateFrom?: Date;
      dateTo?: Date;
    } = {};

    if (ids) {
      options.uploadIds = ids.split(",").filter(Boolean);
    }

    if (status) {
      options.status = status;
    }

    if (creator) {
      options.creatorId = creator;
    }

    if (dateFrom) {
      options.dateFrom = new Date(dateFrom);
    }

    if (dateTo) {
      options.dateTo = new Date(dateTo);
    }

    // Generate report
    const report = await generateReviewReport(session.user.agencyId, options);

    // Convert to CSV
    const csv = reportToCsv(report);

    // Return as CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="uploads-export.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting uploads:", error);
    return NextResponse.json(
      { error: "Failed to export uploads" },
      { status: 500 }
    );
  }
}
