"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Archive, Loader2, AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRequests: Array<{ id: string; title: string }>;
  onSuccess?: () => void;
  mode?: "archive" | "restore" | "delete";
}

export function ArchiveDialog({
  open,
  onOpenChange,
  selectedRequests,
  onSuccess,
  mode = "archive",
}: ArchiveDialogProps) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleArchive = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/requests/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestIds: selectedRequests.map((r) => r.id),
          note: note.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to archive requests");
      }

      toast.success(
        `Successfully archived ${data.affected} request${data.affected !== 1 ? "s" : ""}`
      );

      if (data.skipped > 0) {
        toast.info(`${data.skipped} request${data.skipped !== 1 ? "s were" : " was"} already archived`);
      }

      setNote("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to archive requests");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/requests/archive", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestIds: selectedRequests.map((r) => r.id),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to restore requests");
      }

      toast.success(
        `Successfully restored ${data.affected} request${data.affected !== 1 ? "s" : ""}`
      );

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore requests");
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!confirmDelete) {
      toast.error("Please confirm the permanent deletion");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/requests/archive", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestIds: selectedRequests.map((r) => r.id),
          confirmDelete: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete requests");
      }

      toast.success(
        `Permanently deleted ${data.deleted} request${data.deleted !== 1 ? "s" : ""}`
      );

      setConfirmDelete(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete requests");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    switch (mode) {
      case "archive":
        handleArchive();
        break;
      case "restore":
        handleRestore();
        break;
      case "delete":
        handlePermanentDelete();
        break;
    }
  };

  const getDialogConfig = () => {
    switch (mode) {
      case "archive":
        return {
          title: "Archive Requests",
          description: `Archive ${selectedRequests.length} selected request${selectedRequests.length !== 1 ? "s" : ""}? Archived requests can be restored later.`,
          icon: Archive,
          iconClass: "text-muted-foreground",
          buttonText: "Archive",
          buttonVariant: "default" as const,
        };
      case "restore":
        return {
          title: "Restore Requests",
          description: `Restore ${selectedRequests.length} request${selectedRequests.length !== 1 ? "s" : ""} from archive? They will be restored to their previous status.`,
          icon: RotateCcw,
          iconClass: "text-blue-600",
          buttonText: "Restore",
          buttonVariant: "default" as const,
        };
      case "delete":
        return {
          title: "Permanently Delete Requests",
          description: `This will permanently delete ${selectedRequests.length} request${selectedRequests.length !== 1 ? "s" : ""} and all associated data. This action cannot be undone.`,
          icon: Trash2,
          iconClass: "text-red-600",
          buttonText: "Delete Permanently",
          buttonVariant: "destructive" as const,
        };
    }
  };

  const config = getDialogConfig();
  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                mode === "delete" ? "bg-red-100 dark:bg-red-900/30" : "bg-muted"
              }`}
            >
              <Icon className={`h-5 w-5 ${config.iconClass}`} />
            </div>
            <div>
              <DialogTitle>{config.title}</DialogTitle>
              <DialogDescription className="mt-1">
                {config.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* List of requests being affected */}
          {selectedRequests.length > 0 && selectedRequests.length <= 5 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Selected requests:
              </Label>
              <ul className="space-y-1 text-sm">
                {selectedRequests.map((request) => (
                  <li
                    key={request.id}
                    className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2"
                  >
                    <span className="truncate">{request.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedRequests.length > 5 && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {selectedRequests.length} requests selected
            </div>
          )}

          {/* Archive note (only for archive mode) */}
          {mode === "archive" && (
            <div className="space-y-2">
              <Label htmlFor="archive-note">Archive note (optional)</Label>
              <Textarea
                id="archive-note"
                placeholder="Add a note about why these requests are being archived..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          )}

          {/* Permanent delete confirmation */}
          {mode === "delete" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-900/20">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
                <div className="text-sm">
                  <p className="font-medium text-red-800 dark:text-red-200">
                    Warning: This action is irreversible
                  </p>
                  <p className="mt-1 text-red-700 dark:text-red-300">
                    All uploads, comments, and associated data will be permanently
                    deleted. This cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="confirm-delete"
                  checked={confirmDelete}
                  onCheckedChange={(checked) =>
                    setConfirmDelete(checked === true)
                  }
                />
                <Label
                  htmlFor="confirm-delete"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I understand this action cannot be undone
                </Label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant={config.buttonVariant}
            onClick={handleSubmit}
            disabled={loading || (mode === "delete" && !confirmDelete)}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {config.buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Bulk archive selection component for use in lists
interface BulkArchiveSelectionProps {
  selectedIds: Set<string>;
  requests: Array<{ id: string; title: string; status: string }>;
  onArchive: () => void;
  disabled?: boolean;
}

export function BulkArchiveButton({
  selectedIds,
  requests,
  onArchive,
  disabled,
}: BulkArchiveSelectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const selectedRequests = requests
    .filter((r) => selectedIds.has(r.id) && r.status !== "ARCHIVED")
    .map((r) => ({ id: r.id, title: r.title }));

  const archivedCount = requests.filter(
    (r) => selectedIds.has(r.id) && r.status === "ARCHIVED"
  ).length;

  if (selectedRequests.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDialogOpen(true)}
        disabled={disabled}
      >
        <Archive className="mr-1.5 h-4 w-4" />
        Archive ({selectedRequests.length})
        {archivedCount > 0 && (
          <span className="ml-1 text-xs text-muted-foreground">
            ({archivedCount} already archived)
          </span>
        )}
      </Button>

      <ArchiveDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        selectedRequests={selectedRequests}
        onSuccess={onArchive}
        mode="archive"
      />
    </>
  );
}

// Quick archive button for single request
interface QuickArchiveButtonProps {
  request: { id: string; title: string };
  onSuccess?: () => void;
  variant?: "ghost" | "outline" | "default";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
}

export function QuickArchiveButton({
  request,
  onSuccess,
  variant = "ghost",
  size = "icon",
  showLabel = false,
}: QuickArchiveButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setDialogOpen(true)}
        title="Archive request"
      >
        <Archive className={showLabel ? "mr-2 h-4 w-4" : "h-4 w-4"} />
        {showLabel && "Archive"}
      </Button>

      <ArchiveDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        selectedRequests={[request]}
        onSuccess={onSuccess}
        mode="archive"
      />
    </>
  );
}
