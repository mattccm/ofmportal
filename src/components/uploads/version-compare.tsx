"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Columns2,
  Layers,
  SlidersHorizontal,
  ArrowLeftRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Check,
  X,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/file-utils";
import type { UploadVersion } from "./version-history";

type CompareMode = "side-by-side" | "overlay" | "slider";

interface MetadataChange {
  key: string;
  label: string;
  oldValue: string | number | null;
  newValue: string | number | null;
  type: "added" | "removed" | "changed" | "unchanged";
}

interface VersionCompareProps {
  uploadId: string;
  versions: UploadVersion[];
  initialLeft?: UploadVersion | null;
  initialRight?: UploadVersion | null;
  onVersionSelect?: (position: "left" | "right", version: UploadVersion) => void;
  className?: string;
}

function getFileIcon(mimeType: string, className?: string) {
  const iconClass = cn("h-8 w-8", className);
  if (mimeType.startsWith("image/")) return <ImageIcon className={iconClass} />;
  if (mimeType.startsWith("video/")) return <Video className={iconClass} />;
  if (mimeType.startsWith("audio/")) return <Music className={iconClass} />;
  return <FileText className={iconClass} />;
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    if (value > 1000000) return formatFileSize(value);
    return value.toLocaleString();
  }
  return String(value);
}

function compareMetadata(
  oldMeta: UploadVersion["metadata"],
  newMeta: UploadVersion["metadata"]
): MetadataChange[] {
  const changes: MetadataChange[] = [];
  const allKeys = new Set([
    ...Object.keys(oldMeta || {}),
    ...Object.keys(newMeta || {}),
  ]);

  const labelMap: Record<string, string> = {
    width: "Width",
    height: "Height",
    duration: "Duration",
    bitrate: "Bitrate",
    fps: "Frame Rate",
    codec: "Codec",
    colorSpace: "Color Space",
  };

  allKeys.forEach((key) => {
    const oldVal = oldMeta?.[key] ?? null;
    const newVal = newMeta?.[key] ?? null;

    let type: MetadataChange["type"] = "unchanged";
    if (oldVal === null && newVal !== null) type = "added";
    else if (oldVal !== null && newVal === null) type = "removed";
    else if (oldVal !== newVal) type = "changed";

    changes.push({
      key,
      label: labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1),
      oldValue: oldVal as string | number | null,
      newValue: newVal as string | number | null,
      type,
    });
  });

  return changes;
}

export function VersionCompare({
  uploadId,
  versions,
  initialLeft,
  initialRight,
  onVersionSelect,
  className,
}: VersionCompareProps) {
  const [leftVersion, setLeftVersion] = useState<UploadVersion | null>(initialLeft || null);
  const [rightVersion, setRightVersion] = useState<UploadVersion | null>(initialRight || null);
  const [compareMode, setCompareMode] = useState<CompareMode>("side-by-side");
  const [sliderPosition, setSliderPosition] = useState(50);
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [zoom, setZoom] = useState(100);
  const [isDragging, setIsDragging] = useState(false);

  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Sort versions by version number descending
  const sortedVersions = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  // Set initial versions if not provided
  useEffect(() => {
    if (!leftVersion && sortedVersions.length >= 2) {
      setLeftVersion(sortedVersions[1]);
    }
    if (!rightVersion && sortedVersions.length >= 1) {
      setRightVersion(sortedVersions[0]);
    }
  }, [versions]);

  const handleVersionChange = (position: "left" | "right", versionId: string) => {
    const version = versions.find((v) => v.id === versionId);
    if (!version) return;

    if (position === "left") {
      setLeftVersion(version);
    } else {
      setRightVersion(version);
    }
    onVersionSelect?.(position, version);
  };

  const swapVersions = () => {
    const temp = leftVersion;
    setLeftVersion(rightVersion);
    setRightVersion(temp);
    if (leftVersion) onVersionSelect?.("right", leftVersion);
    if (rightVersion) onVersionSelect?.("left", rightVersion);
  };

  // Slider drag handling
  const handleSliderMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleSliderMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !sliderContainerRef.current) return;

      const rect = sliderContainerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = (x / rect.width) * 100;
      setSliderPosition(Math.max(0, Math.min(100, percentage)));
    },
    [isDragging]
  );

  const handleSliderMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleSliderMouseMove);
      window.addEventListener("mouseup", handleSliderMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleSliderMouseMove);
        window.removeEventListener("mouseup", handleSliderMouseUp);
      };
    }
  }, [isDragging, handleSliderMouseMove, handleSliderMouseUp]);

  // Touch handling for slider
  const handleSliderTouchMove = useCallback((e: React.TouchEvent) => {
    if (!sliderContainerRef.current) return;

    const rect = sliderContainerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = Math.max(0, Math.min(touch.clientX - rect.left, rect.width));
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  }, []);

  const metadataChanges =
    leftVersion && rightVersion
      ? compareMetadata(leftVersion.metadata, rightVersion.metadata)
      : [];

  const isImage =
    leftVersion?.fileType.startsWith("image/") || rightVersion?.fileType.startsWith("image/");
  const isVideo =
    leftVersion?.fileType.startsWith("video/") || rightVersion?.fileType.startsWith("video/");

  return (
    <div className={cn("space-y-4", className)}>
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Version selectors */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={leftVersion?.id || ""}
            onValueChange={(value) => handleVersionChange("left", value)}
          >
            <SelectTrigger className="w-[180px] border-indigo-200 dark:border-indigo-800">
              <SelectValue placeholder="Select version" />
            </SelectTrigger>
            <SelectContent>
              {sortedVersions.map((v) => (
                <SelectItem key={v.id} value={v.id} disabled={v.id === rightVersion?.id}>
                  <div className="flex items-center gap-2">
                    <span>Version {v.versionNumber}</span>
                    {v.isCurrent && (
                      <Badge className="text-[10px] px-1 py-0 bg-indigo-500">Current</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={swapVersions}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>

          <Select
            value={rightVersion?.id || ""}
            onValueChange={(value) => handleVersionChange("right", value)}
          >
            <SelectTrigger className="w-[180px] border-violet-200 dark:border-violet-800">
              <SelectValue placeholder="Select version" />
            </SelectTrigger>
            <SelectContent>
              {sortedVersions.map((v) => (
                <SelectItem key={v.id} value={v.id} disabled={v.id === leftVersion?.id}>
                  <div className="flex items-center gap-2">
                    <span>Version {v.versionNumber}</span>
                    {v.isCurrent && (
                      <Badge className="text-[10px] px-1 py-0 bg-indigo-500">Current</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Compare mode toggles */}
        {isImage && (
          <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
            <Button
              variant={compareMode === "side-by-side" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5 h-7 px-2 text-xs"
              onClick={() => setCompareMode("side-by-side")}
            >
              <Columns2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Side by Side</span>
            </Button>
            <Button
              variant={compareMode === "slider" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5 h-7 px-2 text-xs"
              onClick={() => setCompareMode("slider")}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Slider</span>
            </Button>
            <Button
              variant={compareMode === "overlay" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5 h-7 px-2 text-xs"
              onClick={() => setCompareMode("overlay")}
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Overlay</span>
            </Button>
          </div>
        )}

        {/* Zoom controls */}
        {isImage && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setZoom(Math.max(50, zoom - 25))}
              disabled={zoom <= 50}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center">{zoom}%</span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setZoom(Math.min(200, zoom + 25))}
              disabled={zoom >= 200}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setZoom(100)}
              className="ml-1"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Preview comparison */}
      {leftVersion && rightVersion && (
        <div className="rounded-lg border bg-muted/10 overflow-hidden">
          {/* Side by side mode */}
          {compareMode === "side-by-side" && (
            <div className="grid grid-cols-2 divide-x">
              {/* Left version */}
              <div className="relative">
                <div className="absolute top-2 left-2 z-10">
                  <Badge
                    variant="secondary"
                    className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                  >
                    V{leftVersion.versionNumber}
                  </Badge>
                </div>
                <div
                  className="flex items-center justify-center min-h-[300px] max-h-[400px] overflow-auto p-4"
                  style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center" }}
                >
                  {leftVersion.fileType.startsWith("image/") && leftVersion.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={leftVersion.previewUrl}
                      alt={`Version ${leftVersion.versionNumber}`}
                      className="max-w-full max-h-full object-contain transition-transform duration-200"
                    />
                  ) : leftVersion.fileType.startsWith("video/") && leftVersion.previewUrl ? (
                    <video
                      src={leftVersion.previewUrl}
                      controls
                      className="max-w-full max-h-full"
                      poster={leftVersion.thumbnailUrl || undefined}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      {getFileIcon(leftVersion.fileType)}
                      <span className="text-sm">{leftVersion.originalName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right version */}
              <div className="relative">
                <div className="absolute top-2 left-2 z-10">
                  <Badge
                    variant="secondary"
                    className="bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                  >
                    V{rightVersion.versionNumber}
                    {rightVersion.isCurrent && " (Current)"}
                  </Badge>
                </div>
                <div
                  className="flex items-center justify-center min-h-[300px] max-h-[400px] overflow-auto p-4"
                  style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center" }}
                >
                  {rightVersion.fileType.startsWith("image/") && rightVersion.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={rightVersion.previewUrl}
                      alt={`Version ${rightVersion.versionNumber}`}
                      className="max-w-full max-h-full object-contain transition-transform duration-200"
                    />
                  ) : rightVersion.fileType.startsWith("video/") && rightVersion.previewUrl ? (
                    <video
                      src={rightVersion.previewUrl}
                      controls
                      className="max-w-full max-h-full"
                      poster={rightVersion.thumbnailUrl || undefined}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      {getFileIcon(rightVersion.fileType)}
                      <span className="text-sm">{rightVersion.originalName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Slider mode */}
          {compareMode === "slider" && isImage && (
            <div
              ref={sliderContainerRef}
              className="relative min-h-[400px] max-h-[500px] overflow-hidden cursor-ew-resize select-none"
              onTouchMove={handleSliderTouchMove}
            >
              {/* Right image (full width, behind) */}
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center" }}
              >
                {rightVersion.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={rightVersion.previewUrl}
                    alt={`Version ${rightVersion.versionNumber}`}
                    className="max-w-full max-h-full object-contain"
                    draggable={false}
                  />
                )}
              </div>

              {/* Left image (clipped) */}
              <div
                className="absolute inset-0 flex items-center justify-center overflow-hidden"
                style={{
                  clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: "center",
                }}
              >
                {leftVersion.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={leftVersion.previewUrl}
                    alt={`Version ${leftVersion.versionNumber}`}
                    className="max-w-full max-h-full object-contain"
                    draggable={false}
                  />
                )}
              </div>

              {/* Slider handle */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize z-20 transition-transform duration-75"
                style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
                onMouseDown={handleSliderMouseDown}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                  <div className="flex items-center">
                    <ChevronLeft className="h-4 w-4 text-indigo-600" />
                    <ChevronRight className="h-4 w-4 text-violet-600" />
                  </div>
                </div>
              </div>

              {/* Labels */}
              <div className="absolute top-2 left-2 z-10">
                <Badge className="bg-indigo-500">V{leftVersion.versionNumber}</Badge>
              </div>
              <div className="absolute top-2 right-2 z-10">
                <Badge className="bg-violet-500">V{rightVersion.versionNumber}</Badge>
              </div>
            </div>
          )}

          {/* Overlay mode */}
          {compareMode === "overlay" && isImage && (
            <div className="relative min-h-[400px] max-h-[500px] overflow-hidden">
              {/* Bottom image */}
              <div
                ref={overlayRef}
                className="absolute inset-0 flex items-center justify-center"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center" }}
              >
                {leftVersion.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={leftVersion.previewUrl}
                    alt={`Version ${leftVersion.versionNumber}`}
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </div>

              {/* Top image (with opacity) */}
              <div
                className="absolute inset-0 flex items-center justify-center transition-opacity duration-150"
                style={{
                  opacity: overlayOpacity / 100,
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: "center",
                }}
              >
                {rightVersion.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={rightVersion.previewUrl}
                    alt={`Version ${rightVersion.versionNumber}`}
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </div>

              {/* Opacity slider */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-background/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-indigo-500 text-xs">V{leftVersion.versionNumber}</Badge>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(parseInt(e.target.value))}
                    className="w-32 h-1.5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-indigo-500"
                  />
                  <Badge className="bg-violet-500 text-xs">V{rightVersion.versionNumber}</Badge>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metadata comparison */}
      {leftVersion && rightVersion && (
        <div className="rounded-lg border overflow-hidden">
          <div className="bg-muted/30 px-4 py-2 border-b">
            <h4 className="text-sm font-medium">File Comparison</h4>
          </div>
          <div className="divide-y">
            {/* Basic info comparison */}
            <div className="grid grid-cols-3 text-xs">
              <div className="px-4 py-2 font-medium text-muted-foreground bg-muted/20">Property</div>
              <div className="px-4 py-2 font-medium text-center bg-indigo-50/50 dark:bg-indigo-950/20">
                V{leftVersion.versionNumber}
              </div>
              <div className="px-4 py-2 font-medium text-center bg-violet-50/50 dark:bg-violet-950/20">
                V{rightVersion.versionNumber}
              </div>
            </div>

            {/* File name */}
            <div className="grid grid-cols-3 text-xs">
              <div className="px-4 py-2 text-muted-foreground bg-muted/10">File Name</div>
              <div className="px-4 py-2 text-center truncate">{leftVersion.originalName}</div>
              <div
                className={cn(
                  "px-4 py-2 text-center truncate",
                  leftVersion.originalName !== rightVersion.originalName &&
                    "bg-amber-50 dark:bg-amber-950/20"
                )}
              >
                {rightVersion.originalName}
                {leftVersion.originalName !== rightVersion.originalName && (
                  <span className="ml-1 text-amber-600">*</span>
                )}
              </div>
            </div>

            {/* File size */}
            <div className="grid grid-cols-3 text-xs">
              <div className="px-4 py-2 text-muted-foreground bg-muted/10">File Size</div>
              <div className="px-4 py-2 text-center">{formatFileSize(leftVersion.fileSize)}</div>
              <div
                className={cn(
                  "px-4 py-2 text-center flex items-center justify-center gap-1",
                  leftVersion.fileSize !== rightVersion.fileSize &&
                    (rightVersion.fileSize > leftVersion.fileSize
                      ? "bg-red-50 dark:bg-red-950/20 text-red-600"
                      : "bg-green-50 dark:bg-green-950/20 text-green-600")
                )}
              >
                {formatFileSize(rightVersion.fileSize)}
                {rightVersion.fileSize !== leftVersion.fileSize && (
                  rightVersion.fileSize > leftVersion.fileSize ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowDown className="h-3 w-3" />
                  )
                )}
              </div>
            </div>

            {/* File type */}
            <div className="grid grid-cols-3 text-xs">
              <div className="px-4 py-2 text-muted-foreground bg-muted/10">File Type</div>
              <div className="px-4 py-2 text-center">{leftVersion.fileType}</div>
              <div
                className={cn(
                  "px-4 py-2 text-center",
                  leftVersion.fileType !== rightVersion.fileType &&
                    "bg-amber-50 dark:bg-amber-950/20"
                )}
              >
                {rightVersion.fileType}
              </div>
            </div>

            {/* Uploaded by */}
            <div className="grid grid-cols-3 text-xs">
              <div className="px-4 py-2 text-muted-foreground bg-muted/10">Uploaded By</div>
              <div className="px-4 py-2 flex items-center justify-center gap-1.5">
                <Avatar user={leftVersion.uploadedBy} size="xs" />
                <span>{leftVersion.uploadedBy.name}</span>
              </div>
              <div className="px-4 py-2 flex items-center justify-center gap-1.5">
                <Avatar user={rightVersion.uploadedBy} size="xs" />
                <span>{rightVersion.uploadedBy.name}</span>
              </div>
            </div>

            {/* Upload date */}
            <div className="grid grid-cols-3 text-xs">
              <div className="px-4 py-2 text-muted-foreground bg-muted/10">Upload Date</div>
              <div className="px-4 py-2 text-center">
                {format(new Date(leftVersion.uploadedAt), "MMM d, yyyy h:mm a")}
              </div>
              <div className="px-4 py-2 text-center">
                {format(new Date(rightVersion.uploadedAt), "MMM d, yyyy h:mm a")}
              </div>
            </div>

            {/* Metadata changes */}
            {metadataChanges
              .filter((change) => change.type !== "unchanged")
              .map((change) => (
                <div key={change.key} className="grid grid-cols-3 text-xs">
                  <div className="px-4 py-2 text-muted-foreground bg-muted/10">{change.label}</div>
                  <div
                    className={cn(
                      "px-4 py-2 text-center",
                      change.type === "removed" && "bg-red-50 dark:bg-red-950/20"
                    )}
                  >
                    {change.type === "added" ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      formatMetadataValue(change.oldValue)
                    )}
                  </div>
                  <div
                    className={cn(
                      "px-4 py-2 text-center",
                      change.type === "added" && "bg-green-50 dark:bg-green-950/20",
                      change.type === "changed" && "bg-amber-50 dark:bg-amber-950/20"
                    )}
                  >
                    {change.type === "removed" ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      <>
                        {formatMetadataValue(change.newValue)}
                        {change.type === "added" && (
                          <Check className="h-3 w-3 inline ml-1 text-green-600" />
                        )}
                        {change.type === "changed" && (
                          <span className="ml-1 text-amber-600">*</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Version notes comparison */}
      {leftVersion && rightVersion && (leftVersion.notes || rightVersion.notes) && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-indigo-500 text-xs">V{leftVersion.versionNumber}</Badge>
              <span className="text-xs text-muted-foreground">Notes</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">
              {leftVersion.notes || <span className="text-muted-foreground italic">No notes</span>}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-violet-500 text-xs">V{rightVersion.versionNumber}</Badge>
              <span className="text-xs text-muted-foreground">Notes</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">
              {rightVersion.notes || <span className="text-muted-foreground italic">No notes</span>}
            </p>
          </div>
        </div>
      )}

      {/* No versions selected message */}
      {(!leftVersion || !rightVersion) && (
        <div className="rounded-lg border bg-muted/10 p-8 text-center">
          <div className="flex justify-center mb-3">
            <div className="rounded-full bg-muted p-3">
              <Columns2 className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Select two versions to compare them side by side
          </p>
        </div>
      )}
    </div>
  );
}
