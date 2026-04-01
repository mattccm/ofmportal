"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getContrastColor } from "@/lib/tag-types";

export interface TagBadgeProps {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
  removable?: boolean;
  clickable?: boolean;
  selected?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
}

export function TagBadge({
  name,
  color,
  size = "md",
  removable = false,
  clickable = false,
  selected = false,
  onRemove,
  onClick,
  className,
}: TagBadgeProps) {
  const textColor = getContrastColor(color);

  const sizeClasses = {
    sm: "h-5 text-[10px] px-1.5 gap-0.5",
    md: "h-6 text-xs px-2 gap-1",
    lg: "h-7 text-sm px-2.5 gap-1.5",
  };

  const handleClick = (e: React.MouseEvent) => {
    if (clickable && onClick) {
      e.stopPropagation();
      onClick();
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium transition-all duration-150",
        "border border-transparent",
        sizeClasses[size],
        clickable && "cursor-pointer hover:opacity-80 active:scale-95",
        selected && "ring-2 ring-offset-1 ring-indigo-500",
        className
      )}
      style={{
        backgroundColor: color,
        color: textColor,
      }}
      onClick={handleClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <span className="truncate max-w-[120px]">{name}</span>
      {removable && (
        <button
          type="button"
          onClick={handleRemove}
          className={cn(
            "rounded-full p-0.5 transition-colors",
            "hover:bg-black/20 focus:outline-none focus:ring-1 focus:ring-white/50",
            size === "sm" ? "-mr-0.5" : size === "lg" ? "-mr-1" : "-mr-0.5"
          )}
          aria-label={`Remove ${name} tag`}
        >
          <X className={size === "sm" ? "h-2.5 w-2.5" : size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3"} />
        </button>
      )}
    </span>
  );
}

// Simple display variant for showing multiple tags
export interface TagListProps {
  tags: Array<{ id?: string; name: string; color: string }>;
  size?: "sm" | "md" | "lg";
  maxVisible?: number;
  clickable?: boolean;
  onTagClick?: (tag: { id?: string; name: string; color: string }) => void;
  className?: string;
}

export function TagList({
  tags,
  size = "sm",
  maxVisible = 3,
  clickable = false,
  onTagClick,
  className,
}: TagListProps) {
  const visibleTags = tags.slice(0, maxVisible);
  const remainingCount = tags.length - maxVisible;

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visibleTags.map((tag, index) => (
        <TagBadge
          key={tag.id || `${tag.name}-${index}`}
          name={tag.name}
          color={tag.color}
          size={size}
          clickable={clickable}
          onClick={() => onTagClick?.(tag)}
        />
      ))}
      {remainingCount > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full font-medium",
            "bg-muted text-muted-foreground",
            size === "sm"
              ? "h-5 text-[10px] px-1.5"
              : size === "lg"
              ? "h-7 text-sm px-2.5"
              : "h-6 text-xs px-2"
          )}
        >
          +{remainingCount}
        </span>
      )}
    </div>
  );
}
