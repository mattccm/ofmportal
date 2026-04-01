import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const getAuditLogQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  search: z.string().optional(),
  userId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.enum(["createdAt", "action", "entityType"]).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  export: z.enum(["csv"]).optional(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function escapeCSVField(field: string | null | undefined): string {
  if (field === null || field === undefined) return "";
  const stringField = String(field);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (stringField.includes(",") || stringField.includes('"') || stringField.includes("\n")) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  return stringField;
}

function formatDateForCSV(date: Date): string {
  return date.toISOString();
}

// ============================================
// GET - Fetch audit logs with pagination, filtering, and search
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only ADMIN and OWNER can access audit logs
    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const queryParams = {
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
      search: searchParams.get("search") || undefined,
      userId: searchParams.get("userId") || undefined,
      action: searchParams.get("action") || undefined,
      entityType: searchParams.get("entityType") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
      sortOrder: searchParams.get("sortOrder") || undefined,
      export: searchParams.get("export") || undefined,
    };

    const validatedQuery = getAuditLogQuerySchema.parse(queryParams);

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    // Search across action, entityType, entityId
    if (validatedQuery.search) {
      where.OR = [
        { action: { contains: validatedQuery.search, mode: "insensitive" } },
        { entityType: { contains: validatedQuery.search, mode: "insensitive" } },
        { entityId: { contains: validatedQuery.search, mode: "insensitive" } },
        { ipAddress: { contains: validatedQuery.search, mode: "insensitive" } },
      ];
    }

    // Filter by user
    if (validatedQuery.userId) {
      where.userId = validatedQuery.userId;
    }

    // Filter by action type
    if (validatedQuery.action) {
      where.action = validatedQuery.action;
    }

    // Filter by entity type
    if (validatedQuery.entityType) {
      where.entityType = validatedQuery.entityType;
    }

    // Date range filters
    if (validatedQuery.startDate || validatedQuery.endDate) {
      where.createdAt = {};
      if (validatedQuery.startDate) {
        where.createdAt.gte = new Date(validatedQuery.startDate);
      }
      if (validatedQuery.endDate) {
        // Set end date to end of day
        const endDate = new Date(validatedQuery.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    // Build order by clause
    const orderBy = {
      [validatedQuery.sortBy]: validatedQuery.sortOrder,
    };

    // Export to CSV
    if (validatedQuery.export === "csv") {
      // Fetch all matching records for export (with reasonable limit)
      const logs = await db.activityLog.findMany({
        where,
        orderBy,
        take: 10000, // Max 10k records for export
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Build CSV
      const headers = [
        "ID",
        "Timestamp",
        "User ID",
        "User Name",
        "User Email",
        "Action",
        "Entity Type",
        "Entity ID",
        "IP Address",
        "User Agent",
        "Metadata",
      ];

      const csvRows = [headers.join(",")];

      for (const log of logs) {
        const row = [
          escapeCSVField(log.id),
          escapeCSVField(formatDateForCSV(log.createdAt)),
          escapeCSVField(log.userId),
          escapeCSVField(log.user?.name),
          escapeCSVField(log.user?.email),
          escapeCSVField(log.action),
          escapeCSVField(log.entityType),
          escapeCSVField(log.entityId),
          escapeCSVField(log.ipAddress),
          escapeCSVField(log.userAgent),
          escapeCSVField(JSON.stringify(log.metadata)),
        ];
        csvRows.push(row.join(","));
      }

      const csvContent = csvRows.join("\n");

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // Calculate pagination
    const skip = (validatedQuery.page - 1) * validatedQuery.limit;
    const take = validatedQuery.limit;

    // Fetch logs with pagination
    const [logs, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      }),
      db.activityLog.count({ where }),
    ]);

    // Get unique action types and entity types for filters
    const [actionTypes, entityTypes, users] = await Promise.all([
      db.activityLog.findMany({
        distinct: ["action"],
        select: { action: true },
        orderBy: { action: "asc" },
      }),
      db.activityLog.findMany({
        distinct: ["entityType"],
        select: { entityType: true },
        orderBy: { entityType: "asc" },
      }),
      db.activityLog.findMany({
        distinct: ["userId"],
        where: { userId: { not: null } },
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / validatedQuery.limit);

    return NextResponse.json({
      logs,
      pagination: {
        page: validatedQuery.page,
        limit: validatedQuery.limit,
        total,
        totalPages,
        hasMore: validatedQuery.page < totalPages,
      },
      filters: {
        actionTypes: actionTypes.map((a) => a.action),
        entityTypes: entityTypes.map((e) => e.entityType),
        users: users
          .filter((u) => u.user !== null)
          .map((u) => ({
            id: u.user!.id,
            name: u.user!.name,
            email: u.user!.email,
          })),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
