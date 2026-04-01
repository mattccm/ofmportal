"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  MessageSquare,
  AlertCircle,
  ThumbsUp,
  StickyNote,
  Check,
  ChevronRight,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  type VideoTimestamp,
  TIMESTAMP_TYPE_COLORS,
  SEVERITY_COLORS,
  formatTimestamp,
} from "@/types/video-timestamps";

interface TimestampMarkerProps {
  timestamp: VideoTimestamp;
  duration: number;
  onJumpTo: (time: number) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onSelect: (timestamp: VideoTimestamp) => void;
  isSelected?: boolean;
  compact?: boolean;
}

function getTypeIcon(type: VideoTimestamp["type"]) {
  switch (type) {
    case "feedback":
      return <MessageSquare className="h-3 w-3" />;
    case "issue":
      return <AlertCircle className="h-3 w-3" />;
    case "praise":
      return <ThumbsUp className="h-3 w-3" />;
    case "note":
      return <StickyNote className="h-3 w-3" />;
    default:
      return null;
  }
}

function getTypeBadgeColor(type: VideoTimestamp["type"]) {
  switch (type) {
    case "feedback":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "issue":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "praise":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "note":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    default:
      return "";
  }
}

export function TimestampMarker({
  timestamp,
  duration,
  onJumpTo,
  onResolve,
  onSelect,
  isSelected = false,
  compact = false,
}: TimestampMarkerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const markerRef = useRef<HTMLDivElement>(null);

  // Calculate position on timeline
  const position = duration > 0 ? (timestamp.timestamp / duration) * 100 : 0;
  const endPosition = timestamp.endTimestamp && duration > 0
    ? (timestamp.endTimestamp / duration) * 100
    : position;

  const markerColor = timestamp.type === "issue" && timestamp.severity
    ? SEVERITY_COLORS[timestamp.severity]
    : TIMESTAMP_TYPE_COLORS[timestamp.type];

  const handleJumpTo = () => {
    onJumpTo(timestamp.timestamp);
    setIsOpen(false);
  };

  const handleResolve = () => {
    onResolve(timestamp.id, !timestamp.resolved);
  };

  const handleSelect = () => {
    onSelect(timestamp);
    setIsOpen(false);
  };

  // Compact mode for timeline markers
  if (compact) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              ref={markerRef}
              className={cn(
                "absolute top-0 z-10 cursor-pointer transition-all duration-150",
                "group"
              )}
              style={{ left: `${position}%` }}
              onClick={handleJumpTo}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {/* Range indicator */}
              {timestamp.endTimestamp && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-1 opacity-30"
                  style={{
                    backgroundColor: markerColor,
                    width: `${endPosition - position}%`,
                    left: 0,
                  }}
                />
              )}

              {/* Marker dot */}
              <div
                className={cn(
                  "w-3 h-3 rounded-full -translate-x-1/2 transition-all duration-150",
                  "border-2 border-background shadow-sm",
                  isHovered || isSelected ? "scale-125" : "scale-100",
                  timestamp.resolved && "opacity-50"
                )}
                style={{ backgroundColor: markerColor }}
              >
                {/* Resolved checkmark */}
                {timestamp.resolved && (
                  <Check className="h-2 w-2 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                )}
              </div>

              {/* Extended hover area */}
              <div className="absolute -inset-2" />
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-w-xs"
            sideOffset={8}
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn("text-xs gap-1", getTypeBadgeColor(timestamp.type))}
                >
                  {getTypeIcon(timestamp.type)}
                  {timestamp.type}
                </Badge>
                {timestamp.severity && (
                  <Badge variant="outline" className="text-xs">
                    {timestamp.severity}
                  </Badge>
                )}
                {timestamp.resolved && (
                  <Badge variant="outline" className="text-xs bg-muted">
                    <Check className="h-3 w-3 mr-1" />
                    Resolved
                  </Badge>
                )}
              </div>
              <p className="text-sm line-clamp-2">{timestamp.comment}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatTimestamp(timestamp.timestamp)}
                {timestamp.endTimestamp && (
                  <> - {formatTimestamp(timestamp.endTimestamp)}</>
                )}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full marker with popover
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div
          ref={markerRef}
          className={cn(
            "absolute top-0 z-10 cursor-pointer transition-all duration-150",
            "group"
          )}
          style={{ left: `${position}%` }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Range indicator */}
          {timestamp.endTimestamp && (
            <div
              className="absolute top-1/2 -translate-y-1/2 h-2 opacity-30 rounded-full"
              style={{
                backgroundColor: markerColor,
                width: `${endPosition - position}%`,
                left: 0,
              }}
            />
          )}

          {/* Marker pin */}
          <div
            className={cn(
              "relative -translate-x-1/2 transition-all duration-150",
              isHovered || isSelected || isOpen ? "scale-110" : "scale-100"
            )}
          >
            {/* Pin head */}
            <div
              className={cn(
                "w-4 h-4 rounded-full border-2 border-background shadow-md flex items-center justify-center",
                timestamp.resolved && "opacity-60"
              )}
              style={{ backgroundColor: markerColor }}
            >
              {timestamp.resolved ? (
                <Check className="h-2.5 w-2.5 text-white" />
              ) : (
                <div className="w-1.5 h-1.5 bg-white rounded-full" />
              )}
            </div>

            {/* Pin stem */}
            <div
              className="w-0.5 h-2 mx-auto -mt-0.5"
              style={{ backgroundColor: markerColor }}
            />
          </div>

          {/* Extended hover area */}
          <div className="absolute -inset-3" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-80 p-0"
        sideOffset={8}
      >
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Avatar user={timestamp.user} size="sm" />
              <div>
                <p className="text-sm font-medium">{timestamp.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(timestamp.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Badge
                variant="outline"
                className={cn("text-xs gap-1", getTypeBadgeColor(timestamp.type))}
              >
                {getTypeIcon(timestamp.type)}
                {timestamp.type}
              </Badge>
              {timestamp.severity && (
                <Badge variant="outline" className="text-xs capitalize">
                  {timestamp.severity}
                </Badge>
              )}
            </div>
          </div>

          {/* Timestamp range */}
          <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">
              {formatTimestamp(timestamp.timestamp)}
              {timestamp.endTimestamp && (
                <span className="text-muted-foreground">
                  {" "}-{" "}{formatTimestamp(timestamp.endTimestamp)}
                </span>
              )}
            </span>
          </div>

          {/* Comment */}
          <p className="text-sm">{timestamp.comment}</p>

          {/* Replies indicator */}
          {timestamp.replies && timestamp.replies.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              {timestamp.replies.length} {timestamp.replies.length === 1 ? "reply" : "replies"}
            </div>
          )}

          {/* Resolved status */}
          {timestamp.resolved && timestamp.resolvedAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span>Resolved {formatDistanceToNow(new Date(timestamp.resolvedAt), { addSuffix: true })}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t p-2 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={handleJumpTo}
          >
            <Clock className="h-4 w-4" />
            Jump to
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex-1 gap-1.5",
              timestamp.resolved
                ? "text-muted-foreground"
                : "text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
            )}
            onClick={handleResolve}
          >
            <Check className="h-4 w-4" />
            {timestamp.resolved ? "Unresolve" : "Resolve"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={handleSelect}
          >
            View
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// TIMELINE MARKERS STRIP
// ============================================

interface TimelineMarkersProps {
  timestamps: VideoTimestamp[];
  duration: number;
  currentTime: number;
  onJumpTo: (time: number) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onSelect: (timestamp: VideoTimestamp) => void;
  selectedTimestampId?: string;
}

export function TimelineMarkers({
  timestamps,
  duration,
  currentTime,
  onJumpTo,
  onResolve,
  onSelect,
  selectedTimestampId,
}: TimelineMarkersProps) {
  if (!timestamps.length || !duration) {
    return null;
  }

  return (
    <div className="relative h-6 w-full">
      {timestamps.map((timestamp) => (
        <TimestampMarker
          key={timestamp.id}
          timestamp={timestamp}
          duration={duration}
          onJumpTo={onJumpTo}
          onResolve={onResolve}
          onSelect={onSelect}
          isSelected={timestamp.id === selectedTimestampId}
          compact
        />
      ))}
    </div>
  );
}

export default TimestampMarker;
