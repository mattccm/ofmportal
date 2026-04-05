"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize,
  Move,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageViewerProps {
  src: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
}

export function ImageViewer({ src, alt, className, onLoad }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Pinch-to-zoom state
  const lastTouchDistanceRef = useRef<number | null>(null);
  const lastTouchCenterRef = useRef<{ x: number; y: number } | null>(null);

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 5;
  const ZOOM_STEP = 0.25;

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + ZOOM_STEP, MAX_SCALE));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - ZOOM_STEP, MIN_SCALE));
  }, []);

  const handleRotateRight = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const handleRotateLeft = useCallback(() => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  }, []);

  const handleFitToScreen = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setScale((prev) => Math.min(Math.max(prev + delta, MIN_SCALE), MAX_SCALE));
    },
    []
  );

  // Pan/drag handling
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (scale > 1) {
        setIsDragging(true);
        setDragStart({
          x: e.clientX - position.x,
          y: e.clientY - position.y,
        });
      }
    },
    [scale, position]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Helper to get distance between two touches
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Helper to get center point between two touches
  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) return { x: touches[0].clientX, y: touches[0].clientY };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  // Touch support for mobile with pinch-to-zoom
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // Stop propagation to prevent parent swipe handlers from interfering
      e.stopPropagation();

      if (e.touches.length === 2) {
        // Pinch-to-zoom start
        lastTouchDistanceRef.current = getTouchDistance(e.touches);
        lastTouchCenterRef.current = getTouchCenter(e.touches);
        setIsDragging(false);
      } else if (e.touches.length === 1) {
        // Single touch - pan if zoomed
        if (scale > 1) {
          const touch = e.touches[0];
          setIsDragging(true);
          setDragStart({
            x: touch.clientX - position.x,
            y: touch.clientY - position.y,
          });
        }
        lastTouchDistanceRef.current = null;
        lastTouchCenterRef.current = null;
      }
    },
    [scale, position]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      // Stop propagation to prevent parent swipe handlers
      e.stopPropagation();

      if (e.touches.length === 2 && lastTouchDistanceRef.current !== null) {
        // Pinch-to-zoom
        const newDistance = getTouchDistance(e.touches);
        const scaleFactor = newDistance / lastTouchDistanceRef.current;

        setScale((prev) => {
          const newScale = Math.min(Math.max(prev * scaleFactor, MIN_SCALE), MAX_SCALE);
          return newScale;
        });

        lastTouchDistanceRef.current = newDistance;

        // Prevent default to stop page scroll/zoom
        e.preventDefault();
      } else if (isDragging && e.touches.length === 1) {
        // Pan when zoomed
        const touch = e.touches[0];
        setPosition({
          x: touch.clientX - dragStart.x,
          y: touch.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart]
  );

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    setIsDragging(false);
    lastTouchDistanceRef.current = null;
    lastTouchCenterRef.current = null;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "+":
        case "=":
          e.preventDefault();
          handleZoomIn();
          break;
        case "-":
          e.preventDefault();
          handleZoomOut();
          break;
        case "r":
          e.preventDefault();
          handleRotateRight();
          break;
        case "R":
          e.preventDefault();
          handleRotateLeft();
          break;
        case "0":
          e.preventDefault();
          handleFitToScreen();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleRotateRight, handleRotateLeft, handleFitToScreen]);

  return (
    <div className={cn("relative flex flex-col w-full h-full max-h-[calc(100dvh-10rem)]", className)}>
      {/* Image container */}
      <div
        ref={containerRef}
        className={cn(
          "flex-1 flex items-center justify-center overflow-hidden rounded-lg",
          scale > 1 ? "cursor-grab" : "cursor-default",
          isDragging && "cursor-grabbing"
        )}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain transition-transform duration-150 select-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            transformOrigin: "center center",
          }}
          draggable={false}
          onLoad={onLoad}
        />
      </div>

      {/* Controls toolbar */}
      <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-0.5 sm:gap-1 p-1 sm:p-1.5 bg-black/70 backdrop-blur-sm rounded-lg border border-white/10">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-white hover:bg-white/20"
          onClick={handleZoomOut}
          disabled={scale <= MIN_SCALE}
          title="Zoom out (-)"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>

        <span className="px-2 text-xs text-white font-medium min-w-[50px] text-center">
          {Math.round(scale * 100)}%
        </span>

        <Button
          variant="ghost"
          size="icon-sm"
          className="text-white hover:bg-white/20"
          onClick={handleZoomIn}
          disabled={scale >= MAX_SCALE}
          title="Zoom in (+)"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>

        <div className="w-px h-5 bg-white/20 mx-1" />

        <Button
          variant="ghost"
          size="icon-sm"
          className="text-white hover:bg-white/20"
          onClick={handleRotateLeft}
          title="Rotate left (Shift+R)"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          className="text-white hover:bg-white/20"
          onClick={handleRotateRight}
          title="Rotate right (R)"
        >
          <RotateCw className="h-4 w-4" />
        </Button>

        <div className="w-px h-5 bg-white/20 mx-1" />

        <Button
          variant="ghost"
          size="icon-sm"
          className="text-white hover:bg-white/20"
          onClick={handleFitToScreen}
          title="Fit to screen (0)"
        >
          <Maximize className="h-4 w-4" />
        </Button>

        {scale > 1 && (
          <>
            <div className="w-px h-5 bg-white/20 mx-1" />
            <div className="flex items-center gap-1 text-xs text-white/70 px-2">
              <Move className="h-3 w-3" />
              <span>Drag to pan</span>
            </div>
          </>
        )}
      </div>

      {/* Keyboard shortcuts hint - hidden on mobile */}
      <div className="hidden sm:block absolute top-4 right-4 text-xs text-white/50 bg-black/30 px-2 py-1 rounded">
        Scroll to zoom | +/- keys | R to rotate
      </div>
    </div>
  );
}
