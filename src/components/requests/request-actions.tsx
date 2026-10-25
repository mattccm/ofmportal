"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccess } from "@/lib/access/client";
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
  ArchiveRestore,
  FileEdit,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { createZipFromUrlsWithReport, downloadBlob } from "@/lib/client-zip";

interface Request {
  id: string;
  title: string;
  status: string;
  creator: {
    id: string;
    name: string;
    email?: string;
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
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "submit" | "approve" | "cancel" | "archive" | "publish" | "sendReminder" | "delete" | "changeStatus" | null;
    status?: string;
  }>({ open: false, action: null });

  const { can } = useAccess();
  // Status changes go through the bulk route, which checks the key for each status
  const statusAllowed = (status: string) =>
    status === "APPROVED" ? can("review.approve") : status === "NEEDS_REVISION" ? can("review.requestChanges") : status === "ARCHIVED" ? can("requests.archive") : can("requests.edit");
  const isDraft = request.status === "DRAFT" && can("requests.create");
  const canSubmit = request.status === "IN_PROGRESS" && request.uploads.length > 0 && can("requests.edit");
  const canApprove = (request.status === "SUBMITTED" || request.status === "UNDER_REVIEW") && can("review.approve");
  const canCancel = request.status !== "CANCELLED" && request.status !== "APPROVED" && request.status !== "ARCHIVED" && can("requests.edit");
  const isArchived = request.status === "ARCHIVED";
  const canRestore = isArchived && can("requests.edit");
  const canArchive = !isArchived && request.status !== "DRAFT" && can("requests.archive");
  const canSendReminder = ["PENDING", "IN_PROGRESS", "NEEDS_REVISION"].includes(request.status) && can("requests.remind");
  const canDownload = request.uploads.length > 0 && can("review.download");
  const statusChoices = STATUS_OPTIONS.filter((s) => statusAllowed(s.value));
  const menuHasItems =
    can("requests.edit") || (!hideCloneButton && can("requests.create")) || statusChoices.length > 0 || canArchive || can("requests.delete");

  const handleAction = async (action: "submit" | "approve" | "cancel" | "archive" | "publish" | "sendReminder" | "delete") => {
    if (loading) return;
    setLoading(true);
    try {
      if (action === "delete") {
        // Delete request permanently
        const response = await fetch(`/api/requests/${request.id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to delete request");
        }

        toast.success("Request deleted permanently");
        // Navigate back to requests list since the request no longer exists
        window.location.href = "/dashboard/requests";
        return;
      } else if (action === "archive" || action === "sendReminder") {
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
        // Publish draft - moves it to PENDING and notifies the creator
        const response = await fetch(`/api/requests/${request.id}/publish`, {
          method: "POST",
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to publish request");
        }

        toast.success("Request published and sent to creator");
      } else {
        if (action === "approve") {
          // Approve any outstanding uploads first (schema requires at least one id).
          // Only PENDING ones: never silently overturn an explicit rejection.
          const ids = request.uploads.filter((u) => u.status === "PENDING").map((u) => u.id);
          if (ids.length > 0) {
            const approveResponse = await fetch("/api/uploads/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ uploadIds: ids, requestId: request.id }),
            });

            if (!approveResponse.ok) {
              const data = await approveResponse.json().catch(() => ({}));
              throw new Error(data.error || "Failed to approve request");
            }
          }
        }

        // submit / approve / cancel map to a status change on the request
        const status =
          action === "submit" ? "SUBMITTED" : action === "approve" ? "APPROVED" : "CANCELLED";
        const response = await fetch(`/api/requests/${request.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
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

      router.refresh();
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
      // Get download URLs from API (returns JSON with direct R2 URLs)
      const response = await fetch(`/api/requests/${request.id}/download`);
      if (!response.ok) throw new Error("Failed to generate download");

      const data = await response.json();
      const files = data.files as Array<{ url: string; fileName: string }>;

      if (files.length === 0) {
        toast.error("No files to download");
        return;
      }

      const toastId = toast.loading(`Preparing ${files.length} file(s)...`);

      // Create ZIP client-side (files fetched directly from R2 - no Vercel bandwidth)
      const { blob: zipBlob, failedFiles, addedCount } = await createZipFromUrlsWithReport(files, (progress) => {
        if (progress.phase === "fetching") {
          toast.loading(`Downloading ${progress.current}/${progress.total}: ${progress.fileName}`, { id: toastId });
        } else if (progress.phase === "zipping") {
          toast.loading("Creating ZIP archive...", { id: toastId });
        }
      });

      const filename = `${request.title.replace(/[^a-z0-9]/gi, "_")}_${request.id}.zip`;
      downloadBlob(zipBlob, filename);

      if (failedFiles.length > 0) {
        toast.warning(
          `ZIP contains ${addedCount} of ${files.length} file(s). ${failedFiles.length} failed to download: ${failedFiles.slice(0, 3).join(", ")}${failedFiles.length > 3 ? ", ..." : ""}`,
          { id: toastId }
        );
      } else {
        toast.success(`Downloaded ${files.length} file(s)`, { id: toastId });
      }
    } catch (error) {
      console.error("Download error:", error);
      toast.dismiss(); // Clear loading toast
      toast.error(error instanceof Error ? error.message : "Failed to download files");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (action: string, data?: Record<string, unknown>) => {
    if (loading) return;
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

      toast.success("Request updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to perform action");
    } finally {
      setLoading(false);
      setConfirmDialog({ open: false, action: null });
    }
  };

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {/* Restore from Archive button */}
        {canRestore && (
          <Button
            onClick={() => handleQuickAction("changeStatus", { status: "PENDING" })}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArchiveRestore className="mr-2 h-4 w-4" />
            )}
            Restore from archive
          </Button>
        )}

        {/* Publish Draft button */}
        {isDraft && (
          <Button
            onClick={() => setConfirmDialog({ open: true, action: "publish" })}
            disabled={loading}
          >
            <Send className="mr-2 h-4 w-4" />
            Publish request
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
            Send reminder
          </Button>
        )}

        {canDownload && (
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
            Download all
          </Button>
        )}

        {canApprove && (
          <Button
            onClick={() => setConfirmDialog({ open: true, action: "approve" })}
            disabled={loading}
            variant="outline"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Approve request
          </Button>
        )}

        {menuHasItems && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label="More request actions" variant="outline" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {can("requests.edit") && (
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/requests/${request.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit request
                </Link>
              </DropdownMenuItem>
            )}

            {!hideCloneButton && can("requests.create") && (
              <DropdownMenuItem
                onClick={onCloneClick}
                className="text-foreground dark:text-foreground"
              >
                <Copy className="mr-2 h-4 w-4" />
                Clone request
              </DropdownMenuItem>
            )}

            {canSubmit && (
              <DropdownMenuItem
                onClick={() => setConfirmDialog({ open: true, action: "submit" })}
              >
                <Send className="mr-2 h-4 w-4" />
                Mark as submitted
              </DropdownMenuItem>
            )}

            {(statusChoices.length > 0 || can("requests.edit")) && <DropdownMenuSeparator />}

            {/* Change Status submenu */}
            {statusChoices.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FileEdit className="mr-2 h-4 w-4" />
                Change status
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {statusChoices.map((status) => (
                  <DropdownMenuItem
                    key={status.value}
                    onClick={() => {
                      // Terminal statuses are destructive - confirm before applying
                      if (
                        status.value === "CANCELLED" ||
                        status.value === "ARCHIVED"
                      ) {
                        setConfirmDialog({
                          open: true,
                          action: "changeStatus",
                          status: status.value,
                        });
                      } else {
                        handleQuickAction("changeStatus", { status: status.value });
                      }
                    }}
                    disabled={request.status === status.value}
                  >
                    {status.label}
                    {request.status === status.value && " (current)"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            )}

            {/* Change Priority submenu */}
            {can("requests.edit") && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Bell className="mr-2 h-4 w-4" />
                Change priority
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
            )}

            {(canRestore || canArchive || canCancel) && <DropdownMenuSeparator />}

            {canRestore ? (
              <DropdownMenuItem
                onClick={() => handleQuickAction("changeStatus", { status: "PENDING" })}
              >
                <ArchiveRestore className="mr-2 h-4 w-4" />
                Restore from archive
              </DropdownMenuItem>
            ) : canArchive ? (
              <DropdownMenuItem
                onClick={() => setConfirmDialog({ open: true, action: "archive" })}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive request
              </DropdownMenuItem>
            ) : null}

            {canCancel && (
              <DropdownMenuItem
                className="text-late focus:text-late"
                onClick={() => setConfirmDialog({ open: true, action: "cancel" })}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Cancel request
              </DropdownMenuItem>
            )}

            {can("requests.delete") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-late focus:text-late"
                  onClick={() => setConfirmDialog({ open: true, action: "delete" })}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete permanently
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ open, action: null })}
        title={
          confirmDialog.action === "changeStatus"
            ? confirmDialog.status === "ARCHIVED"
              ? "Archive request"
              : "Cancel request"
            : confirmDialog.action === "submit"
            ? "Mark as submitted"
            : confirmDialog.action === "approve"
              ? "Approve the whole request"
              : confirmDialog.action === "cancel"
                ? "Cancel request"
                : confirmDialog.action === "archive"
                  ? "Archive request"
                  : confirmDialog.action === "publish"
                    ? "Publish request"
                    : confirmDialog.action === "sendReminder"
                      ? "Send reminder"
                      : confirmDialog.action === "delete"
                        ? "Delete this request permanently"
                        : ""
        }
        description={
          confirmDialog.action === "changeStatus"
            ? confirmDialog.status === "ARCHIVED"
              ? "This will archive the request. You can restore it later from the archived requests."
              : "This will cancel the request. This action cannot be undone."
            : confirmDialog.action === "submit"
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
                      : confirmDialog.action === "delete"
                        ? "This will permanently delete the request and all associated uploads. This action cannot be undone."
                        : ""
        }
        variant={
          confirmDialog.action === "cancel" ||
          confirmDialog.action === "delete" ||
          (confirmDialog.action === "changeStatus" &&
            confirmDialog.status === "CANCELLED")
            ? "destructive"
            : "default"
        }
        confirmLabel="Confirm"
        loading={loading}
        onConfirm={() => {
          if (confirmDialog.action === "changeStatus") {
            if (confirmDialog.status) {
              handleQuickAction("changeStatus", { status: confirmDialog.status });
            }
          } else if (confirmDialog.action) {
            handleAction(confirmDialog.action);
          }
        }}
        onCancel={() => setConfirmDialog({ open: false, action: null })}
      />
    </>
  );
}
