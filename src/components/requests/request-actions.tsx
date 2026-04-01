"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Send,
  CheckCircle,
  Loader2,
  Download,
  Bell,
  Archive,
  FileEdit,
  Copy,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { ShareButton } from "@/components/share/share-dialog";

interface Request {
  id: string;
  title: string;
  status: string;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  uploads: Array<{ id: string; status: string }>;
}

interface RequestActionsProps {
  request: Request;
  onCloneClick?: () => void;
  hideCloneButton?: boolean;
}

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "NEEDS_REVISION", label: "Needs Revision" },
  { value: "APPROVED", label: "Approved" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ARCHIVED", label: "Archived" },
];

export function RequestActions({ request, onCloneClick, hideCloneButton = false }: RequestActionsProps) {
  const [loading, setLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "submit" | "approve" | "cancel" | "archive" | "publish" | "sendReminder" | null;
  }>({ open: false, action: null });

  const isDraft = request.status === "DRAFT";
  const isCompleted = request.status === "APPROVED";
  const canSubmit = request.status === "IN_PROGRESS" && request.uploads.length > 0;
  const canApprove = request.status === "SUBMITTED" || request.status === "UNDER_REVIEW";
  const canCancel = request.status !== "CANCELLED" && request.status !== "APPROVED" && request.status !== "ARCHIVED";
  const canArchive = request.status !== "ARCHIVED" && request.status !== "DRAFT";
  const canSendReminder = ["PENDING", "IN_PROGRESS", "NEEDS_REVISION"].includes(request.status);
  const canShare = isCompleted && request.uploads.length > 0;

  const handleAction = async (action: "submit" | "approve" | "cancel" | "archive" | "publish" | "sendReminder") => {
    setLoading(true);
    try {
      if (action === "archive" || action === "sendReminder") {
        // Use bulk API for these actions
        const bulkAction = action === "archive" ? "archive" : "sendReminders";
        const response = await fetch("/api/requests/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: bulkAction,
            requestIds: [request.id],
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to ${action}`);
        }

        toast.success(
          action === "archive" ? "Request archived" : "Reminder sent to creator"
        );
      } else if (action === "publish") {
        // Publish draft - change status to PENDING
        const response = await fetch("/api/requests/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "changeStatus",
            requestIds: [request.id],
            status: "PENDING",
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to publish request");
        }

        toast.success("Request published and sent to creator");
      } else {
        const response = await fetch(`/api/requests/${request.id}/${action}`, {
          method: "POST",
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to ${action} request`);
        }

        toast.success(
          action === "submit"
            ? "Request marked as submitted"
            : action === "approve"
              ? "All uploads approved"
              : "Request cancelled"
        );
      }

      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action}`);
    } finally {
      setLoading(false);
      setConfirmDialog({ open: false, action: null });
    }
  };

  const handleBulkDownload = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/requests/${request.id}/download`);
      if (!response.ok) throw new Error("Failed to generate download");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${request.title.replace(/[^a-z0-9]/gi, "_")}_${request.id}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Download started");
    } catch {
      toast.error("Failed to download files");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (action: string, data?: Record<string, unknown>) => {
    setLoading(true);
    try {
      const response = await fetch("/api/requests/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          requestIds: [request.id],
          ...data,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to perform action");
      }

      toast.success("Request updated successfully");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to perform action");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {/* Publish Draft button */}
        {isDraft && (
          <Button
            onClick={() => setConfirmDialog({ open: true, action: "publish" })}
            disabled={loading}
          >
            <Send className="mr-2 h-4 w-4" />
            Publish Request
          </Button>
        )}

        {/* Send Reminder button */}
        {canSendReminder && (
          <Button
            variant="outline"
            onClick={() => setConfirmDialog({ open: true, action: "sendReminder" })}
            disabled={loading}
          >
            <Bell className="mr-2 h-4 w-4" />
            Send Reminder
          </Button>
        )}

        {request.uploads.length > 0 && (
          <Button
            variant="outline"
            onClick={handleBulkDownload}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download All
          </Button>
        )}

        {canApprove && (
          <Button
            onClick={() => setConfirmDialog({ open: true, action: "approve" })}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Approve All
          </Button>
        )}

        {canShare && (
          <ShareButton
            resourceType="REQUEST"
            resourceId={request.id}
            resourceTitle={request.title}
            variant="outline"
          />
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/requests/${request.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Request
              </Link>
            </DropdownMenuItem>

            {!hideCloneButton && (
              <DropdownMenuItem
                onClick={onCloneClick}
                className="text-indigo-600 dark:text-indigo-400"
              >
                <Copy className="mr-2 h-4 w-4" />
                Clone Request
              </DropdownMenuItem>
            )}

            {canSubmit && (
              <DropdownMenuItem
                onClick={() => setConfirmDialog({ open: true, action: "submit" })}
              >
                <Send className="mr-2 h-4 w-4" />
                Mark as Submitted
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {/* Change Status submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FileEdit className="mr-2 h-4 w-4" />
                Change Status
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {STATUS_OPTIONS.map((status) => (
                  <DropdownMenuItem
                    key={status.value}
                    onClick={() =>
                      handleQuickAction("changeStatus", { status: status.value })
                    }
                    disabled={request.status === status.value}
                  >
                    {status.label}
                    {request.status === status.value && " (current)"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Change Priority submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Bell className="mr-2 h-4 w-4" />
                Change Priority
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {PRIORITY_OPTIONS.map((priority) => (
                  <DropdownMenuItem
                    key={priority.value}
                    onClick={() =>
                      handleQuickAction("changePriority", { priority: priority.value })
                    }
                  >
                    {priority.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            {canArchive && (
              <DropdownMenuItem
                onClick={() => setConfirmDialog({ open: true, action: "archive" })}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive Request
              </DropdownMenuItem>
            )}

            {canCancel && (
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => setConfirmDialog({ open: true, action: "cancel" })}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Cancel Request
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ open, action: null })}
        title={
          confirmDialog.action === "submit"
            ? "Mark as Submitted"
            : confirmDialog.action === "approve"
              ? "Approve All Uploads"
              : confirmDialog.action === "cancel"
                ? "Cancel Request"
                : confirmDialog.action === "archive"
                  ? "Archive Request"
                  : confirmDialog.action === "publish"
                    ? "Publish Request"
                    : confirmDialog.action === "sendReminder"
                      ? "Send Reminder"
                      : ""
        }
        description={
          confirmDialog.action === "submit"
            ? "This will mark the request as submitted and notify the team for review."
            : confirmDialog.action === "approve"
              ? "This will approve all uploads and mark the request as complete."
              : confirmDialog.action === "cancel"
                ? "This will cancel the request. This action cannot be undone."
                : confirmDialog.action === "archive"
                  ? "This will archive the request. You can restore it later from the archived requests."
                  : confirmDialog.action === "publish"
                    ? "This will publish the draft and send the request to the creator."
                    : confirmDialog.action === "sendReminder"
                      ? "This will send a reminder notification to the creator about this request."
                      : ""
        }
        variant={confirmDialog.action === "cancel" ? "destructive" : "default"}
        confirmLabel="Confirm"
        loading={loading}
        onConfirm={() => { if (confirmDialog.action) handleAction(confirmDialog.action); }}
        onCancel={() => setConfirmDialog({ open: false, action: null })}
      />
    </>
  );
}
