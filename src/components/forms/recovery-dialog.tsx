"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Clock,
  RotateCcw,
  Trash2,
  FileText,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatSavedTime } from "@/lib/form-storage";
import type { StoredFormData } from "@/lib/form-storage";

/**
 * Props for RecoveryDialog component
 */
export interface RecoveryDialogProps<T = Record<string, unknown>> {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onOpenChange: (open: boolean) => void;
  /** The recoverable data */
  data: StoredFormData<T> | null;
  /** Callback when user chooses to restore */
  onRestore: () => void;
  /** Callback when user chooses to discard */
  onDiscard: () => void;
  /** Form name for display */
  formName?: string;
  /** Custom field labels for preview */
  fieldLabels?: Record<string, string>;
  /** Fields to exclude from preview */
  excludeFields?: string[];
}

/**
 * Format a value for display in preview
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value.length > 0 ? `${value.length} items` : "-";
    }
    return JSON.stringify(value).slice(0, 50) + "...";
  }
  const str = String(value);
  return str.length > 100 ? str.slice(0, 100) + "..." : str;
}

/**
 * RecoveryDialog Component
 *
 * A dialog that prompts users when unsaved data is found from a previous session.
 * Shows a preview of the saved data and offers options to restore or discard.
 */
export function RecoveryDialog<T extends Record<string, unknown>>({
  open,
  onOpenChange,
  data,
  onRestore,
  onDiscard,
  formName = "form",
  fieldLabels = {},
  excludeFields = [],
}: RecoveryDialogProps<T>) {
  const [showPreview, setShowPreview] = React.useState(false);

  if (!data) {
    return null;
  }

  const savedTime = formatSavedTime(data.metadata.savedAt);

  // Get displayable fields from the data
  const previewFields = Object.entries(data.data)
    .filter(([key, value]) => {
      // Exclude specified fields
      if (excludeFields.includes(key)) return false;
      // Exclude empty values
      if (value === null || value === undefined || value === "") return false;
      // Exclude internal/meta fields
      if (key.startsWith("_")) return false;
      return true;
    })
    .slice(0, 8); // Limit preview to 8 fields

  const handleRestore = () => {
    onRestore();
    onOpenChange(false);
  };

  const handleDiscard = () => {
    onDiscard();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle>Unsaved Changes Found</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <Clock className="h-3.5 w-3.5" />
                <span>Saved {savedTime}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We found unsaved changes from your previous session on this{" "}
            {formName}. Would you like to restore them or start fresh?
          </p>

          {/* Preview section */}
          {previewFields.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Preview saved data</span>
                  <Badge variant="secondary" className="text-xs">
                    {previewFields.length} fields
                  </Badge>
                </div>
                {showPreview ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {showPreview && (
                <div className="border-t bg-muted/30 p-3 space-y-2">
                  {previewFields.map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-4 text-sm"
                    >
                      <span className="text-muted-foreground shrink-0">
                        {fieldLabels[key] || formatFieldName(key)}
                      </span>
                      <span className="text-right font-medium truncate">
                        {formatValue(value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Warning about discarding */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm">
            <FileText className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              If you choose to discard, the saved changes will be permanently
              deleted and cannot be recovered.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleDiscard}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Discard
          </Button>
          <Button
            onClick={handleRestore}
            className="gap-2 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90"
          >
            <RotateCcw className="h-4 w-4" />
            Restore
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Format a field name for display (camelCase to Title Case)
 */
function formatFieldName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Props for InlineRecoveryBanner component
 */
export interface InlineRecoveryBannerProps {
  /** The recoverable data */
  savedTime: number;
  /** Callback when user chooses to restore */
  onRestore: () => void;
  /** Callback when user chooses to discard */
  onDiscard: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * InlineRecoveryBanner Component
 *
 * A banner-style alternative to the dialog for recovery prompts.
 * Can be placed inline within a form.
 */
export function InlineRecoveryBanner({
  savedTime,
  onRestore,
  onDiscard,
  className,
}: InlineRecoveryBannerProps) {
  const savedTimeText = formatSavedTime(savedTime);

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20",
        className
      )}
    >
      <div className="flex items-center gap-3 flex-1">
        <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="font-medium text-amber-800 dark:text-amber-200">
            Unsaved changes found
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Saved {savedTimeText}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={onDiscard}
          className="flex-1 sm:flex-initial border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/30"
        >
          Discard
        </Button>
        <Button
          size="sm"
          onClick={onRestore}
          className="flex-1 sm:flex-initial bg-amber-600 hover:bg-amber-700 text-white"
        >
          Restore
        </Button>
      </div>
    </div>
  );
}

export default RecoveryDialog;
