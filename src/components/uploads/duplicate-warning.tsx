"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Copy,
  FileX2,
  RefreshCw,
  ExternalLink,
  Image as ImageIcon,
  Video,
  Music,
  File,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/file-utils";
import type {
  DuplicateMatch,
  DuplicateCheckResult,
  DuplicateMatchType,
} from "@/lib/duplicate-detection";
import { format } from "date-fns";

// Props for the inline alert component
export interface DuplicateAlertProps {
  result: DuplicateCheckResult;
  fileName: string;
  onDismiss?: () => void;
  onViewDuplicate?: (uploadId: string) => void;
  className?: string;
}

// Props for the dialog component
export interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: DuplicateCheckResult;
  newFile: {
    name: string;
    size: number;
    type: string;
  };
  onReplace: () => void;
  onKeepBoth: () => void;
  onCancel: () => void;
  onViewExisting?: (uploadId: string) => void;
  isProcessing?: boolean;
}

// File icon helper
function getFileIcon(mimeType: string, className?: string) {
  const iconClass = cn("h-5 w-5", className);
  if (mimeType.startsWith("image/")) return <ImageIcon className={iconClass} />;
  if (mimeType.startsWith("video/")) return <Video className={iconClass} />;
  if (mimeType.startsWith("audio/")) return <Music className={iconClass} />;
  return <File className={iconClass} />;
}

// Get icon for match type
function getMatchTypeIcon(type: DuplicateMatchType) {
  switch (type) {
    case "exact_hash":
      return <Copy className="h-4 w-4 text-red-500" />;
    case "similar_filename":
      return <FileX2 className="h-4 w-4 text-amber-500" />;
    case "same_size":
      return <RefreshCw className="h-4 w-4 text-amber-500" />;
    case "creator_timeframe":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "possible_version":
      return <RefreshCw className="h-4 w-4 text-blue-500" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  }
}

// Get severity for match type
function getMatchSeverity(type: DuplicateMatchType): "high" | "medium" | "low" {
  switch (type) {
    case "exact_hash":
      return "high";
    case "possible_version":
    case "same_size":
      return "medium";
    default:
      return "low";
  }
}

// Get confidence badge color
function getConfidenceBadgeColor(confidence: number): string {
  if (confidence >= 0.9) return "bg-red-100 text-red-700 border-red-200";
  if (confidence >= 0.7) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-yellow-100 text-yellow-700 border-yellow-200";
}

/**
 * Inline alert component for showing duplicate warning
 */
export function DuplicateAlert({
  result,
  fileName,
  onDismiss,
  onViewDuplicate,
  className,
}: DuplicateAlertProps) {
  if (!result.isDuplicate || result.matches.length === 0) {
    return null;
  }

  const topMatch = result.matches[0];
  const isHighConfidence = topMatch.confidence >= 0.8;

  return (
    <Alert
      variant="warning"
      className={cn(
        "animate-in fade-in slide-in-from-top-2 duration-300",
        className
      )}
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        Potential Duplicate Detected
        {isHighConfidence && (
          <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
            {Math.round(topMatch.confidence * 100)}% match
          </span>
        )}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-sm">
          &quot;{fileName}&quot; appears to be similar to an existing file:
          <strong className="ml-1">&quot;{topMatch.existingFileName}&quot;</strong>
        </p>
        <div className="flex items-center gap-3 mt-3">
          {onViewDuplicate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewDuplicate(topMatch.existingUploadId)}
              className="text-amber-700 border-amber-300 hover:bg-amber-100"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              View Existing
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-amber-700 hover:text-amber-800"
            >
              Dismiss
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Match item component for displaying individual matches
 */
function MatchItem({
  match,
  onView,
}: {
  match: DuplicateMatch;
  onView?: (uploadId: string) => void;
}) {
  const severity = getMatchSeverity(match.type);

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-colors",
        severity === "high" && "bg-red-50/50 border-red-200",
        severity === "medium" && "bg-amber-50/50 border-amber-200",
        severity === "low" && "bg-yellow-50/50 border-yellow-200"
      )}
    >
      <div className="shrink-0 mt-0.5">
        {getMatchTypeIcon(match.type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{match.existingFileName}</p>
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full border",
              getConfidenceBadgeColor(match.confidence)
            )}
          >
            {Math.round(match.confidence * 100)}% match
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatFileSize(Number(match.existingFileSize))}
          {match.existingUploadedAt && (
            <>
              <span className="mx-1">-</span>
              Uploaded {format(match.existingUploadedAt, "MMM d, yyyy")}
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {match.matchDetails}
        </p>
      </div>
      {onView && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(match.existingUploadId)}
          className="shrink-0"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

/**
 * Full dialog for duplicate warning with options to replace, keep both, or cancel
 */
export function DuplicateWarningDialog({
  open,
  onOpenChange,
  result,
  newFile,
  onReplace,
  onKeepBoth,
  onCancel,
  onViewExisting,
  isProcessing = false,
}: DuplicateWarningDialogProps) {
  const [selectedAction, setSelectedAction] = useState<
    "replace" | "keep_both" | null
  >(null);

  const handleReplace = useCallback(() => {
    setSelectedAction("replace");
    onReplace();
  }, [onReplace]);

  const handleKeepBoth = useCallback(() => {
    setSelectedAction("keep_both");
    onKeepBoth();
  }, [onKeepBoth]);

  const handleCancel = useCallback(() => {
    setSelectedAction(null);
    onCancel();
  }, [onCancel]);

  if (!result.isDuplicate || result.matches.length === 0) {
    return null;
  }

  const topMatch = result.matches[0];
  const hasExactMatch = result.matches.some((m) => m.type === "exact_hash");
  const recommendedAction = result.recommendedAction;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            Duplicate Content Detected
          </DialogTitle>
          <DialogDescription>
            {hasExactMatch
              ? "This file appears to be an exact duplicate of an existing upload."
              : "This file appears similar to existing uploads in your library."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* New file info */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              {getFileIcon(newFile.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{newFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(newFile.size)} - New upload
              </p>
            </div>
          </div>

          {/* Matches list */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Potential matches ({result.matches.length}):
            </p>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {result.matches.map((match) => (
                <MatchItem
                  key={match.existingUploadId}
                  match={match}
                  onView={onViewExisting}
                />
              ))}
            </div>
          </div>

          {/* Recommendation */}
          <div
            className={cn(
              "p-3 rounded-lg border",
              recommendedAction === "replace" &&
                "bg-blue-50 border-blue-200 text-blue-900",
              recommendedAction === "keep_both" &&
                "bg-emerald-50 border-emerald-200 text-emerald-900",
              recommendedAction === "review" &&
                "bg-amber-50 border-amber-200 text-amber-900"
            )}
          >
            <p className="text-sm">
              <strong>Recommendation:</strong>{" "}
              {recommendedAction === "replace" &&
                "Replace the existing file with this new version."}
              {recommendedAction === "keep_both" &&
                "Keep both files as they appear to be different enough."}
              {recommendedAction === "review" &&
                "Review carefully before deciding."}
              {recommendedAction === "proceed" &&
                "Proceed with the upload."}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isProcessing}
            className="w-full sm:w-auto"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Cancel Upload
          </Button>
          <Button
            variant="outline"
            onClick={handleKeepBoth}
            disabled={isProcessing}
            className={cn(
              "w-full sm:w-auto",
              recommendedAction === "keep_both" &&
                "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            )}
          >
            {isProcessing && selectedAction === "keep_both" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Keep Both
          </Button>
          <Button
            onClick={handleReplace}
            disabled={isProcessing}
            className={cn(
              "w-full sm:w-auto",
              recommendedAction === "replace"
                ? "bg-blue-600 hover:bg-blue-700"
                : ""
            )}
          >
            {isProcessing && selectedAction === "replace" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Replace Existing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact inline warning for use in upload progress items
 */
export interface CompactDuplicateWarningProps {
  match: DuplicateMatch;
  onView?: () => void;
  className?: string;
}

export function CompactDuplicateWarning({
  match,
  onView,
  className,
}: CompactDuplicateWarningProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-700 text-xs",
        className
      )}
    >
      <AlertTriangle className="h-3 w-3 shrink-0" />
      <span className="truncate">
        Similar to &quot;{match.existingFileName}&quot;
      </span>
      {onView && (
        <button
          onClick={onView}
          className="shrink-0 underline hover:no-underline"
        >
          View
        </button>
      )}
    </div>
  );
}

/**
 * Hook for managing duplicate detection state in upload flows
 */
export interface UseDuplicateDetectionOptions {
  requestId: string;
  creatorToken?: string;
  onDuplicateDetected?: (result: DuplicateCheckResult) => void;
}

export interface UseDuplicateDetectionResult {
  checkForDuplicates: (file: File) => Promise<DuplicateCheckResult | null>;
  isChecking: boolean;
  lastResult: DuplicateCheckResult | null;
  clearResult: () => void;
}

export function useDuplicateDetection({
  requestId,
  creatorToken,
  onDuplicateDetected,
}: UseDuplicateDetectionOptions): UseDuplicateDetectionResult {
  const [isChecking, setIsChecking] = useState(false);
  const [lastResult, setLastResult] = useState<DuplicateCheckResult | null>(null);

  const checkForDuplicates = useCallback(
    async (file: File): Promise<DuplicateCheckResult | null> => {
      setIsChecking(true);
      try {
        const response = await fetch("/api/uploads/check-duplicate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(creatorToken ? { "x-creator-token": creatorToken } : {}),
          },
          body: JSON.stringify({
            requestId,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
          }),
        });

        if (!response.ok) {
          console.error("Failed to check for duplicates");
          return null;
        }

        const result: DuplicateCheckResult = await response.json();
        setLastResult(result);

        if (result.isDuplicate && onDuplicateDetected) {
          onDuplicateDetected(result);
        }

        return result;
      } catch (error) {
        console.error("Error checking for duplicates:", error);
        return null;
      } finally {
        setIsChecking(false);
      }
    },
    [requestId, creatorToken, onDuplicateDetected]
  );

  const clearResult = useCallback(() => {
    setLastResult(null);
  }, []);

  return {
    checkForDuplicates,
    isChecking,
    lastResult,
    clearResult,
  };
}
