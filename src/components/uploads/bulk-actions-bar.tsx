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
  FileDown,
  Loader2,
  ChevronDown,
  CheckSquare,
  Square,
  AlertTriangle,
  FileText,
  Archive,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
          "flex items-center justify-between gap-4 p-4 bg-muted/30 rounded-xl border transition-all duration-200",
          selectedCount > 0 && "bg-primary/5 border-primary/20",
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
              className={cn(
                "transition-all",
                someSelected && "data-[state=checked]:bg-primary/60"
              )}
            />
            <button
              onClick={allSelected ? onDeselectAll : onSelectAll}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {allSelected
                ? "Deselect all"
                : someSelected
                ? `${selectedCount} selected`
                : "Select all"}
            </button>
          </div>

          {selectedCount > 0 && (
            <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 rounded-full">
              <span className="text-sm font-semibold text-primary">
                {selectedCount}
              </span>
              <span className="text-sm text-primary/80">
                {selectedCount === 1 ? "item" : "items"} selected
              </span>
            </div>
          )}
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center gap-2">
          {/* Selection actions when items selected */}
          {selectedCount > 0 && (
            <>
              <Button
                size="sm"
                className="gap-1.5 btn-gradient"
                onClick={() => setApproveDialogOpen(true)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Approve ({selectedCount})
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setRejectDialogOpen(true)}
                disabled={isProcessing}
              >
                <X className="h-4 w-4" />
                Reject
              </Button>

              {onBulkDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isProcessing}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}

              <div className="w-px h-6 bg-border mx-1" />
            </>
          )}

          {/* Download/Export dropdown */}
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onExportCsv} className="gap-2">
                <FileText className="h-4 w-4" />
                Export metadata (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bulk Approve Confirmation Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="rounded-full bg-emerald-100 p-1.5">
                <Check className="h-4 w-4 text-emerald-600" />
              </div>
              Approve {selectedCount} Upload{selectedCount !== 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to approve {selectedCount} selected upload
              {selectedCount !== 1 ? "s" : ""}? This action will notify the
              respective creators.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-900">
            <CheckSquare className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-emerald-800 dark:text-emerald-200">
                {selectedCount} upload{selectedCount !== 1 ? "s" : ""} will be
                approved
              </p>
              <p className="text-emerald-600 dark:text-emerald-400 mt-0.5">
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
              className="gap-1.5 btn-gradient"
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
              <div className="rounded-full bg-red-100 p-1.5">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              Reject {selectedCount} Upload{selectedCount !== 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              Provide a reason for rejection. This feedback will be sent to all
              affected creators.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {selectedCount} upload{selectedCount !== 1 ? "s" : ""} will be
                  rejected
                </p>
                <p className="text-amber-600 dark:text-amber-400 mt-0.5">
                  The same rejection reason will be sent to all creators
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Rejection Reason <span className="text-destructive">*</span>
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
              <div className="rounded-full bg-red-100 p-1.5">
                <Trash2 className="h-4 w-4 text-red-600" />
              </div>
              Delete {selectedCount} Upload{selectedCount !== 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {selectedCount} selected upload
              {selectedCount !== 1 ? "s" : ""}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-red-800 dark:text-red-200">
                {selectedCount} upload{selectedCount !== 1 ? "s" : ""} will be
                permanently deleted
              </p>
              <p className="text-red-600 dark:text-red-400 mt-0.5">
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
        selectedCount > 0 && "bg-primary/5 border-primary/20",
        className
      )}
    >
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
