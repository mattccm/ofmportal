"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Pencil,
  Square,
  Circle,
  ArrowRight,
  Type,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Palette,
  Eye,
  EyeOff,
  Download,
  Send,
} from "lucide-react";
import {
  SessionAnnotation,
  SessionAnnotationType,
  AnnotationData,
  AnnotationEvent,
} from "@/types/review-session";

interface AnnotationCanvasProps {
  uploadId: string;
  sessionId: string;
  imageUrl?: string;
  videoTimestamp?: number;
  annotations: SessionAnnotation[];
  onAnnotationAdd: (annotation: Omit<SessionAnnotation, "id" | "createdAt">) => void;
  onAnnotationUpdate: (annotationId: string, data: AnnotationData) => void;
  onAnnotationDelete: (annotationId: string) => void;
  onAnnotationClear: () => void;
  onAnnotationBroadcast?: (event: AnnotationEvent) => void;
  userId: string;
  disabled?: boolean;
  readOnly?: boolean;
}

interface Point {
  x: number;
  y: number;
}

const COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ffffff", // white
  "#000000", // black
];

export function AnnotationCanvas({
  uploadId,
  sessionId,
  imageUrl,
  videoTimestamp,
  annotations,
  onAnnotationAdd,
  onAnnotationUpdate,
  onAnnotationDelete,
  onAnnotationClear,
  onAnnotationBroadcast,
  userId,
  disabled = false,
  readOnly = false,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<SessionAnnotationType>("freehand");
  const [color, setColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [history, setHistory] = useState<SessionAnnotation[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState<Point | null>(null);

  // Initialize canvas size
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, []);

  // Redraw annotations when they change
  useEffect(() => {
    drawAnnotations();
  }, [annotations, showAnnotations, canvasSize]);

  const drawAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!showAnnotations) return;

    // Draw all annotations
    annotations.forEach((annotation) => {
      ctx.strokeStyle = annotation.color;
      ctx.fillStyle = annotation.color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (annotation.type) {
        case "freehand":
          if (annotation.data.paths) {
            annotation.data.paths.forEach((path) => {
              if (path.length < 2) return;
              ctx.beginPath();
              ctx.moveTo(path[0].x, path[0].y);
              for (let i = 1; i < path.length; i++) {
                ctx.lineTo(path[i].x, path[i].y);
              }
              ctx.stroke();
            });
          }
          break;

        case "rectangle":
          if (
            annotation.data.x !== undefined &&
            annotation.data.y !== undefined &&
            annotation.data.width !== undefined &&
            annotation.data.height !== undefined
          ) {
            ctx.strokeRect(
              annotation.data.x,
              annotation.data.y,
              annotation.data.width,
              annotation.data.height
            );
          }
          break;

        case "circle":
          if (
            annotation.data.x !== undefined &&
            annotation.data.y !== undefined &&
            annotation.data.width !== undefined
          ) {
            ctx.beginPath();
            ctx.ellipse(
              annotation.data.x,
              annotation.data.y,
              annotation.data.width / 2,
              (annotation.data.height || annotation.data.width) / 2,
              0,
              0,
              2 * Math.PI
            );
            ctx.stroke();
          }
          break;

        case "arrow":
          if (
            annotation.data.startX !== undefined &&
            annotation.data.startY !== undefined &&
            annotation.data.endX !== undefined &&
            annotation.data.endY !== undefined
          ) {
            const { startX, startY, endX, endY } = annotation.data;
            const angle = Math.atan2(endY - startY, endX - startX);
            const headLength = 15;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // Arrow head
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(
              endX - headLength * Math.cos(angle - Math.PI / 6),
              endY - headLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.moveTo(endX, endY);
            ctx.lineTo(
              endX - headLength * Math.cos(angle + Math.PI / 6),
              endY - headLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.stroke();
          }
          break;

        case "text":
          if (
            annotation.data.x !== undefined &&
            annotation.data.y !== undefined &&
            annotation.data.text
          ) {
            ctx.font = `${annotation.data.fontSize || 16}px sans-serif`;
            ctx.fillText(annotation.data.text, annotation.data.x, annotation.data.y);
          }
          break;

        case "highlight":
          if (
            annotation.data.x !== undefined &&
            annotation.data.y !== undefined &&
            annotation.data.width !== undefined &&
            annotation.data.height !== undefined
          ) {
            ctx.globalAlpha = 0.3;
            ctx.fillRect(
              annotation.data.x,
              annotation.data.y,
              annotation.data.width,
              annotation.data.height
            );
            ctx.globalAlpha = 1;
          }
          break;
      }
    });

    // Draw current path if drawing
    if (currentPath.length > 0 && tool === "freehand") {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.beginPath();
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i].x, currentPath[i].y);
      }
      ctx.stroke();
    }
  }, [annotations, showAnnotations, currentPath, color, strokeWidth, tool]);

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || readOnly) return;
    e.preventDefault();

    const point = getCanvasPoint(e);
    setIsDrawing(true);
    setStartPoint(point);

    if (tool === "freehand") {
      setCurrentPath([point]);
    } else if (tool === "text") {
      setTextPosition(point);
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled || readOnly) return;

    const point = getCanvasPoint(e);

    if (tool === "freehand") {
      setCurrentPath((prev) => [...prev, point]);
      drawAnnotations();
    } else if (startPoint) {
      // For shapes, we need to redraw preview
      drawAnnotations();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = strokeWidth;

      switch (tool) {
        case "rectangle":
          ctx.strokeRect(
            startPoint.x,
            startPoint.y,
            point.x - startPoint.x,
            point.y - startPoint.y
          );
          break;
        case "circle":
          const radiusX = Math.abs(point.x - startPoint.x) / 2;
          const radiusY = Math.abs(point.y - startPoint.y) / 2;
          const centerX = (startPoint.x + point.x) / 2;
          const centerY = (startPoint.y + point.y) / 2;
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
          ctx.stroke();
          break;
        case "arrow":
          const angle = Math.atan2(point.y - startPoint.y, point.x - startPoint.x);
          const headLength = 15;
          ctx.beginPath();
          ctx.moveTo(startPoint.x, startPoint.y);
          ctx.lineTo(point.x, point.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(
            point.x - headLength * Math.cos(angle - Math.PI / 6),
            point.y - headLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(
            point.x - headLength * Math.cos(angle + Math.PI / 6),
            point.y - headLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
          break;
        case "highlight":
          ctx.globalAlpha = 0.3;
          ctx.fillRect(
            startPoint.x,
            startPoint.y,
            point.x - startPoint.x,
            point.y - startPoint.y
          );
          ctx.globalAlpha = 1;
          break;
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled || readOnly) return;

    const endPoint = getCanvasPoint(e);
    setIsDrawing(false);

    let annotationData: AnnotationData = {};

    switch (tool) {
      case "freehand":
        if (currentPath.length > 1) {
          annotationData = { paths: [currentPath] };
        }
        setCurrentPath([]);
        break;
      case "rectangle":
      case "highlight":
        if (startPoint) {
          annotationData = {
            x: Math.min(startPoint.x, endPoint.x),
            y: Math.min(startPoint.y, endPoint.y),
            width: Math.abs(endPoint.x - startPoint.x),
            height: Math.abs(endPoint.y - startPoint.y),
          };
        }
        break;
      case "circle":
        if (startPoint) {
          const width = Math.abs(endPoint.x - startPoint.x);
          const height = Math.abs(endPoint.y - startPoint.y);
          annotationData = {
            x: (startPoint.x + endPoint.x) / 2,
            y: (startPoint.y + endPoint.y) / 2,
            width,
            height,
          };
        }
        break;
      case "arrow":
        if (startPoint) {
          annotationData = {
            startX: startPoint.x,
            startY: startPoint.y,
            endX: endPoint.x,
            endY: endPoint.y,
          };
        }
        break;
    }

    if (Object.keys(annotationData).length > 0) {
      const annotation: Omit<SessionAnnotation, "id" | "createdAt"> = {
        sessionId,
        uploadId,
        userId,
        type: tool,
        data: annotationData,
        color,
        timestamp: videoTimestamp,
      };

      onAnnotationAdd(annotation);
      saveToHistory();
    }

    setStartPoint(null);
  };

  const handleTextSubmit = () => {
    if (!textPosition || !textInput.trim()) return;

    const annotation: Omit<SessionAnnotation, "id" | "createdAt"> = {
      sessionId,
      uploadId,
      userId,
      type: "text",
      data: {
        x: textPosition.x,
        y: textPosition.y,
        text: textInput.trim(),
        fontSize: 16,
      },
      color,
      timestamp: videoTimestamp,
    };

    onAnnotationAdd(annotation);
    saveToHistory();
    setTextInput("");
    setTextPosition(null);
  };

  const saveToHistory = () => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...annotations]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      // Would need to restore from history
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      // Would need to restore from history
    }
  };

  const handleClear = () => {
    onAnnotationClear();
    saveToHistory();
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `annotation-${uploadId}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const tools: { type: SessionAnnotationType; icon: React.ReactNode; label: string }[] = [
    { type: "freehand", icon: <Pencil className="h-4 w-4" />, label: "Freehand" },
    { type: "rectangle", icon: <Square className="h-4 w-4" />, label: "Rectangle" },
    { type: "circle", icon: <Circle className="h-4 w-4" />, label: "Circle" },
    { type: "arrow", icon: <ArrowRight className="h-4 w-4" />, label: "Arrow" },
    { type: "text", icon: <Type className="h-4 w-4" />, label: "Text" },
    { type: "highlight", icon: <Highlighter className="h-4 w-4" />, label: "Highlight" },
  ];

  return (
    <div className="relative flex flex-col h-full">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-t-lg border-b">
          {/* Tools */}
          <div className="flex items-center gap-1 border-r pr-2">
            <TooltipProvider>
              {tools.map((t) => (
                <Tooltip key={t.type}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={tool === t.type ? "default" : "ghost"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setTool(t.type)}
                      disabled={disabled}
                    >
                      {t.icon}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t.label}</TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>

          {/* Color Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <div
                  className="h-5 w-5 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: color }}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-5 gap-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className={`h-6 w-6 rounded-full border-2 ${
                      color === c ? "border-primary" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Stroke Width */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1">
                <div
                  className="rounded-full bg-foreground"
                  style={{ width: strokeWidth * 2, height: strokeWidth * 2 }}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <div className="text-sm font-medium">Stroke Width: {strokeWidth}px</div>
                <Slider
                  value={[strokeWidth]}
                  onValueChange={([v]) => setStrokeWidth(v)}
                  min={1}
                  max={10}
                  step={1}
                />
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleUndo}
              disabled={disabled || historyIndex <= 0}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRedo}
              disabled={disabled || historyIndex >= history.length - 1}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowAnnotations(!showAnnotations)}
            >
              {showAnnotations ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleClear}
              disabled={disabled || annotations.length === 0}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleExport}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden bg-black/5"
      >
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="absolute inset-0 cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        />

        {/* Text Input Overlay */}
        {textPosition && (
          <div
            className="absolute bg-white shadow-lg rounded p-2"
            style={{ left: textPosition.x, top: textPosition.y }}
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter text..."
              className="text-sm border rounded px-2 py-1 w-40"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTextSubmit();
                if (e.key === "Escape") {
                  setTextInput("");
                  setTextPosition(null);
                }
              }}
            />
            <div className="flex gap-1 mt-1">
              <Button size="sm" onClick={handleTextSubmit}>
                Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTextInput("");
                  setTextPosition(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Annotation Count */}
      {annotations.length > 0 && (
        <Badge variant="secondary" className="absolute bottom-2 right-2">
          {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
        </Badge>
      )}
    </div>
  );
}

export default AnnotationCanvas;
