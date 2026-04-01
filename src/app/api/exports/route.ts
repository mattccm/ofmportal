import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Types
interface ExportFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  creatorIds?: string[];
  statuses?: string[];
  conditions?: FilterCondition[];
}

interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

type EntityType = "creators" | "requests" | "uploads" | "analytics";
type ExportFormat = "csv" | "excel" | "json" | "pdf";
type FilterOperator = "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";

interface ExportHistoryItem {
  id: string;
  name: string;
  entity: EntityType;
  format: ExportFormat;
  recordCount: number;
  fileSize: string;
  status: "completed" | "processing" | "failed";
  createdAt: string;
  downloadUrl?: string;
  expiresAt?: string;
}

interface ScheduledExport {
  id: string;
  name: string;
  entity: EntityType;
  format: ExportFormat;
  frequency: "daily" | "weekly" | "monthly";
  recipients: string[];
  nextRunAt: string;
  lastRunAt?: string;
  isActive: boolean;
}

// In-memory storage for demo (in production, use database)
const exportHistory: Map<string, ExportHistoryItem[]> = new Map();
const scheduledExports: Map<string, ScheduledExport[]> = new Map();

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// Helper function to convert data to CSV
function toCSV(data: Record<string, unknown>[], fields: string[]): string {
  if (data.length === 0) return fields.join(",") + "\n";

  const headers = fields.join(",");
  const rows = data.map((row) =>
    fields
      .map((field) => {
        const value = row[field];
        if (value === null || value === undefined) return "";
        if (typeof value === "string") {
          // Escape quotes and wrap in quotes if contains comma or newline
          const escaped = value.replace(/"/g, '""');
          if (escaped.includes(",") || escaped.includes("\n") || escaped.includes('"')) {
            return `"${escaped}"`;
          }
          return escaped;
        }
        if (value instanceof Date) return value.toISOString();
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
      })
      .join(",")
  );

  return headers + "\n" + rows.join("\n");
}

// Helper function to convert data to JSON
function toJSON(data: Record<string, unknown>[], fields: string[]): string {
  const filteredData = data.map((row) => {
    const filtered: Record<string, unknown> = {};
    fields.forEach((field) => {
      filtered[field] = row[field];
    });
    return filtered;
  });
  return JSON.stringify(filteredData, null, 2);
}

// Helper function to build where clause from filters
function buildWhereClause(
  filters: ExportFilters,
  entity: EntityType,
  agencyId: string
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  // Add agency filter for relevant entities
  if (entity === "creators" || entity === "requests") {
    where.agencyId = agencyId;
  }

  // Date range filter
  if (filters.dateRange) {
    const dateFilter: Record<string, Date> = {};
    if (filters.dateRange.start) {
      dateFilter.gte = new Date(filters.dateRange.start);
    }
    if (filters.dateRange.end) {
      dateFilter.lte = new Date(filters.dateRange.end);
    }
    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter;
    }
  }

  // Creator IDs filter
  if (filters.creatorIds && filters.creatorIds.length > 0) {
    if (entity === "requests" || entity === "uploads") {
      where.creatorId = { in: filters.creatorIds };
    }
  }

  // Status filter
  if (filters.statuses && filters.statuses.length > 0) {
    if (entity === "requests") {
      where.status = { in: filters.statuses };
    } else if (entity === "uploads") {
      where.status = { in: filters.statuses };
    }
  }

  // Custom conditions
  if (filters.conditions && filters.conditions.length > 0) {
    filters.conditions.forEach((condition) => {
      const fieldWhere = buildConditionWhere(condition);
      if (fieldWhere) {
        where[condition.field] = fieldWhere;
      }
    });
  }

  return where;
}

function buildConditionWhere(condition: FilterCondition): unknown {
  const { operator, value } = condition;

  switch (operator) {
    case "equals":
      return value;
    case "not_equals":
      return { not: value };
    case "contains":
      return { contains: value, mode: "insensitive" };
    case "greater_than":
      return { gt: isNaN(Number(value)) ? value : Number(value) };
    case "less_than":
      return { lt: isNaN(Number(value)) ? value : Number(value) };
    case "is_empty":
      return { equals: null };
    case "is_not_empty":
      return { not: null };
    default:
      return null;
  }
}

// Fetch data based on entity type
async function fetchEntityData(
  entity: EntityType,
  agencyId: string,
  filters: ExportFilters,
  fields: string[]
): Promise<Record<string, unknown>[]> {
  const where = buildWhereClause(filters, entity, agencyId);

  switch (entity) {
    case "creators": {
      const creators = await db.creator.findMany({
        where: { agencyId, ...where },
        include: {
          _count: {
            select: { requests: true, uploads: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return creators.map((creator) => ({
        id: creator.id,
        name: creator.name,
        email: creator.email,
        phone: creator.phone || "",
        inviteStatus: creator.inviteStatus,
        preferredContact: creator.preferredContact,
        timezone: creator.timezone,
        lastLoginAt: creator.lastLoginAt?.toISOString() || "",
        createdAt: creator.createdAt.toISOString(),
        updatedAt: creator.updatedAt.toISOString(),
        totalRequests: creator._count.requests,
        totalUploads: creator._count.uploads,
      }));
    }

    case "requests": {
      const requests = await db.contentRequest.findMany({
        where: { agencyId, ...where },
        include: {
          creator: { select: { name: true, email: true } },
          _count: {
            select: { uploads: true, comments: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return requests.map((request) => ({
        id: request.id,
        title: request.title,
        description: request.description || "",
        creatorName: request.creator.name,
        creatorEmail: request.creator.email,
        status: request.status,
        urgency: request.urgency,
        dueDate: request.dueDate?.toISOString() || "",
        submittedAt: request.submittedAt?.toISOString() || "",
        reviewedAt: request.reviewedAt?.toISOString() || "",
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        uploadCount: request._count.uploads,
        commentCount: request._count.comments,
      }));
    }

    case "uploads": {
      const uploads = await db.upload.findMany({
        where: {
          request: { agencyId },
          ...where,
        },
        include: {
          creator: { select: { name: true, email: true } },
          request: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return uploads.map((upload) => ({
        id: upload.id,
        fileName: upload.fileName,
        originalName: upload.originalName,
        fileType: upload.fileType,
        fileSize: Number(upload.fileSize),
        creatorName: upload.creator.name,
        creatorEmail: upload.creator.email,
        requestTitle: upload.request.title,
        uploadStatus: upload.uploadStatus,
        approvalStatus: upload.status,
        reviewNote: upload.reviewNote || "",
        rating: upload.rating || 0,
        uploadedAt: upload.uploadedAt?.toISOString() || "",
        createdAt: upload.createdAt.toISOString(),
      }));
    }

    case "analytics": {
      // Generate analytics data for the date range
      const dateFilter: Record<string, Date | undefined> = {};
      if (filters.dateRange?.start) {
        dateFilter.gte = new Date(filters.dateRange.start);
      }
      if (filters.dateRange?.end) {
        dateFilter.lte = new Date(filters.dateRange.end);
      }

      const startDate = filters.dateRange?.start
        ? new Date(filters.dateRange.start)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = filters.dateRange?.end
        ? new Date(filters.dateRange.end)
        : new Date();

      // Get summary counts
      const [
        totalRequests,
        completedRequests,
        pendingRequests,
        totalUploads,
        approvedUploads,
        rejectedUploads,
        activeCreators,
        newCreators,
      ] = await Promise.all([
        db.contentRequest.count({
          where: {
            agencyId,
            createdAt: dateFilter.gte || dateFilter.lte ? dateFilter : undefined,
          },
        }),
        db.contentRequest.count({
          where: {
            agencyId,
            status: "APPROVED",
            createdAt: dateFilter.gte || dateFilter.lte ? dateFilter : undefined,
          },
        }),
        db.contentRequest.count({
          where: {
            agencyId,
            status: "PENDING",
            createdAt: dateFilter.gte || dateFilter.lte ? dateFilter : undefined,
          },
        }),
        db.upload.count({
          where: {
            request: { agencyId },
            createdAt: dateFilter.gte || dateFilter.lte ? dateFilter : undefined,
          },
        }),
        db.upload.count({
          where: {
            request: { agencyId },
            status: "APPROVED",
            createdAt: dateFilter.gte || dateFilter.lte ? dateFilter : undefined,
          },
        }),
        db.upload.count({
          where: {
            request: { agencyId },
            status: "REJECTED",
            createdAt: dateFilter.gte || dateFilter.lte ? dateFilter : undefined,
          },
        }),
        db.creator.count({
          where: {
            agencyId,
            lastLoginAt: { gte: startDate },
          },
        }),
        db.creator.count({
          where: {
            agencyId,
            createdAt: dateFilter.gte || dateFilter.lte ? dateFilter : undefined,
          },
        }),
      ]);

      const approvalRate = totalUploads > 0
        ? Math.round((approvedUploads / totalUploads) * 100)
        : 0;

      return [
        {
          period: `${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`,
          totalRequests,
          completedRequests,
          pendingRequests,
          totalUploads,
          approvedUploads,
          rejectedUploads,
          avgResponseTime: 24, // Placeholder
          avgApprovalRate: approvalRate,
          activeCreators,
          newCreators,
        },
      ];
    }

    default:
      return [];
  }
}

// GET endpoint for fetching export history and scheduled exports
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agencyId = session.user.agencyId;
    const type = request.nextUrl.searchParams.get("type");

    if (type === "history") {
      const history = exportHistory.get(agencyId) || [];
      return NextResponse.json({ history });
    }

    if (type === "scheduled") {
      const scheduled = scheduledExports.get(agencyId) || [];
      return NextResponse.json({ scheduled });
    }

    return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
  } catch (error) {
    console.error("Export API GET error:", error);
    return NextResponse.json({ error: "Failed to fetch exports" }, { status: 500 });
  }
}

// POST endpoint for generating exports and creating schedules
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agencyId = session.user.agencyId;
    const body = await request.json();

    // Handle scheduled export creation
    if (body.type === "schedule") {
      const { name, entity, fields, filters, format, frequency, recipients } = body;

      const schedule: ScheduledExport = {
        id: crypto.randomUUID(),
        name,
        entity,
        format,
        frequency,
        recipients,
        nextRunAt: calculateNextRunDate(frequency).toISOString(),
        isActive: true,
      };

      const existing = scheduledExports.get(agencyId) || [];
      scheduledExports.set(agencyId, [...existing, schedule]);

      return NextResponse.json({ success: true, schedule });
    }

    // Handle export generation
    const { entity, fields, filters, format, name } = body as {
      entity: EntityType;
      fields: string[];
      filters: ExportFilters;
      format: ExportFormat;
      name?: string;
    };

    if (!entity || !fields || fields.length === 0 || !format) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Fetch data
    const data = await fetchEntityData(entity, agencyId, filters || {}, fields);

    // Convert to requested format
    let content: string;
    let contentType: string;
    let fileExtension: string;

    switch (format) {
      case "csv":
        content = toCSV(data, fields);
        contentType = "text/csv";
        fileExtension = "csv";
        break;
      case "excel":
        // For Excel, we'll use CSV format with proper encoding
        // In production, use a library like xlsx
        content = toCSV(data, fields);
        contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        fileExtension = "xlsx";
        break;
      case "json":
        content = toJSON(data, fields);
        contentType = "application/json";
        fileExtension = "json";
        break;
      case "pdf":
        // For PDF, return JSON data (in production, use a PDF library)
        content = toJSON(data, fields);
        contentType = "application/json";
        fileExtension = "json";
        break;
      default:
        content = toCSV(data, fields);
        contentType = "text/csv";
        fileExtension = "csv";
    }

    // Add to export history
    const historyItem: ExportHistoryItem = {
      id: crypto.randomUUID(),
      name: name || `${entity}-export`,
      entity,
      format,
      recordCount: data.length,
      fileSize: formatFileSize(content.length),
      status: "completed",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    const existing = exportHistory.get(agencyId) || [];
    exportHistory.set(agencyId, [historyItem, ...existing.slice(0, 49)]); // Keep last 50

    // Return the file
    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${entity}-export-${new Date().toISOString().split("T")[0]}.${fileExtension}"`,
      },
    });
  } catch (error) {
    console.error("Export API POST error:", error);
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 });
  }
}

// PATCH endpoint for updating scheduled exports
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agencyId = session.user.agencyId;
    const { id, isActive } = await request.json();

    const schedules = scheduledExports.get(agencyId) || [];
    const index = schedules.findIndex((s) => s.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    schedules[index] = { ...schedules[index], isActive };
    scheduledExports.set(agencyId, schedules);

    return NextResponse.json({ success: true, schedule: schedules[index] });
  } catch (error) {
    console.error("Export API PATCH error:", error);
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
  }
}

// DELETE endpoint for deleting scheduled exports
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agencyId = session.user.agencyId;
    const id = request.nextUrl.searchParams.get("id");
    const type = request.nextUrl.searchParams.get("type");

    if (!id) {
      return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    if (type === "scheduled") {
      const schedules = scheduledExports.get(agencyId) || [];
      scheduledExports.set(
        agencyId,
        schedules.filter((s) => s.id !== id)
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Export API DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

// Helper function to calculate next run date for scheduled exports
function calculateNextRunDate(frequency: "daily" | "weekly" | "monthly"): Date {
  const now = new Date();
  switch (frequency) {
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "monthly":
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return nextMonth;
    default:
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
}
