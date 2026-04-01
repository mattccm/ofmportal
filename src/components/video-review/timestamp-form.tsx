"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare,
  AlertCircle,
  ThumbsUp,
  StickyNote,
  Clock,
  Loader2,
  MousePointer2,
  Square,
  ArrowUpRight,
  Pencil,
  Eraser,
  Palette,
  X,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type VideoTimestamp,
  type AnnotationTool,
  type TimestampAnnotation,
  type CreateTimestampPayload,
  formatTimestamp,
  parseTimestamp,
  TIMESTAMP_TYPE_COLORS,
} from "@/types/video-timestamps";

// ============================================
// TYPES
// ============================================

interface TimestampFormProps {
  uploadId: string;
  currentTime: number;
  duration: number;
  onSubmit: (payload: CreateTimestampPayload) => Promise<void>;
  onCancel: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoElement?: HTMLVideoElement | null;
}

interface AnnotationCanvasProps {
  tool: AnnotationTool;
  color: string;
  width: number;
  height: number;
  onAnnotationChange: (annotation: TimestampAnnotation | undefined) => void;
  existingAnnotation?: TimestampAnnotation;
}

// ============================================
// ANNOTATION CANVAS
// ============================================

function AnnotationCanvas({
  tool,
  color,
  width,
  height,
  onAnnotationChange,
  existingAnnotation,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [annotation, setAnnotation] = useState<TimestampAnnotation | undefined>(existingAnnotation);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw existing annotation
    if (annotation) {
      ctx.strokeStyle = annotation.color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (annotation.type) {
        case "point":
          if (annotation.coordinates[0]) {
            ctx.beginPath();
            ctx.arc(
              annotation.coordinates[0].x * width,
              annotation.coordinates[0].y * height,
              8,
              0,
              Math.PI * 2
            );
            ctx.fillStyle = annotation.color;
            ctx.fill();
          }
          break;

        case "rectangle":
          if (annotation.coordinates.length >= 2) {
            const start = annotation.coordinates[0];
            const end = annotation.coordinates[1];
            ctx.strokeRect(
              start.x * width,
              start.y * height,
              (end.x - start.x) * width,
              (end.y - start.y) * height
            );
          }
          break;

        case "arrow":
          if (annotation.coordinates.length >= 2) {
            const start = annotation.coordinates[0];
            const end = annotation.coordinates[1];
            const headLength = 15;
            const dx = (end.x - start.x) * width;
            const dy = (end.y - start.y) * height;
            const angle = Math.atan2(dy, dx);

            ctx.beginPath();
            ctx.moveTo(start.x * width, start.y * height);
            ctx.lineTo(end.x * width, end.y * height);
            ctx.stroke();

            // Arrow head
            ctx.beginPath();
            ctx.moveTo(end.x * width, end.y * height);
            ctx.lineTo(
              end.x * width - headLength * Math.cos(angle - Math.PI / 6),
              end.y * height - headLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.moveTo(end.x * width, end.y * height);
            ctx.lineTo(
              end.x * width - headLength * Math.cos(angle + Math.PI / 6),
              end.y * height - headLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.stroke();
          }
          break;

        case "freehand":
          if (annotation.coordinates.length > 0) {
            ctx.beginPath();
            ctx.moveTo(
              annotation.coordinates[0].x * width,
              annotation.coordinates[0].y * height
            );
            for (let i = 1; i < annotation.coordinates.length; i++) {
              ctx.lineTo(
                annotation.coordinates[i].x * width,
                annotation.coordinates[i].y * height
              );
            }
            ctx.stroke();
          }
          break;
      }
    }
  }, [annotation, width, height]);

  const getMousePosition = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / width,
        y: (e.clientY - rect.top) / height,
      };
    },
    [width, height]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!tool) return;

      const pos = getMousePosition(e);
      setIsDrawing(true);
      setStartPoint(pos);

      if (tool === "point") {
        const newAnnotation: TimestampAnnotation = {
          type: "point",
          coordinates: [pos],
          color,
        };
        setAnnotation(newAnnotation);
        onAnnotationChange(newAnnotation);
        setIsDrawing(false);
      } else if (tool === "freehand") {
        setPoints([pos]);
      }
    },
    [tool, color, getMousePosition, onAnnotationChange]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !tool || !startPoint) return;

      const pos = getMousePosition(e);

      if (tool === "freehand") {
        setPoints((prev) => [...prev, pos]);

        // Preview freehand drawing
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (ctx && points.length > 0) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(points[points.length - 1].x * width, points[points.length - 1].y * height);
          ctx.lineTo(pos.x * width, pos.y * height);
          ctx.stroke();
        }
      } else {
        // Preview rectangle/arrow
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;

          if (tool === "rectangle") {
            ctx.strokeRect(
              startPoint.x * width,
              startPoint.y * height,
              (pos.x - startPoint.x) * width,
              (pos.y - startPoint.y) * height
            );
          } else if (tool === "arrow") {
            const headLength = 15;
            const dx = (pos.x - startPoint.x) * width;
            const dy = (pos.y - startPoint.y) * height;
            const angle = Math.atan2(dy, dx);

            ctx.beginPath();
            ctx.moveTo(startPoint.x * width, startPoint.y * height);
            ctx.lineTo(pos.x * width, pos.y * height);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(pos.x * width, pos.y * height);
            ctx.lineTo(
              pos.x * width - headLength * Math.cos(angle - Math.PI / 6),
              pos.y * height - headLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.moveTo(pos.x * width, pos.y * height);
            ctx.lineTo(
              pos.x * width - headLength * Math.cos(angle + Math.PI / 6),
              pos.y * height - headLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.stroke();
          }
        }
      }
    },
    [isDrawing, tool, startPoint, points, color, getMousePosition, width, height]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !tool || !startPoint) return;

      const pos = getMousePosition(e);
      let newAnnotation: TimestampAnnotation | undefined;

      switch (tool) {
        case "rectangle":
        case "arrow":
          newAnnotation = {
            type: tool,
            coordinates: [startPoint, pos],
            color,
          };
          break;

        case "freehand":
          newAnnotation = {
            type: "freehand",
            coordinates: [...points, pos],
            color,
          };
          break;
      }

      if (newAnnotation) {
        setAnnotation(newAnnotation);
        onAnnotationChange(newAnnotation);
      }

      setIsDrawing(false);
      setStartPoint(null);
      setPoints([]);
    },
    [isDrawing, tool, startPoint, points, color, getMousePosition, onAnnotationChange]
  );

  const clearAnnotation = useCallback(() => {
    setAnnotation(undefined);
    onAnnotationChange(undefined);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, width, height);
    }
  }, [width, height, onAnnotationChange]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={cn(
          "absolute inset-0 z-10",
          tool ? "cursor-crosshair" : "pointer-events-none"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      {annotation && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute top-2 right-2 z-20 gap-1"
          onClick={clearAnnotation}
        >
          <Eraser className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}

// ============================================
// TIMESTAMP FORM
// ============================================

const ANNOTATION_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

export function TimestampForm({
  uploadId,
  currentTime,
  duration,
  onSubmit,
  onCancel,
  open,
  onOpenChange,
  videoElement,
}: TimestampFormProps) {
  const [type, setType] = useState<VideoTimestamp["type"]>("feedback");
  const [severity, setSeverity] = useState<VideoTimestamp["severity"]>("minor");
  const [comment, setComment] = useState("");
  const [timestamp, setTimestamp] = useState(currentTime);
  const [endTimestamp, setEndTimestamp] = useState<number | undefined>();
  const [isRange, setIsRange] = useState(false);
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>(null);
  const [annotationColor, setAnnotationColor] = useState(ANNOTATION_COLORS[0]);
  const [annotation, setAnnotation] = useState<TimestampAnnotation | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [frameSnapshot, setFrameSnapshot] = useState<string | null>(null);

  // Capture frame snapshot when dialog opens
  useEffect(() => {
    if (open && videoElement) {
      setTimestamp(currentTime);

      // Capture current frame
      const canvas = document.createElement("canvas");
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoElement, 0, 0);
        setFrameSnapshot(canvas.toDataURL("image/jpeg", 0.8));
      }
    }
  }, [open, currentTime, videoElement]);

  // Reset form when closed
  useEffect(() => {
    if (!open) {
      setType("feedback");
      setSeverity("minor");
      setComment("");
      setEndTimestamp(undefined);
      setIsRange(false);
      setAnnotationTool(null);
      setAnnotation(undefined);
      setFrameSnapshot(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!comment.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        uploadId,
        timestamp,
        endTimestamp: isRange ? endTimestamp : undefined,
        comment: comment.trim(),
        type,
        severity: type === "issue" ? severity : undefined,
        annotation,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create timestamp:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTimestampChange = (value: string) => {
    const seconds = parseTimestamp(value);
    setTimestamp(Math.min(Math.max(0, seconds), duration));
  };

  const handleEndTimestampChange = (value: string) => {
    const seconds = parseTimestamp(value);
    setEndTimestamp(Math.min(Math.max(timestamp, seconds), duration));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Timestamp Comment
          </DialogTitle>
          <DialogDescription>
            Add feedback, issues, or notes at specific timestamps in the video.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Frame Preview with Annotation */}
          {frameSnapshot && (
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={frameSnapshot}
                alt="Video frame"
                className="w-full h-full object-contain"
              />
              <AnnotationCanvas
                tool={annotationTool}
                color={annotationColor}
                width={640}
                height={360}
                onAnnotationChange={setAnnotation}
                existingAnnotation={annotation}
              />

              {/* Annotation toolbar */}
              <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-background/80 backdrop-blur rounded-lg p-1">
                <Button
                  variant={annotationTool === "point" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setAnnotationTool(annotationTool === "point" ? null : "point")}
                  title="Point marker"
                >
                  <MousePointer2 className="h-4 w-4" />
                </Button>
                <Button
                  variant={annotationTool === "rectangle" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setAnnotationTool(annotationTool === "rectangle" ? null : "rectangle")}
                  title="Rectangle"
                >
                  <Square className="h-4 w-4" />
                </Button>
                <Button
                  variant={annotationTool === "arrow" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setAnnotationTool(annotationTool === "arrow" ? null : "arrow")}
                  title="Arrow"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
                <Button
                  variant={annotationTool === "freehand" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setAnnotationTool(annotationTool === "freehand" ? null : "freehand")}
                  title="Freehand"
                >
                  <Pencil className="h-4 w-4" />
                </Button>

                <div className="w-px h-6 bg-border mx-1" />

                {/* Color picker */}
                <div className="flex items-center gap-0.5">
                  {ANNOTATION_COLORS.map((c) => (
                    <button
                      key={c}
                      className={cn(
                        "w-5 h-5 rounded-full transition-all",
                        annotationColor === c
                          ? "ring-2 ring-offset-2 ring-primary"
                          : "hover:scale-110"
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => setAnnotationColor(c)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Timestamp Input */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timestamp
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                  value={formatTimestamp(timestamp)}
                  onChange={(e) => handleTimestampChange(e.target.value)}
                />
                <span className="text-sm text-muted-foreground">
                  / {formatTimestamp(duration)}
                </span>
              </div>
            </div>

            {isRange && (
              <div className="space-y-2">
                <Label>End Timestamp</Label>
                <input
                  type="text"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                  value={endTimestamp ? formatTimestamp(endTimestamp) : ""}
                  onChange={(e) => handleEndTimestampChange(e.target.value)}
                  placeholder={formatTimestamp(timestamp + 5)}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isRange"
              checked={isRange}
              onChange={(e) => {
                setIsRange(e.target.checked);
                if (e.target.checked && !endTimestamp) {
                  setEndTimestamp(Math.min(timestamp + 5, duration));
                }
              }}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="isRange" className="text-sm font-normal">
              Mark a range (start to end)
            </Label>
          </div>

          {/* Type Selection */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Tabs value={type} onValueChange={(v) => setType(v as VideoTimestamp["type"])}>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="feedback" className="gap-1.5">
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Feedback</span>
                </TabsTrigger>
                <TabsTrigger value="issue" className="gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Issue</span>
                </TabsTrigger>
                <TabsTrigger value="praise" className="gap-1.5">
                  <ThumbsUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Praise</span>
                </TabsTrigger>
                <TabsTrigger value="note" className="gap-1.5">
                  <StickyNote className="h-4 w-4" />
                  <span className="hidden sm:inline">Note</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Severity (for issues) */}
          {type === "issue" && (
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as VideoTimestamp["severity"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      Minor - Nice to fix
                    </div>
                  </SelectItem>
                  <SelectItem value="major">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                      Major - Should fix
                    </div>
                  </SelectItem>
                  <SelectItem value="critical">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      Critical - Must fix
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Comment */}
          <div className="space-y-2">
            <Label>Comment</Label>
            <Textarea
              placeholder={
                type === "issue"
                  ? "Describe the issue..."
                  : type === "praise"
                  ? "What looks great here?"
                  : type === "note"
                  ? "Add your note..."
                  : "Share your feedback..."
              }
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !comment.trim()}
            className="gap-1.5"
            style={{
              backgroundColor: TIMESTAMP_TYPE_COLORS[type],
            }}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add {type === "issue" ? "Issue" : type === "praise" ? "Praise" : type === "note" ? "Note" : "Feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TimestampForm;
