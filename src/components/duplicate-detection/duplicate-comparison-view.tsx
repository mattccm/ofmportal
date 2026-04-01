"use client";

import * as React from "react";
import Image from "next/image";
import {
  X,
  FileImage,
  FileVideo,
  FileText,
  File,
  Calendar,
  HardDrive,
  Hash,
  User,
  ArrowRight,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Eye,
  Download,
  ExternalLink,
  Percent,
  Layers,
  Fingerprint,
  FileType,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { DuplicateAttempt, DuplicateMatchTypeEnum } from "@/types/content-fingerprint";

// ============================================
// TYPES
// ============================================

interface DuplicateComparisonViewProps {
  attempt: DuplicateAttempt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewOriginal?: (uploadId: string) => void;
}

interface FilePreviewProps {
  fileName: string;
  fileSize: number;
  fileType: string;
  thumbnailUrl?: string;
  uploadDate?: Date;
  label: "attempted" | "original";
  hash?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("text/") || mimeType.includes("document")) return FileText;
  return File;
}

function getMatchTypeConfig(matchType: DuplicateMatchTypeEnum) {
  switch (matchType) {
    case "EXACT":
      return {
        label: "Exact Match",
        description: "Files are identical (100% match)",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950/30",
        borderColor: "border-red-200 dark:border-red-800/50",
        icon: Ban,
      };
    case "NEAR":
      return {
        label: "Near Match",
        description: "Files are visually very similar (95%+ match)",
        color: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-50 dark:bg-orange-950/30",
        borderColor: "border-orange-200 dark:border-orange-800/50",
        icon: AlertTriangle,
      };
    case "SIMILAR":
      return {
        label: "Similar Content",
        description: "Files share common characteristics",
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-950/30",
        borderColor: "border-amber-200 dark:border-amber-800/50",
        icon: Layers,
      };
    default:
      return {
        label: "Unknown",
        description: "Unknown match type",
        color: "text-gray-600",
        bgColor: "bg-gray-50",
        borderColor: "border-gray-200",
        icon: File,
      };
  }
}

// ============================================
// FILE PREVIEW COMPONENT
// ============================================

function FilePreview({
  fileName,
  fileSize,
  fileType,
  thumbnailUrl,
  uploadDate,
  label,
  hash,
}: FilePreviewProps) {
  const FileIcon = getFileIcon(fileType);
  const isImage = fileType.startsWith("image/");
  const isVideo = fileType.startsWith("video/");

  return (
    <div
      className={cn(
        "flex-1 rounded-xl border-2 overflow-hidden",
        label === "attempted"
          ? "border-orange-200 dark:border-orange-800/50"
          : "border-indigo-200 dark:border-indigo-800/50"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "px-4 py-3 border-b",
          label === "attempted"
            ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/50"
            : "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/50"
        )}
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center",
              label === "attempted" ? "bg-orange-500/10" : "bg-indigo-500/10"
            )}
          >
            {label === "attempted" ? (
              <AlertTriangle
                className={cn(
                  "h-4 w-4",
                  label === "attempted" ? "text-orange-500" : "text-indigo-500"
                )}
              />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-indigo-500" />
            )}
          </div>
          <div>
            <h4
              className={cn(
                "text-sm font-semibold",
                label === "attempted"
                  ? "text-orange-700 dark:text-orange-400"
                  : "text-indigo-700 dark:text-indigo-400"
              )}
            >
              {label === "attempted" ? "Attempted Upload" : "Original File"}
            </h4>
            {uploadDate && (
              <p className="text-xs text-muted-foreground">
                {formatDate(uploadDate)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Thumbnail/Preview */}
      <div className="aspect-video bg-muted/30 flex items-center justify-center relative overflow-hidden">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={fileName}
            fill
            className="object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="h-16 w-16 rounded-xl bg-muted/50 flex items-center justify-center">
              <FileIcon className="h-8 w-8" />
            </div>
            <span className="text-sm">
              {isImage ? "Image" : isVideo ? "Video" : "File"} Preview
            </span>
          </div>
        )}

        {/* File type badge */}
        <Badge
          variant="secondary"
          className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm"
        >
          {fileType.split("/")[1]?.toUpperCase() || "FILE"}
        </Badge>
      </div>

      {/* File Details */}
      <div className="p-4 space-y-3 bg-background">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <FileType className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">File Name</p>
              <p className="text-sm font-medium truncate" title={fileName}>
                {fileName}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <HardDrive className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">File Size</p>
              <p className="text-sm font-medium">{formatFileSize(fileSize)}</p>
            </div>
          </div>

          {hash && (
            <div className="flex items-start gap-2">
              <Fingerprint className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Content Hash</p>
                <p className="text-xs font-mono truncate" title={hash}>
                  {hash.slice(0, 16)}...{hash.slice(-8)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// SIMILARITY INDICATOR
// ============================================

function SimilarityIndicator({
  similarity,
  matchType,
}: {
  similarity: number;
  matchType: DuplicateMatchTypeEnum;
}) {
  const config = getMatchTypeConfig(matchType);
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-6">
      {/* Arrow and Match Icon */}
      <div className="flex items-center gap-3">
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
        <div
          className={cn(
            "h-12 w-12 rounded-full flex items-center justify-center",
            config.bgColor,
            "border-2",
            config.borderColor
          )}
        >
          <Icon className={cn("h-6 w-6", config.color)} />
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground rotate-180" />
      </div>

      {/* Similarity Badge */}
      <div className="text-center">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold",
            config.bgColor,
            config.color,
            "border",
            config.borderColor
          )}
        >
          <Percent className="h-4 w-4" />
          {similarity}% Match
        </div>
        <p className="text-xs text-muted-foreground mt-2 max-w-[120px]">
          {config.description}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-24">
        <Progress
          value={similarity}
          className={cn(
            "h-2",
            similarity >= 95
              ? "[&>div]:bg-red-500"
              : similarity >= 85
              ? "[&>div]:bg-orange-500"
              : "[&>div]:bg-amber-500"
          )}
        />
      </div>
    </div>
  );
}

// ============================================
// MATCH DETAILS
// ============================================

function MatchDetails({
  attempt,
}: {
  attempt: DuplicateAttempt;
}) {
  const matches = [
    { label: "Hash Match", matched: attempt.hashMatch, icon: Hash },
    { label: "Perceptual Match", matched: attempt.perceptualMatch, icon: Eye },
    { label: "Metadata Match", matched: attempt.metadataMatch, icon: FileText },
  ];

  return (
    <div className="border rounded-lg p-4 bg-muted/20">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Fingerprint className="h-4 w-4 text-violet-500" />
        Detection Methods
      </h4>
      <div className="flex flex-wrap gap-2">
        {matches.map(({ label, matched, icon: Icon }) => (
          <Badge
            key={label}
            variant="secondary"
            className={cn(
              "gap-1.5",
              matched
                ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400"
                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
            {matched ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </Badge>
        ))}
      </div>

      {attempt.creator && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Attempted by:</span>
            <span className="font-medium">{attempt.creator.name}</span>
            <span className="text-muted-foreground">({attempt.creator.email})</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DuplicateComparisonView({
  attempt,
  open,
  onOpenChange,
  onViewOriginal,
}: DuplicateComparisonViewProps) {
  if (!attempt) return null;

  const matchConfig = getMatchTypeConfig(attempt.matchType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center",
                matchConfig.bgColor
              )}
            >
              <matchConfig.icon className={cn("h-5 w-5", matchConfig.color)} />
            </div>
            <div>
              <span>Duplicate Content Comparison</span>
              <Badge
                variant="secondary"
                className={cn("ml-3", matchConfig.bgColor, matchConfig.color)}
              >
                {matchConfig.label}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Side by Side Comparison */}
          <div className="flex gap-4 items-stretch">
            <FilePreview
              fileName={attempt.attemptedFileName}
              fileSize={attempt.attemptedFileSize}
              fileType={attempt.attemptedFileType}
              thumbnailUrl={attempt.attemptedThumbnailUrl}
              label="attempted"
              hash={attempt.attemptedFileHash}
            />

            <SimilarityIndicator
              similarity={attempt.similarity}
              matchType={attempt.matchType}
            />

            <FilePreview
              fileName={attempt.originalFileName}
              fileSize={attempt.originalFileSize}
              fileType={attempt.attemptedFileType}
              thumbnailUrl={attempt.originalThumbnailUrl}
              uploadDate={attempt.originalUploadedAt}
              label="original"
            />
          </div>

          {/* Match Details */}
          <MatchDetails attempt={attempt} />

          {/* Override Info */}
          {attempt.overrideReason && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800/50">
              <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2">
                Override Information
              </h4>
              <p className="text-sm text-blue-600 dark:text-blue-300">
                {attempt.overrideReason}
              </p>
              {attempt.overrideAt && (
                <p className="text-xs text-blue-500 mt-2">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Overridden on {formatDate(attempt.overrideAt)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onViewOriginal && (
            <Button
              variant="outline"
              onClick={() => onViewOriginal(attempt.originalUploadId)}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View Original Upload
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DuplicateComparisonView;
