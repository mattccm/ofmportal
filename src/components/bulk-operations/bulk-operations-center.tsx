"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  FileCheck,
  RefreshCw,
  Bell,
  History,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Settings,
  Play,
  Keyboard,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { BulkRequestCreator } from "./bulk-request-creator";
import { BulkReviewGrid } from "./bulk-review-grid";
import { BulkStatusUpdater } from "./bulk-status-updater";
import { BulkReminderSender } from "./bulk-reminder-sender";
import { OperationHistory } from "./operation-history";
import { UndoManager, useUndoManager, UndoToast } from "./undo-manager";
import { FloatingShortcutsIndicator, KeyboardShortcutsModal } from "./keyboard-shortcuts-modal";
import type { BulkOperationType, BulkOperationStatus, DEFAULT_PRESETS } from "@/lib/bulk-operations";

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

  // Fetch stats and recent operations
  useEffect(() => {
    async function fetchData() {
      setIsLoadingStats(true);
      try {
        // Fetch stats from multiple endpoints
        const [uploadsRes, remindersOverdueRes, remindersWeekRes] = await Promise.all([
          fetch("/api/uploads?status=PENDING&limit=1"),
          fetch("/api/reminders/bulk-send?filter=overdue"),
          fetch("/api/reminders/bulk-send?filter=due_within_week"),
        ]);

        const uploadData = uploadsRes.ok ? await uploadsRes.json() : { count: 0 };
        const overdueData = remindersOverdueRes.ok ? await remindersOverdueRes.json() : { count: 0 };
        const weekData = remindersWeekRes.ok ? await remindersWeekRes.json() : { count: 0 };

        setStats({
          pendingUploads: uploadData.total || uploadData.count || (uploadData.uploads?.length || 0),
          overdueRequests: overdueData.count || 0,
          dueThisWeek: weekData.count || 0,
          completedToArchive: 0, // Would need separate endpoint
        });

        // Fetch recent operations from activity log
        const activityRes = await fetch("/api/activity?type=bulk&limit=10");
        if (activityRes.ok) {
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
  }, []);

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
      icon: <FileCheck className="h-5 w-5 text-purple-500" />,
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
        return <CheckCircle className="h-4 w-4 text-green-500" />;
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
    toast.success("Operation completed successfully");
    // Refresh stats
    // Would trigger a re-fetch of stats here
  }, []);

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  Pending Reviews
                </p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {isLoadingStats ? "-" : stats.pendingUploads}
                </p>
              </div>
              <FileCheck className="h-8 w-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 border-red-200 dark:border-red-800">
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

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
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

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  Ready to Archive
                </p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {isLoadingStats ? "-" : stats.completedToArchive}
                </p>
              </div>
              <RefreshCw className="h-8 w-8 text-green-500/50" />
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
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Requests</span>
          </TabsTrigger>
          <TabsTrigger value="review" className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Review</span>
            {stats.pendingUploads > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {stats.pendingUploads > 99 ? "99+" : stats.pendingUploads}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="status" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Status</span>
          </TabsTrigger>
          <TabsTrigger value="reminders" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Reminders</span>
            {stats.overdueRequests > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {stats.overdueRequests > 99 ? "99+" : stats.overdueRequests}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
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
