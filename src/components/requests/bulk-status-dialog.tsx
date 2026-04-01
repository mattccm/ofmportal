"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  XCircle,
  FileText,
  User,
  Bell,
  Archive,
  Flag,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

// Types
export type BulkActionType =
  | "changeStatus"
  | "changePriority"
  | "assignTeamMember"
  | "sendReminder"
  | "archive";

interface Creator {
  id: string;
  name: string;
  email: string;
}

interface RequestTemplate {
  id: string;
  name: string;
}

interface ContentRequest {
  id: string;
  title: string;
  description: string | null;
  status: string;
  urgency: string;
  dueDate: string | null;
  createdAt: string;
  creator: Creator;
  template: RequestTemplate | null;
  _count: {
    uploads: number;
    comments: number;
  };
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface BulkStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: BulkActionType;
  selectedRequests: ContentRequest[];
  teamMembers?: TeamMember[];
  onSuccess: () => void;
}

interface BulkResult {
  requestId: string;
  requestTitle: string;
  success: boolean;
  error?: string;
}

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft", description: "Request saved as draft" },
  { value: "PENDING", label: "Pending", description: "Waiting for creator" },
  { value: "IN_PROGRESS", label: "In Progress", description: "Creator started uploading" },
  { value: "SUBMITTED", label: "Submitted", description: "Creator submitted content" },
  { value: "UNDER_REVIEW", label: "Under Review", description: "Agency reviewing content" },
  { value: "NEEDS_REVISION", label: "Needs Revision", description: "Changes requested" },
  { value: "APPROVED", label: "Approved", description: "All content approved" },
  { value: "ARCHIVED", label: "Archived", description: "Request archived" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low", color: "bg-gray-100 text-gray-600" },
  { value: "NORMAL", label: "Normal", color: "bg-blue-100 text-blue-600" },
  { value: "HIGH", label: "High", color: "bg-orange-100 text-orange-600" },
  { value: "URGENT", label: "Urgent", color: "bg-red-100 text-red-600" },
];

function getStatusBadgeClass(status: string) {
  const classes: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-800 border-slate-200",
    PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
    IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200",
    SUBMITTED: "bg-purple-100 text-purple-800 border-purple-200",
    UNDER_REVIEW: "bg-orange-100 text-orange-800 border-orange-200",
    NEEDS_REVISION: "bg-red-100 text-red-800 border-red-200",
    APPROVED: "bg-green-100 text-green-800 border-green-200",
    ARCHIVED: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return classes[status] || classes.PENDING;
}

function getActionConfig(actionType: BulkActionType) {
  const configs: Record<BulkActionType, { title: string; description: string; icon: React.ReactNode }> = {
    changeStatus: {
      title: "Bulk Change Status",
      description: "Update the status of selected requests",
      icon: <FileText className="h-5 w-5" />,
    },
    changePriority: {
      title: "Bulk Change Priority",
      description: "Update the priority level of selected requests",
      icon: <Flag className="h-5 w-5" />,
    },
    assignTeamMember: {
      title: "Assign Team Member",
      description: "Assign a team member to handle selected requests",
      icon: <UserPlus className="h-5 w-5" />,
    },
    sendReminder: {
      title: "Send Reminders",
      description: "Send reminder notifications to creators",
      icon: <Bell className="h-5 w-5" />,
    },
    archive: {
      title: "Archive Requests",
      description: "Archive selected requests",
      icon: <Archive className="h-5 w-5" />,
    },
  };
  return configs[actionType];
}

export function BulkStatusDialog({
  open,
  onOpenChange,
  actionType,
  selectedRequests,
  teamMembers = [],
  onSuccess,
}: BulkStatusDialogProps) {
  const [selectedValue, setSelectedValue] = useState<string>("");
  const [note, setNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BulkResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const actionConfig = getActionConfig(actionType);

  // Determine which requests can be updated based on action type
  const validRequests = useMemo(() => {
    return selectedRequests.filter((request) => {
      if (actionType === "sendReminder") {
        // Only send reminders for pending/in-progress/needs revision
        return ["PENDING", "IN_PROGRESS", "NEEDS_REVISION"].includes(request.status);
      }
      if (actionType === "archive") {
        // Don't archive already archived requests
        return request.status !== "ARCHIVED";
      }
      return true;
    });
  }, [selectedRequests, actionType]);

  const invalidRequests = useMemo(() => {
    return selectedRequests.filter((request) => !validRequests.includes(request));
  }, [selectedRequests, validRequests]);

  const handleSubmit = async () => {
    if (actionType !== "archive" && actionType !== "sendReminder" && !selectedValue) {
      toast.error("Please select a value to proceed");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResults([]);

    const requestIds = validRequests.map((r) => r.id);
    const batchResults: BulkResult[] = [];

    try {
      // Build request body based on action type
      const body: Record<string, unknown> = {
        requestIds,
        note: note || undefined,
      };

      switch (actionType) {
        case "changeStatus":
          body.action = "changeStatus";
          body.status = selectedValue;
          break;
        case "changePriority":
          body.action = "changePriority";
          body.priority = selectedValue;
          break;
        case "assignTeamMember":
          body.action = "assignTeamMember";
          body.teamMemberId = selectedValue;
          break;
        case "sendReminder":
          body.action = "sendReminders";
          break;
        case "archive":
          body.action = "archive";
          break;
      }

      // Make API call to bulk-status endpoint
      const response = await fetch("/api/requests/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to perform bulk action");
      }

      // Process results
      if (data.results) {
        batchResults.push(...data.results);
      } else {
        // If no per-item results, create synthetic results
        for (const request of validRequests) {
          batchResults.push({
            requestId: request.id,
            requestTitle: request.title,
            success: true,
          });
        }
      }

      // Handle partial errors
      if (data.errors && data.errors.length > 0) {
        for (const error of data.errors) {
          const request = validRequests.find((r) => error.includes(r.title));
          if (request) {
            const existingResult = batchResults.find((r) => r.requestId === request.id);
            if (existingResult) {
              existingResult.success = false;
              existingResult.error = error;
            }
          }
        }
      }

      setProgress(100);
      setResults(batchResults);
      setShowResults(true);

      const successCount = batchResults.filter((r) => r.success).length;
      const failureCount = batchResults.filter((r) => !r.success).length;

      if (failureCount === 0) {
        toast.success(`Successfully updated ${successCount} request(s)`);
      } else if (successCount > 0) {
        toast.warning(`Updated ${successCount} request(s), ${failureCount} failed`);
      } else {
        toast.error("Failed to update requests");
      }

      // Refresh parent data
      onSuccess();
    } catch (error) {
      console.error("Bulk action error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to perform bulk action");

      // Mark all as failed
      for (const request of validRequests) {
        batchResults.push({
          requestId: request.id,
          requestTitle: request.title,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
      setResults(batchResults);
      setShowResults(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setSelectedValue("");
      setNote("");
      setProgress(0);
      setResults([]);
      setShowResults(false);
      onOpenChange(false);
    }
  };

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {actionConfig.icon}
            {actionConfig.title}
          </DialogTitle>
          <DialogDescription>{actionConfig.description}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {!showResults ? (
            <div className="space-y-6 py-4">
              {/* Action-specific input */}
              {actionType === "changeStatus" && (
                <div className="space-y-2">
                  <Label>New Status</Label>
                  <Select value={selectedValue} onValueChange={setSelectedValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select new status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex flex-col">
                            <span>{option.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {actionType === "changePriority" && (
                <div className="space-y-2">
                  <Label>New Priority</Label>
                  <Select value={selectedValue} onValueChange={setSelectedValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select new priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block w-2 h-2 rounded-full ${option.color.split(" ")[0]}`}
                            />
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {actionType === "assignTeamMember" && (
                <div className="space-y-2">
                  <Label>Team Member</Label>
                  <Select value={selectedValue} onValueChange={setSelectedValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.length === 0 ? (
                        <div className="py-3 px-2 text-sm text-muted-foreground text-center">
                          No team members available
                        </div>
                      ) : (
                        teamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div className="flex flex-col">
                                <span>{member.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {member.email} - {member.role}
                                </span>
                              </div>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Optional note */}
              <div className="space-y-2">
                <Label>Note (Optional)</Label>
                <Textarea
                  placeholder="Add a note about this bulk action..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Preview affected requests */}
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>Affected Requests ({validRequests.length})</span>
                  {invalidRequests.length > 0 && (
                    <span className="text-xs text-amber-600">
                      {invalidRequests.length} request(s) cannot be updated
                    </span>
                  )}
                </Label>
                <ScrollArea className="h-[200px] border rounded-md">
                  <div className="p-3 space-y-2">
                    {validRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{request.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {request.creator.name}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`${getStatusBadgeClass(request.status)} text-xs ml-2`}
                        >
                          {request.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    ))}

                    {invalidRequests.length > 0 && (
                      <>
                        <div className="border-t my-3" />
                        <p className="text-xs text-muted-foreground px-3 pb-2">
                          Cannot be updated:
                        </p>
                        {invalidRequests.map((request) => (
                          <div
                            key={request.id}
                            className="flex items-center justify-between py-2 px-3 bg-amber-50 dark:bg-amber-950/20 rounded-md opacity-60"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{request.title}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {request.creator.name}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={`${getStatusBadgeClass(request.status)} text-xs ml-2`}
                            >
                              {request.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Processing indicator */}
              {isProcessing && (
                <div className="space-y-2">
                  <Progress value={progress}>
                    <ProgressLabel>Processing...</ProgressLabel>
                    <ProgressValue>{() => `${progress}%`}</ProgressValue>
                  </Progress>
                </div>
              )}
            </div>
          ) : (
            /* Results view */
            <div className="space-y-4 py-4">
              {/* Summary */}
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                {failureCount === 0 ? (
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                ) : successCount === 0 ? (
                  <XCircle className="h-8 w-8 text-red-500" />
                ) : (
                  <AlertCircle className="h-8 w-8 text-amber-500" />
                )}
                <div>
                  <p className="font-semibold">
                    {failureCount === 0
                      ? "All requests updated successfully"
                      : successCount === 0
                        ? "Failed to update requests"
                        : "Partial success"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {successCount} succeeded, {failureCount} failed
                  </p>
                </div>
              </div>

              {/* Detailed results */}
              <ScrollArea className="h-[250px] border rounded-md">
                <div className="p-3 space-y-2">
                  {results.map((result) => (
                    <div
                      key={result.requestId}
                      className={`flex items-center justify-between py-2 px-3 rounded-md ${
                        result.success
                          ? "bg-green-50 dark:bg-green-950/20"
                          : "bg-red-50 dark:bg-red-950/20"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {result.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {result.requestTitle}
                          </p>
                          {result.error && (
                            <p className="text-xs text-red-600 dark:text-red-400 truncate">
                              {result.error}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          {!showResults ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  isProcessing ||
                  validRequests.length === 0 ||
                  (actionType !== "archive" &&
                    actionType !== "sendReminder" &&
                    !selectedValue)
                }
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Update ${validRequests.length} Request${validRequests.length !== 1 ? "s" : ""}`
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
