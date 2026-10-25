"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  FileCheck,
  RefreshCw,
  Bell,
  History,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useAccess } from "@/lib/access/client";

import { BulkRequestCreator } from "./bulk-request-creator";
import { BulkReviewGrid } from "./bulk-review-grid";
import { BulkStatusUpdater } from "./bulk-status-updater";
import { BulkReminderSender } from "./bulk-reminder-sender";
import { OperationHistory } from "./operation-history";
import { UndoManager, useUndoManager, UndoToast } from "./undo-manager";
import { FloatingShortcutsIndicator, KeyboardShortcutsModal } from "./keyboard-shortcuts-modal";
import type { BulkOperationType, BulkOperationStatus } from "@/lib/bulk-operations";

// Types
interface RecentOperation {
  id: string;
  type: BulkOperationType;
  status: BulkOperationStatus;
  totalItems: number;
  successCount: number;
  failedCount: number;
  startedAt: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

interface OperationStats {
  pendingUploads: number;
  overdueRequests: number;
  dueThisWeek: number;
  completedToArchive: number;
}

type TabValue = "requests" | "review" | "status" | "reminders" | "history";

export function BulkOperationsCenter() {
  const [activeTab, setActiveTab] = useState<TabValue>("requests");
  const [recentOperations, setRecentOperations] = useState<RecentOperation[]>([]);
  const [stats, setStats] = useState<OperationStats>({
    pendingUploads: 0,
    overdueRequests: 0,
    dueThisWeek: 0,
    completedToArchive: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Undo manager
  const undoManager = useUndoManager();
  const { can } = useAccess();
  const canUploads = can("review.view");
  const canReminders = can("reminders.view");
  const canActivity = can("activity.view");

  // Fetch stats and recent operations
  useEffect(() => {
    async function fetchData() {
      setIsLoadingStats(true);
      try {
        // Fetch stats from multiple endpoints
        // Only ask for what the role can see (each API answers 403 otherwise)
        const [uploadsRes, remindersOverdueRes, remindersWeekRes] = await Promise.all([
          canUploads ? fetch("/api/uploads?status=PENDING&limit=1") : null,
          canReminders ? fetch("/api/reminders/bulk-send?filter=overdue") : null,
          canReminders ? fetch("/api/reminders/bulk-send?filter=due_within_week") : null,
        ]);

        const uploadData = uploadsRes?.ok ? await uploadsRes.json() : { count: 0 };
        const overdueData = remindersOverdueRes?.ok ? await remindersOverdueRes.json() : { count: 0 };
        const weekData = remindersWeekRes?.ok ? await remindersWeekRes.json() : { count: 0 };

        setStats({
          pendingUploads: uploadData.total || uploadData.count || (uploadData.uploads?.length || 0),
          overdueRequests: overdueData.count || 0,
          dueThisWeek: weekData.count || 0,
          completedToArchive: 0, // Would need separate endpoint
        });

        // Fetch recent operations from activity log
        const activityRes = canActivity ? await fetch("/api/activity?type=bulk&limit=10") : null;
        if (activityRes?.ok) {
          const activityData = await activityRes.json();
          // Transform activity logs to operation format
          const operations: RecentOperation[] = (activityData.activities || [])
            .filter((a: { action: string }) => a.action.includes("bulk"))
            .map((a: { id: string; action: string; metadata?: Record<string, unknown>; createdAt: string }) => ({
              id: a.id,
              type: getOperationType(a.action),
              status: "completed" as BulkOperationStatus,
              totalItems: (a.metadata as Record<string, number>)?.totalRequests || 0,
              successCount: (a.metadata as Record<string, number>)?.successCount || 0,
              failedCount: (a.metadata as Record<string, number>)?.failedCount || 0,
              startedAt: a.createdAt,
              metadata: a.metadata,
            }));
          setRecentOperations(operations);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setIsLoadingStats(false);
      }
    }

    fetchData();
  }, [canUploads, canReminders, canActivity]);

  // Helper to get operation type from action string
  const getOperationType = (action: string): BulkOperationType => {
    if (action.includes("Create")) return "request_create";
    if (action.includes("review")) return "upload_review";
    if (action.includes("status") || action.includes("archive")) return "status_update";
    if (action.includes("reminder")) return "reminder_send";
    return "request_create";
  };

  // Quick actions based on stats
  const quickActions: QuickAction[] = [
    {
      id: "review-pending",
      label: "Review Pending Uploads",
      description: `${stats.pendingUploads} uploads waiting for review`,
      icon: <FileCheck className="h-5 w-5 text-foreground" />,
      action: () => setActiveTab("review"),
      badge: stats.pendingUploads > 0 ? String(stats.pendingUploads) : undefined,
      badgeVariant: "default",
    },
    {
      id: "remind-overdue",
      label: "Send Overdue Reminders",
      description: `${stats.overdueRequests} requests are overdue`,
      icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
      action: () => setActiveTab("reminders"),
      badge: stats.overdueRequests > 0 ? String(stats.overdueRequests) : undefined,
      badgeVariant: "destructive",
    },
    {
      id: "remind-week",
      label: "Remind Due This Week",
      description: `${stats.dueThisWeek} requests due within 7 days`,
      icon: <Clock className="h-5 w-5 text-amber-500" />,
      action: () => setActiveTab("reminders"),
      badge: stats.dueThisWeek > 0 ? String(stats.dueThisWeek) : undefined,
      badgeVariant: "secondary",
    },
    {
      id: "create-requests",
      label: "Create Bulk Requests",
      description: "Send requests to multiple creators at once",
      icon: <Users className="h-5 w-5 text-blue-500" />,
      action: () => setActiveTab("requests"),
    },
  ];

  // Get operation type label
  const getOperationTypeLabel = (type: BulkOperationType): string => {
    switch (type) {
      case "request_create":
        return "Request Creation";
      case "upload_review":
        return "Upload Review";
      case "status_update":
        return "Status Update";
      case "reminder_send":
        return "Reminders Sent";
      case "archive":
        return "Archive";
      default:
        return type;
    }
  };

  // Get status icon
  const getStatusIcon = (status: BulkOperationStatus) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "partially_completed":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  // Handle operation complete
  const handleOperationComplete = useCallback(() => {
    toast.success("All done");
    // Refresh stats
    // Would trigger a re-fetch of stats here
  }, []);

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className=" bg-tile-hi dark:bg-tile-hi border-line dark:border-line">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground dark:text-foreground">
                  Pending Reviews
                </p>
                <p className="text-2xl font-bold text-foreground dark:text-foreground">
                  {isLoadingStats ? "-" : stats.pendingUploads}
                </p>
              </div>
              <FileCheck className="h-8 w-8 text-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className=" bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                  Overdue
                </p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {isLoadingStats ? "-" : stats.overdueRequests}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className=" bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  Due This Week
                </p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {isLoadingStats ? "-" : stats.dueThisWeek}
                </p>
              </div>
              <Clock className="h-8 w-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className=" bg-success/10 dark:bg-success/30 border-success/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-success">
                  Ready to Archive
                </p>
                <p className="text-2xl font-bold text-success">
                  {isLoadingStats ? "-" : stats.completedToArchive}
                </p>
              </div>
              <RefreshCw className="h-8 w-8 text-success/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                className="h-auto p-4 flex flex-col items-start text-left justify-start relative"
                onClick={action.action}
              >
                {action.badge && (
                  <Badge
                    variant={action.badgeVariant}
                    className="absolute top-2 right-2"
                  >
                    {action.badge}
                  </Badge>
                )}
                <div className="flex items-center gap-2 mb-2">
                  {action.icon}
                  <span className="font-medium">{action.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {action.description}
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main content tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger aria-label="Requests" value="requests" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Requests</span>
          </TabsTrigger>
          <TabsTrigger aria-label={stats.pendingUploads > 0 ? `Review, ${stats.pendingUploads} pending` : "Review"} value="review" className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Review</span>
            {stats.pendingUploads > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {stats.pendingUploads > 99 ? "99+" : stats.pendingUploads}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger aria-label="Status" value="status" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Status</span>
          </TabsTrigger>
          <TabsTrigger aria-label={stats.overdueRequests > 0 ? `Reminders, ${stats.overdueRequests} overdue` : "Reminders"} value="reminders" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Reminders</span>
            {stats.overdueRequests > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {stats.overdueRequests > 99 ? "99+" : stats.overdueRequests}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger aria-label="History" value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="requests" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Request Creation</CardTitle>
                <CardDescription>
                  Create multiple content requests at once for different creators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BulkRequestCreator onComplete={handleOperationComplete} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="review" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Review</CardTitle>
                <CardDescription>
                  Review and approve/reject multiple uploads efficiently with keyboard shortcuts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BulkReviewGrid onComplete={handleOperationComplete} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Status Updates</CardTitle>
                <CardDescription>
                  Change the status of multiple requests at once or archive old completed requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BulkStatusUpdater onComplete={handleOperationComplete} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reminders" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Reminders</CardTitle>
                <CardDescription>
                  Send reminders to multiple creators based on request status and due dates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BulkReminderSender onComplete={handleOperationComplete} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Operation History</CardTitle>
                <CardDescription>
                  Recent bulk operations performed on this account. Operations can be undone within 5 minutes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Undoable operations */}
                {undoManager.hasUndoableOperations && (
                  <div className="mb-6">
                    <UndoManager />
                  </div>
                )}

                {/* Full operation history */}
                <OperationHistory />
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      {/* Floating keyboard shortcuts indicator */}
      {activeTab === "review" && (
        <FloatingShortcutsIndicator onShowHelp={() => setShowKeyboardShortcuts(true)} />
      )}

      {/* Keyboard shortcuts modal */}
      <KeyboardShortcutsModal
        open={showKeyboardShortcuts}
        onOpenChange={setShowKeyboardShortcuts}
      />

      {/* Undo toasts for recent operations */}
      {undoManager.operations.slice(0, 1).map((operation) => (
        <UndoToast
          key={operation.operationId}
          operation={operation}
          onUndo={async () => {
            await undoManager.executeUndo(operation.operationId, async () => {
              const response = await fetch("/api/bulk-operations/undo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  operationId: operation.operationId,
                  type: operation.type,
                  affectedIds: operation.affectedIds,
                  previousStates: operation.previousStates,
                }),
              });
              return response.ok;
            });
          }}
          onDismiss={() => undoManager.removeOperation(operation.operationId)}
          isProcessing={undoManager.processingId === operation.operationId}
        />
      ))}
    </div>
  );
}

export default BulkOperationsCenter;
