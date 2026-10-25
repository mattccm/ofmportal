"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check,
  X,
  Download,
  Loader2,
  ChevronDown,
  CheckSquare,
  AlertTriangle,
  FileText,
  Archive,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAccess } from "@/lib/access/client";

interface BulkActionsBarProps {
  selectedIds: Set<string>;
  totalCount: number;
  pendingCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkApprove: () => void;
  onBulkReject: (reason: string) => void;
  onBulkDownload: () => void;
  onBulkDelete?: () => void;
  onExportCsv: () => void;
  isProcessing?: boolean;
  className?: string;
}

export function BulkActionsBar({
  selectedIds,
  totalCount,
  pendingCount,
  onSelectAll,
  onDeselectAll,
  onBulkApprove,
  onBulkReject,
  onBulkDownload,
  onBulkDelete,
  onExportCsv,
  isProcessing = false,
  className,
}: BulkActionsBarProps) {
  const { can } = useAccess();
  const canApprove = can("review.approve");
  const canSendBack = can("review.requestChanges");
  const canDelete = can("review.delete");
  const canDownload = can("review.download");
  const canExport = can("requests.export");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const someSelected = selectedCount > 0 && selectedCount < totalCount;

  const handleBulkReject = () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    onBulkReject(rejectReason);
    setRejectDialogOpen(false);
    setRejectReason("");
  };

  const handleBulkApprove = () => {
    onBulkApprove();
    setApproveDialogOpen(false);
  };

  const handleBulkDelete = () => {
    if (onBulkDelete) {
      onBulkDelete();
      setDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-tile px-3 py-2 transition-colors duration-150",
          selectedCount > 0 && "bg-raised",
          className
        )}
      >
        {/* Left side - Selection controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => {
                if (checked) {
                  onSelectAll();
                } else {
                  onDeselectAll();
                }
              }}
              aria-label={allSelected ? "Clear selection" : "Select every upload waiting for review"}
            />
            <button
              onClick={allSelected ? onDeselectAll : onSelectAll}
              type="button"
              className="text-sm font-medium text-ink-2 transition-colors hover:text-ink"
            >
              {allSelected
                ? "Clear selection"
                : someSelected
                ? `${selectedCount} selected`
                : "Select all waiting"}
            </button>
          </div>
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center gap-2">
          {/* Selection actions when items selected */}
          {selectedCount > 0 && (canApprove || canSendBack || (onBulkDelete && canDelete)) && (
            <>
              {canApprove && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setApproveDialogOpen(true)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Approve {selectedCount}
              </Button>
              )}

              {canSendBack && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setRejectDialogOpen(true)}
                disabled={isProcessing}
              >
                <X className="h-4 w-4" />
                Send back
              </Button>
              )}

              {onBulkDelete && canDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 hover:text-late"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isProcessing}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}

              <div className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
            </>
          )}

          {/* Download/Export dropdown */}
          {(canDownload || canExport) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={isProcessing}
              >
                <Download className="h-4 w-4" />
                Export
                <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {canDownload && (
              <DropdownMenuItem
                onClick={onBulkDownload}
                className="gap-2"
              >
                <Archive className="h-4 w-4" />
                Bulk Download
                {selectedCount > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    ({selectedCount})
                  </span>
                )}
              </DropdownMenuItem>
              )}
              {canDownload && canExport && <DropdownMenuSeparator />}
              {canExport && (
              <DropdownMenuItem onClick={onExportCsv} className="gap-2">
                <FileText className="h-4 w-4" />
                Export metadata (CSV)
              </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>
      </div>

      {/* Bulk Approve Confirmation Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="rounded-full bg-success/10 p-1.5">
                <Check className="h-4 w-4 text-success" />
              </div>
              Approve {selectedCount} Upload{selectedCount !== 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to approve {selectedCount} selected upload
              {selectedCount !== 1 ? "s" : ""}? This action will notify the
              respective creators.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 p-4 bg-success/10 rounded-lg border border-success/30">
            <CheckSquare className="h-5 w-5 text-success shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-success">
                {selectedCount} upload{selectedCount !== 1 ? "s" : ""} will be
                approved
              </p>
              <p className="text-success mt-0.5">
                Creators will receive approval notifications
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              className="gap-1.5"
              onClick={handleBulkApprove}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Approve All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="rounded-full bg-late/15 p-1.5">
                <AlertTriangle className="h-4 w-4 text-late" />
              </div>
              Send {selectedCount} file{selectedCount !== 1 ? "s" : ""} back
            </DialogTitle>
            <DialogDescription>
              Provide a reason for rejection. This feedback will be sent to all
              affected creators.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[8px] bg-tile p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-changes" />
              <div className="text-sm">
                <p className="font-medium text-ink">
                  {selectedCount} upload{selectedCount !== 1 ? "s" : ""} will be
                  rejected
                </p>
                <p className="mt-0.5 text-ink-2">
                  The same rejection reason will be sent to all creators
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                What needs to change <span className="text-destructive">*</span>
              </label>
              <Textarea
                placeholder="Please explain why these uploads are being rejected and what changes are needed..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="border-destructive/30 focus-visible:ring-destructive/30"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="gap-1.5"
              onClick={handleBulkReject}
              disabled={!rejectReason.trim() || isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              Reject All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="rounded-full bg-late/15 p-1.5">
                <Trash2 className="h-4 w-4 text-late" />
              </div>
              Delete {selectedCount} Upload{selectedCount !== 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {selectedCount} selected upload
              {selectedCount !== 1 ? "s" : ""}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 rounded-[8px] bg-tile p-4">
            <AlertTriangle className="h-5 w-5 text-late shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-ink">
                {selectedCount} upload{selectedCount !== 1 ? "s" : ""} will be
                permanently deleted
              </p>
              <p className="mt-0.5 text-ink-2">
                Files will be removed from storage and cannot be recovered
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="gap-1.5"
              onClick={handleBulkDelete}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Standalone selection bar for minimal use cases
interface SelectionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function SelectionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  children,
  className,
}: SelectionBarProps) {
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg border",
        selectedCount > 0 && "bg-raised",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Checkbox aria-label="Select all"
          checked={allSelected}
          onCheckedChange={(checked) => {
            if (checked) {
              onSelectAll();
            } else {
              onDeselectAll();
            }
          }}
        />
        <span className="text-sm text-muted-foreground">
          {selectedCount > 0 ? (
            <span>
              <span className="font-medium text-foreground">{selectedCount}</span> of{" "}
              {totalCount} selected
            </span>
          ) : (
            "Select all"
          )}
        </span>
      </div>
      {children}
    </div>
  );
}
