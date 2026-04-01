import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  type BulkOperationHistoryEntry,
  type BulkOperationType,
  type BulkOperationStatus,
  MAX_HISTORY_ENTRIES,
} from "@/lib/bulk-operations";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as BulkOperationType | null;
    const status = searchParams.get("status") as BulkOperationStatus | null;
    const limit = parseInt(searchParams.get("limit") || String(MAX_HISTORY_ENTRIES));
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query filters
    const whereClause: Record<string, unknown> = {
      action: {
        startsWith: "bulk",
      },
    };

    // Get activity logs that represent bulk operations
    const activities = await db.activityLog.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
      take: Math.min(limit, MAX_HISTORY_ENTRIES),
      skip: offset,
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

    // Transform activity logs to history entries
    const history: BulkOperationHistoryEntry[] = activities.map((activity) => {
      const metadata = activity.metadata as Record<string, unknown> || {};

      // Determine operation type from action
      let operationType: BulkOperationType = "status_update";
      if (activity.action.includes("Create") || activity.action.includes("create")) {
        operationType = "request_create";
      } else if (activity.action.includes("review") || activity.action.includes("approved") || activity.action.includes("rejected")) {
        operationType = "upload_review";
      } else if (activity.action.includes("reminder")) {
        operationType = "reminder_send";
      } else if (activity.action.includes("archive")) {
        operationType = "archive";
      }

      // Determine status
      let operationStatus: BulkOperationStatus = "completed";
      const failedCount = (metadata.failedCount as number) || 0;
      const successCount = (metadata.successCount as number) || (metadata.count as number) || 0;
      const totalCount = (metadata.totalRequests as number) || (metadata.count as number) || 0;

      if (failedCount > 0 && successCount > 0) {
        operationStatus = "partially_completed";
      } else if (failedCount > 0 && successCount === 0) {
        operationStatus = "failed";
      }

      if (metadata.undone) {
        operationStatus = "rolled_back";
      }

      return {
        id: activity.id,
        operationId: (metadata.operationId as string) || activity.id,
        type: operationType,
        status: operationStatus,
        totalItems: totalCount || successCount + failedCount,
        successCount: successCount,
        failedCount: failedCount,
        startedAt: activity.createdAt.toISOString(),
        completedAt: activity.createdAt.toISOString(), // Activity log doesn't track duration
        durationMs: (metadata.durationMs as number) || undefined,
        executedBy: {
          id: activity.user?.id || activity.userId || "unknown",
          name: activity.user?.name || "Unknown",
          email: activity.user?.email || "",
        },
        affectedItems: ((metadata.affectedItems as unknown[]) || []).map((item: unknown) => {
          if (typeof item === "object" && item !== null) {
            return item as { id: string; name: string; previousState?: unknown; newState?: unknown };
          }
          return { id: String(item), name: String(item) };
        }),
        canUndo: (metadata.canUndo as boolean) || false,
        undoExpiresAt: metadata.undoExpiresAt as string | undefined,
        undoneAt: metadata.undoneAt as string | undefined,
        metadata: metadata,
        errors: metadata.errors as string[] | undefined,
      };
    });

    // Apply type and status filters
    let filteredHistory = history;
    if (type) {
      filteredHistory = filteredHistory.filter((h) => h.type === type);
    }
    if (status) {
      filteredHistory = filteredHistory.filter((h) => h.status === status);
    }

    return NextResponse.json({
      history: filteredHistory,
      total: filteredHistory.length,
      hasMore: activities.length === limit,
    });
  } catch (error) {
    console.error("Error fetching bulk operation history:", error);
    return NextResponse.json(
      { error: "Failed to fetch operation history" },
      { status: 500 }
    );
  }
}
