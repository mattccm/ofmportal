"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Copy,
  Eye,
  Image as ImageIcon,
  Video,
  Music,
  File,
  Calendar,
  HardDrive,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Fingerprint,
  Scan,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/file-utils";
import type {
  DuplicateMatch,
  DuplicateOverrideReason,
  OVERRIDE_REASON_LABELS,
} from "@/types/content-fingerprint";
import {
  formatMatchType,
  getMatchTypeSeverity,
} from "@/lib/content-fingerprinting";

export interface DuplicateMatchCardProps {
  /**
   * The new file being uploaded
   */
  newFile: {
    name: string;
    size: number;
    type: string;
    previewUrl?: string;
  };

  /**
   * The matched duplicate
   */
  match: DuplicateMatch;

  /**
   * URL for the original file preview
   */
  originalPreviewUrl?: string;

  /**
   * Callback when user confirms this is different
   */
  onConfirmDifferent?: (reason: DuplicateOverrideReason, customReason?: string) => void;

  /**
   * Callback when user acknowledges this is a duplicate
   */
  onAcknowledgeDuplicate?: () => void;

  /**
   * Callback to view the original upload
   */
  onViewOriginal?: () => void;

  /**
   * Whether actions are disabled
   */
  disabled?: boolean;

  /**
   * Custom class name
   */
  className?: string;
}

const OVERRIDE_REASONS: { value: DuplicateOverrideReason; label: string }[] = [
  { value: "different_angle", label: "Different angle or perspective" },
  { value: "different_lighting", label: "Different lighting conditions" },
  { value: "different_edit", label: "Different edit or color grade" },
  { value: "retake", label: "Retake of the same shot" },
  { value: "different_version", label: "Updated version of content" },
  { value: "intentional_duplicate", label: "Intentionally submitting again" },
  { value: "false_positive", label: "Not actually the same content" },
  { value: "other", label: "Other reason" },
];

function getFileIcon(mimeType: string, className?: string) {
  const iconClass = cn("h-8 w-8", className);
  if (mimeType.startsWith("image/")) return <ImageIcon className={iconClass} />;
  if (mimeType.startsWith("video/")) return <Video className={iconClass} />;
  if (mimeType.startsWith("audio/")) return <Music className={iconClass} />;
  return <File className={iconClass} />;
}

export function DuplicateMatchCard({
  newFile,
  match,
  originalPreviewUrl,
  onConfirmDifferent,
  onAcknowledgeDuplicate,
  onViewOriginal,
  disabled = false,
  className,
}: DuplicateMatchCardProps) {
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [selectedReason, setSelectedReason] = useState<DuplicateOverrideReason | "">("");
  const [customReason, setCustomReason] = useState("");

  const severity = getMatchTypeSeverity(match.matchType);

  const handleConfirmDifferent = () => {
    if (selectedReason) {
      onConfirmDifferent?.(
        selectedReason,
        selectedReason === "other" ? customReason : undefined
      );
    }
  };

  return (
    <Card
      className={cn(
        "overflow-hidden",
        severity === "high" && "border-red-200",
        severity === "medium" && "border-amber-200",
        severity === "low" && "border-yellow-200",
        className
      )}
    >
      <CardHeader
        className={cn(
          "py-3 px-4",
          severity === "high" && "bg-red-50",
          severity === "medium" && "bg-amber-50",
          severity === "low" && "bg-yellow-50"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Copy
              className={cn(
                "h-5 w-5",
                severity === "high" && "text-red-500",
                severity === "medium" && "text-amber-500",
                severity === "low" && "text-yellow-500"
              )}
            />
            <span className="font-medium">{formatMatchType(match.matchType)}</span>
          </div>
          <Badge
            variant="secondary"
            className={cn(
              severity === "high" && "bg-red-100 text-red-700",
              severity === "medium" && "bg-amber-100 text-amber-700",
              severity === "low" && "bg-yellow-100 text-yellow-700"
            )}
          >
            {match.confidence}% confidence
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {/* Side by side comparison */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* New file */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              New Upload
            </p>
            <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
              {newFile.previewUrl ? (
                <img
                  src={newFile.previewUrl}
                  alt="New file preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                getFileIcon(newFile.type, "text-muted-foreground")
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium truncate" title={newFile.name}>
                {newFile.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(newFile.size)}
              </p>
            </div>
          </div>

          {/* Original file */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Existing Upload
            </p>
            <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden relative group">
              {originalPreviewUrl ? (
                <>
                  <img
                    src={originalPreviewUrl}
                    alt="Original file preview"
                    className="w-full h-full object-cover"
                  />
                  {onViewOriginal && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={onViewOriginal}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  )}
                </>
              ) : match.originalThumbnailUrl ? (
                <>
                  <img
                    src={match.originalThumbnailUrl}
                    alt="Original file preview"
                    className="w-full h-full object-cover"
                  />
                  {onViewOriginal && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={onViewOriginal}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center">
                  {getFileIcon(newFile.type, "text-muted-foreground mx-auto mb-2")}
                  {onViewOriginal && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onViewOriginal}
                      className="text-xs"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <p
                className="text-sm font-medium truncate"
                title={match.originalFileName}
              >
                {match.originalFileName || "Unknown"}
              </p>
              <p className="text-xs text-muted-foreground">
                {match.originalFileSize
                  ? formatFileSize(match.originalFileSize)
                  : "Unknown size"}
              </p>
            </div>
          </div>
        </div>

        {/* Match details */}
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Match Details
          </p>
          <div className="grid grid-cols-3 gap-2">
            <MatchIndicator
              icon={Fingerprint}
              label="Hash"
              matched={match.hashMatch}
            />
            <MatchIndicator
              icon={Scan}
              label="Visual"
              matched={match.perceptualMatch}
            />
            <MatchIndicator
              icon={FileText}
              label="Metadata"
              matched={match.metadataMatch}
            />
          </div>

          {match.originalUploadedAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                Original uploaded{" "}
                {format(new Date(match.originalUploadedAt), "MMM d, yyyy")}
              </span>
            </div>
          )}
        </div>

        {/* Override form */}
        {showOverrideForm && (
          <div className="mt-4 p-3 bg-muted/30 rounded-lg border space-y-3">
            <p className="text-sm font-medium">
              Why is this different content?
            </p>
            <Select
              value={selectedReason}
              onValueChange={(val) => setSelectedReason(val as DuplicateOverrideReason)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {OVERRIDE_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedReason === "other" && (
              <Textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Please explain..."
                rows={2}
              />
            )}

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleConfirmDifferent}
                disabled={
                  disabled ||
                  !selectedReason ||
                  (selectedReason === "other" && !customReason.trim())
                }
              >
                <Check className="h-4 w-4 mr-1" />
                Confirm
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOverrideForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="px-4 py-3 bg-muted/30 border-t flex items-center justify-between gap-2">
        {!showOverrideForm ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOverrideForm(true)}
              disabled={disabled}
            >
              <X className="h-4 w-4 mr-1" />
              This is Different
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onAcknowledgeDuplicate}
              disabled={disabled}
              className={cn(
                severity === "high" && "bg-red-600 hover:bg-red-700"
              )}
            >
              <Check className="h-4 w-4 mr-1" />
              {severity === "high" ? "Cancel Upload" : "Continue Anyway"}
            </Button>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            Provide a reason to continue with this upload
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

/**
 * Small indicator showing match type
 */
function MatchIndicator({
  icon: Icon,
  label,
  matched,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  matched: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded text-xs",
        matched
          ? "bg-red-100 text-red-700"
          : "bg-gray-100 text-gray-500"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      {matched ? (
        <Check className="h-3 w-3 ml-auto" />
      ) : (
        <X className="h-3 w-3 ml-auto" />
      )}
    </div>
  );
}

/**
 * Compact match card for lists
 */
export function CompactMatchCard({
  match,
  onView,
  className,
}: {
  match: DuplicateMatch;
  onView?: () => void;
  className?: string;
}) {
  const severity = getMatchTypeSeverity(match.matchType);

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border",
        severity === "high" && "bg-red-50 border-red-200",
        severity === "medium" && "bg-amber-50 border-amber-200",
        severity === "low" && "bg-yellow-50 border-yellow-200",
        className
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          severity === "high" && "bg-red-100",
          severity === "medium" && "bg-amber-100",
          severity === "low" && "bg-yellow-100"
        )}
      >
        <Copy
          className={cn(
            "h-5 w-5",
            severity === "high" && "text-red-600",
            severity === "medium" && "text-amber-600",
            severity === "low" && "text-yellow-600"
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {match.originalFileName || "Unknown file"}
          </span>
          <Badge
            variant="secondary"
            className={cn(
              "shrink-0 text-xs",
              severity === "high" && "bg-red-100 text-red-700",
              severity === "medium" && "bg-amber-100 text-amber-700",
              severity === "low" && "bg-yellow-100 text-yellow-700"
            )}
          >
            {match.confidence}%
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatMatchType(match.matchType)}
          {match.originalUploadedAt && (
            <>
              {" - "}
              {format(new Date(match.originalUploadedAt), "MMM d, yyyy")}
            </>
          )}
        </p>
      </div>

      {onView && (
        <Button variant="ghost" size="sm" onClick={onView} className="shrink-0">
          <ExternalLink className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export default DuplicateMatchCard;
