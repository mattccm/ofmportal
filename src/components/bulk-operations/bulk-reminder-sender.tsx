"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Mail,
  MessageSquare,
  Clock,
  AlertTriangle,
  Calendar,
  Send,
  Loader2,
  Eye,
  User,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ProgressTracker } from "./progress-tracker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OperationTemplates } from "./operation-templates";
import { cn } from "@/lib/utils";
import type { ReminderFilter } from "@/lib/bulk-operations";

// Types
interface ReminderPreviewRequest {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  daysUntilDue: number | null;
  creator: {
    id: string;
    name: string;
    email: string;
    hasPhone: boolean;
    preferredContact: string;
  };
}

interface BulkReminderSenderProps {
  onComplete?: (result: ReminderResult) => void;
  onCancel?: () => void;
}

interface ReminderResult {
  operationId: string;
  sent: number;
  failed: number;
  total: number;
}

const FILTER_OPTIONS: { value: ReminderFilter; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "overdue",
    label: "Overdue",
    description: "Requests past their due date",
    icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
  },
  {
    value: "due_within_24h",
    label: "Due within 24 hours",
    description: "Requests due very soon",
    icon: <Clock className="h-5 w-5 text-orange-500" />,
  },
  {
    value: "due_within_48h",
    label: "Due within 48 hours",
    description: "Requests due in the next 2 days",
    icon: <Clock className="h-5 w-5 text-amber-500" />,
  },
  {
    value: "due_within_week",
    label: "Due within a week",
    description: "Requests due in the next 7 days",
    icon: <Calendar className="h-5 w-5 text-yellow-500" />,
  },
  {
    value: "no_activity_7d",
    label: "No activity (7 days)",
    description: "Requests with no updates in 7 days",
    icon: <RefreshCw className="h-5 w-5 text-gray-500" />,
  },
];

export function BulkReminderSender({
  onComplete,
  onCancel,
}: BulkReminderSenderProps) {
  // Filter states
  const [selectedFilter, setSelectedFilter] = useState<ReminderFilter>("overdue");

  // Preview states
  const [previewRequests, setPreviewRequests] = useState<ReminderPreviewRequest[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Channel states
  const [enableEmail, setEnableEmail] = useState(true);
  const [enableSms, setEnableSms] = useState(false);
  const [customMessage, setCustomMessage] = useState("");

  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processResult, setProcessResult] = useState<ReminderResult | null>(null);

  // Confirm dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Load preview when filter changes
  const loadPreview = useCallback(async () => {
    setIsLoadingPreview(true);
    try {
      const response = await fetch(`/api/reminders/bulk-send?filter=${selectedFilter}`);
      if (response.ok) {
        const data = await response.json();
        setPreviewRequests(data.requests || []);
        // Auto-select all
        setSelectedIds(new Set((data.requests || []).map((r: ReminderPreviewRequest) => r.id)));
      }
    } catch (error) {
      console.error("Failed to load preview:", error);
      toast.error("Failed to load requests");
    } finally {
      setIsLoadingPreview(false);
    }
  }, [selectedFilter]);

  // Load preview on filter change
  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  // Toggle selection
  const toggleSelection = useCallback((requestId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  }, []);

  // Select all / none
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(previewRequests.map((r) => r.id)));
  }, [previewRequests]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Get selected channels
  const selectedChannels = useMemo(() => {
    const channels: ("email" | "sms")[] = [];
    if (enableEmail) channels.push("email");
    if (enableSms) channels.push("sms");
    return channels;
  }, [enableEmail, enableSms]);

  // Creators who can receive SMS
  const smsEligibleCount = useMemo(() => {
    return previewRequests.filter(
      (r) =>
        selectedIds.has(r.id) &&
        r.creator.hasPhone &&
        (r.creator.preferredContact === "SMS" || r.creator.preferredContact === "BOTH")
    ).length;
  }, [previewRequests, selectedIds]);

  // Send reminders
  const sendReminders = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error("No requests selected");
      return;
    }

    if (selectedChannels.length === 0) {
      toast.error("Please select at least one channel");
      return;
    }

    setShowConfirmDialog(false);
    setIsProcessing(true);
    setProcessProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProcessProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch("/api/reminders/bulk-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filter: "custom",
          requestIds: Array.from(selectedIds),
          channels: selectedChannels,
          message: customMessage || undefined,
        }),
      });

      clearInterval(progressInterval);
      setProcessProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send reminders");
      }

      const result: ReminderResult = {
        operationId: data.operationId,
        sent: data.sent,
        failed: data.failed,
        total: data.total,
      };

      setProcessResult(result);

      if (data.sent > 0) {
        toast.success(`Sent ${data.sent} reminder(s)`);
      }
      if (data.failed > 0) {
        toast.error(`Failed to send ${data.failed} reminder(s)`);
      }

      onComplete?.(result);
    } catch (error) {
      console.error("Failed to send reminders:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send reminders");
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, selectedChannels, customMessage, onComplete]);

  // Get due date badge
  const getDueDateBadge = (daysUntilDue: number | null) => {
    if (daysUntilDue === null) return null;

    if (daysUntilDue < 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          {Math.abs(daysUntilDue)} day(s) overdue
        </Badge>
      );
    }
    if (daysUntilDue === 0) {
      return (
        <Badge className="bg-orange-500 text-xs">Due today</Badge>
      );
    }
    if (daysUntilDue <= 2) {
      return (
        <Badge className="bg-amber-500 text-xs">
          Due in {daysUntilDue} day(s)
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-xs">
        Due in {daysUntilDue} day(s)
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Processing indicator */}
      {isProcessing && (
        <ProgressTracker
          title="Sending Reminders"
          status="in_progress"
          progress={processProgress}
          processedItems={Math.round((processProgress / 100) * selectedIds.size)}
          totalItems={selectedIds.size}
          successCount={processResult?.sent || 0}
          failedCount={processResult?.failed || 0}
        />
      )}

      {/* Filter selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Select Recipients
              </CardTitle>
              <CardDescription>
                Choose which requests should receive reminders
              </CardDescription>
            </div>
            {/* Operation Templates */}
            <OperationTemplates
              operationType="reminder_send"
              currentConfig={{
                selectedFilter,
                enableEmail,
                enableSms,
                customMessage,
              }}
              onLoadTemplate={(config) => {
                if (config.selectedFilter) setSelectedFilter(config.selectedFilter as ReminderFilter);
                if (typeof config.enableEmail === "boolean") setEnableEmail(config.enableEmail);
                if (typeof config.enableSms === "boolean") setEnableSms(config.enableSms);
                if (config.customMessage) setCustomMessage(config.customMessage as string);
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FILTER_OPTIONS.map((option) => (
              <Card
                key={option.value}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  selectedFilter === option.value && "ring-2 ring-primary"
                )}
                onClick={() => setSelectedFilter(option.value)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {option.icon}
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Preview count */}
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {isLoadingPreview ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    `${previewRequests.length} request(s) match this filter`
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedIds.size} selected for reminder
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                disabled={isLoadingPreview || previewRequests.length === 0}
              >
                <Eye className="mr-2 h-4 w-4" />
                {showPreview ? "Hide" : "Show"} Preview
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview list */}
      {showPreview && previewRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Preview</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              <div className="divide-y">
                {previewRequests.map((request) => {
                  const isSelected = selectedIds.has(request.id);

                  return (
                    <div
                      key={request.id}
                      onClick={() => toggleSelection(request.id)}
                      className={cn(
                        "flex items-center gap-4 p-4 cursor-pointer transition-colors",
                        isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                      )}
                    >
                      <Checkbox checked={isSelected} />

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{request.title}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {request.creator.name}
                          </span>
                          <span>{request.creator.email}</span>
                          {request.creator.hasPhone && (
                            <Badge variant="outline" className="text-xs">
                              <MessageSquare className="mr-1 h-3 w-3" />
                              SMS
                            </Badge>
                          )}
                        </div>
                      </div>

                      {getDueDateBadge(request.daysUntilDue)}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Channel and message configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reminder Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Channels */}
          <div className="space-y-4">
            <Label>Notification Channels</Label>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">
                    Send reminder via email
                  </p>
                </div>
              </div>
              <Switch checked={enableEmail} onCheckedChange={setEnableEmail} />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">SMS</p>
                  <p className="text-sm text-muted-foreground">
                    Send reminder via SMS ({smsEligibleCount} eligible)
                  </p>
                </div>
              </div>
              <Switch
                checked={enableSms}
                onCheckedChange={setEnableSms}
                disabled={smsEligibleCount === 0}
              />
            </div>
          </div>

          {/* Custom message */}
          <div className="space-y-2">
            <Label htmlFor="customMessage">Custom Message (optional)</Label>
            <Textarea
              id="customMessage"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add a custom message to include in the reminder..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This message will be included in addition to the standard reminder content.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>

        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} recipient(s)
          </span>
          <Button
            onClick={() => setShowConfirmDialog(true)}
            disabled={selectedIds.size === 0 || selectedChannels.length === 0 || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Reminders
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Send Bulk Reminders"
        description={`You are about to send reminders to ${selectedIds.size} creator(s).`}
        confirmLabel="Send Reminders"
        variant="default"
        onConfirm={sendReminders}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold">{selectedIds.size}</p>
              <p className="text-sm text-muted-foreground">Recipients</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{selectedChannels.length}</p>
              <p className="text-sm text-muted-foreground">Channel(s)</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {enableEmail && (
              <Badge variant="secondary">
                <Mail className="mr-1 h-3 w-3" />
                Email to {selectedIds.size}
              </Badge>
            )}
            {enableSms && smsEligibleCount > 0 && (
              <Badge variant="secondary">
                <MessageSquare className="mr-1 h-3 w-3" />
                SMS to {smsEligibleCount}
              </Badge>
            )}
          </div>

          {customMessage && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-1">Custom message:</p>
              <p className="text-sm text-muted-foreground">{customMessage}</p>
            </div>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}

export default BulkReminderSender;
