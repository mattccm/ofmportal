import { NextRequest, NextResponse } from "next/server";
import { requireAccess, uploadWhere } from "@/lib/access/server";
import { db } from "@/lib/db";
import { generateReviewReport, reportToCsv } from "@/lib/upload-review";

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAccess("requests.export");
    if (gate.error) return gate.error;
    const { access } = gate;

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
    const fullReport = await generateReviewReport(access.agencyId, options);

    // Only uploads from creators this person may see
    const visible = new Set(
      (
        await db.upload.findMany({
          where: { AND: [uploadWhere(access), { id: { in: fullReport.map((r) => r.id) } }] },
          select: { id: true },
        })
      ).map((u) => u.id)
    );
    const report = fullReport.filter((r) => visible.has(r.id));

    // Convert to CSV; the creator email column is dropped when it's hidden
    const csv = access.has("creatorInfo.email") ? reportToCsv(report) : dropCsvColumn(reportToCsv(report), 5);

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

/** Remove one column from CSV text (quoted fields may hold commas, quotes and newlines) */
function dropCsvColumn(csv: string, index: number): string {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (quoted) {
      if (ch === '"' && csv[i + 1] === '"') {
        field += '""';
        i++;
      } else if (ch === '"') {
        quoted = false;
        field += ch;
      } else field += ch;
    } else if (ch === '"') {
      quoted = true;
      field += ch;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows.map((r) => r.filter((_, i) => i !== index).join(",")).join("\n");
}
