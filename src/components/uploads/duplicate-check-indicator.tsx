"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  XCircle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type {
  DuplicateCheckResult,
  DuplicateMatch,
} from "@/types/content-fingerprint";
import {
  formatMatchType,
  getMatchTypeSeverity,
} from "@/lib/content-fingerprinting";

export interface DuplicateCheckIndicatorProps {
  /**
   * Current check status
   */
  status: "idle" | "checking" | "complete" | "error";

  /**
   * The result of the duplicate check
   */
  result: DuplicateCheckResult | null;

  /**
   * File being checked
   */
  fileName?: string;

  /**
   * Callback when user wants to view original upload
   */
  onViewOriginal?: (uploadId: string) => void;

  /**
   * Callback when user wants to override and continue
   */
  onOverride?: (reason: string) => void;

  /**
   * Callback when user cancels the upload
   */
  onCancel?: () => void;

  /**
   * Whether override is allowed
   */
  allowOverride?: boolean;

  /**
   * Custom class name
   */
  className?: string;

  /**
   * Compact mode for inline display
   */
  compact?: boolean;
}

export function DuplicateCheckIndicator({
  status,
  result,
  fileName,
  onViewOriginal,
  onOverride,
  onCancel,
  allowOverride = true,
  className,
  compact = false,
}: DuplicateCheckIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [showOverrideForm, setShowOverrideForm] = useState(false);

  // Render checking state
  if (status === "checking") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-sm text-muted-foreground",
          compact ? "py-1" : "p-3 bg-muted/50 rounded-lg",
          className
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking for duplicates...</span>
      </div>
    );
  }

  // Render error state
  if (status === "error") {
    return (
      <Alert variant="destructive" className={cn("", className)}>
        <XCircle className="h-4 w-4" />
        <AlertTitle>Check Failed</AlertTitle>
        <AlertDescription>
          Could not check for duplicates. The upload will proceed.
        </AlertDescription>
      </Alert>
    );
  }

  // Render idle state
  if (status === "idle" || !result) {
    return null;
  }

  // No duplicates found
  if (!result.isDuplicate) {
    if (compact) {
      return (
        <div
          className={cn(
            "flex items-center gap-2 text-sm text-success",
            className
          )}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>No duplicates</span>
        </div>
      );
    }

    return (
      <Alert className={cn("border-success/30 bg-success/10", className)}>
        <ShieldCheck className="h-4 w-4 text-success" />
        <AlertTitle className="text-success">No Duplicates Found</AlertTitle>
        <AlertDescription className="text-success">
          This file appears to be unique. Ready to upload.
        </AlertDescription>
      </Alert>
    );
  }

  // Determine display based on recommendation
  const topMatch = result.matches[0];
  const severity = getMatchTypeSeverity(topMatch.matchType);

  // Blocked - exact duplicate
  if (result.recommendation === "block") {
    return (
      <Alert
        variant="destructive"
        className={cn(compact && "py-2", className)}
      >
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle className="flex items-center gap-2">
          Duplicate Blocked
          <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-late/10 text-late">
            {topMatch.confidence}% match
          </span>
        </AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            {fileName ? `"${fileName}"` : "This file"} is an exact duplicate of
            content you&apos;ve already uploaded.
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            {onViewOriginal && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewOriginal(topMatch.originalUploadId)}
                className="text-late border-late/30 hover:bg-late/10"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                View Original
              </Button>
            )}
            {onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="text-late hover:text-late"
              >
                Cancel Upload
              </Button>
            )}
          </div>

          {allowOverride && !compact && (
            <Collapsible
              open={showOverrideForm}
              onOpenChange={setShowOverrideForm}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-late hover:text-late"
                >
                  {showOverrideForm ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Hide override options
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      This is different content
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Please explain why this is not a duplicate..."
                  className="w-full p-2 text-sm rounded-md border border-ctl bg-well focus:outline-none focus:ring-2 focus:ring-late/40"
                  rows={2}
                />
                <Button
                  size="sm"
                  onClick={() => onOverride?.(overrideReason)}
                  disabled={!overrideReason.trim()}
                  className="bg-late hover:bg-late"
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  Override and Upload
                </Button>
              </CollapsibleContent>
            </Collapsible>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Warning - near duplicate or similar
  return (
    <Alert
      variant="warning"
      className={cn(
        severity === "medium" && "border-changes/30 bg-changes/10",
        severity === "low" && "border-changes/30 bg-changes/10",
        compact && "py-2",
        className
      )}
    >
      <AlertTriangle
        className={cn(
          "h-4 w-4",
          severity === "medium" ? "text-changes" : "text-changes"
        )}
      />
      <AlertTitle
        className={cn(
          "flex items-center gap-2",
          severity === "medium" ? "text-changes" : "text-changes"
        )}
      >
        Possible Duplicate
        <span
          className={cn(
            "text-xs font-normal px-2 py-0.5 rounded-full",
            severity === "medium"
              ? "bg-changes/20 text-changes"
              : "bg-changes/20 text-changes"
          )}
        >
          {topMatch.confidence}% match
        </span>
      </AlertTitle>
      <AlertDescription
        className={cn(
          "space-y-3",
          severity === "medium" ? "text-changes" : "text-changes"
        )}
      >
        <p>
          {fileName ? `"${fileName}"` : "This file"} appears similar to content
          you&apos;ve uploaded before.
        </p>

        {!compact && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "p-0 h-auto font-normal",
                  severity === "medium"
                    ? "text-changes hover:text-changes"
                    : "text-changes hover:text-changes"
                )}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Show {result.matches.length} match
                    {result.matches.length > 1 ? "es" : ""}
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2">
              {result.matches.map((match, index) => (
                <MatchSummary
                  key={match.originalUploadId}
                  match={match}
                  index={index + 1}
                  onView={onViewOriginal}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {onViewOriginal && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewOriginal(topMatch.originalUploadId)}
              className={cn(
                severity === "medium"
                  ? "text-changes border-changes/30 hover:bg-changes/10"
                  : "text-changes border-changes/30 hover:bg-changes/10"
              )}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              View Match
            </Button>
          )}
          {onOverride && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOverride("User confirmed different content")}
              className={cn(
                severity === "medium"
                  ? "text-changes border-changes/30 hover:bg-changes/10"
                  : "text-changes border-changes/30 hover:bg-changes/10"
              )}
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
              This is Different
            </Button>
          )}
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className={cn(
                severity === "medium"
                  ? "text-changes hover:text-changes"
                  : "text-changes hover:text-changes"
              )}
            >
              Cancel
            </Button>
          )}
        </div>

        {compact && result.matches.length > 1 && (
          <p className="text-xs">
            +{result.matches.length - 1} more potential match
            {result.matches.length > 2 ? "es" : ""}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Compact inline indicator for upload queues
 */
export function InlineDuplicateIndicator({
  result,
  className,
}: {
  result: DuplicateCheckResult | null;
  className?: string;
}) {
  if (!result) return null;

  if (!result.isDuplicate) {
    return (
      <div className={cn("flex items-center gap-1 text-xs text-success", className)}>
        <Shield className="h-3 w-3" />
        <span>Unique</span>
      </div>
    );
  }

  const topMatch = result.matches[0];

  if (result.recommendation === "block") {
    return (
      <div className={cn("flex items-center gap-1 text-xs text-late", className)}>
        <ShieldAlert className="h-3 w-3" />
        <span>Exact duplicate ({topMatch.confidence}%)</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 text-xs text-changes", className)}>
      <AlertTriangle className="h-3 w-3" />
      <span>
        {formatMatchType(topMatch.matchType)} ({topMatch.confidence}%)
      </span>
    </div>
  );
}

/**
 * Match summary for collapsible list
 */
function MatchSummary({
  match,
  index,
  onView,
}: {
  match: DuplicateMatch;
  index: number;
  onView?: (uploadId: string) => void;
}) {
  const severity = getMatchTypeSeverity(match.matchType);

  return (
    <div
      className={cn(
        "flex items-center justify-between p-2 rounded-md",
        severity === "high" && "bg-late/10",
        severity === "medium" && "bg-changes/10",
        severity === "low" && "bg-changes/10"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-medium text-muted-foreground">
          #{index}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {match.originalFileName || "Unknown file"}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatMatchType(match.matchType)}</span>
            <span>-</span>
            <span>{match.confidence}% confidence</span>
            {match.hashMatch && (
              <span className="px-1.5 py-0.5 rounded bg-late/10 text-late">
                Hash
              </span>
            )}
            {match.perceptualMatch && (
              <span className="px-1.5 py-0.5 rounded bg-tile-hi text-foreground">
                Visual
              </span>
            )}
            {match.metadataMatch && (
              <span className="px-1.5 py-0.5 rounded bg-tile-hi text-ink">
                Metadata
              </span>
            )}
          </div>
        </div>
      </div>
      {onView && (
        <Button aria-label="View original upload"
          variant="ghost"
          size="sm"
          onClick={() => onView(match.originalUploadId)}
          className="shrink-0"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export default DuplicateCheckIndicator;
