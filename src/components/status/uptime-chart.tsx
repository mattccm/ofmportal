"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { StatusLevel, STATUS_CONFIG } from "./status-indicator";

// ============================================
// TYPES
// ============================================

export interface DayStatus {
  date: Date;
  status: StatusLevel;
  uptime: number; // 0-100 percentage
  incidents?: number;
  details?: string;
}

export interface UptimeChartProps {
  days: DayStatus[];
  showLabels?: boolean;
  className?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusColor(status: StatusLevel): string {
  switch (status) {
    case "operational":
      return "bg-emerald-500 hover:bg-emerald-400";
    case "degraded":
      return "bg-amber-500 hover:bg-amber-400";
    case "partial_outage":
      return "bg-orange-500 hover:bg-orange-400";
    case "major_outage":
      return "bg-red-500 hover:bg-red-400";
    default:
      return "bg-muted hover:bg-muted/80";
  }
}

function calculateOverallUptime(days: DayStatus[]): number {
  if (days.length === 0) return 100;
  const totalUptime = days.reduce((sum, day) => sum + day.uptime, 0);
  return Math.round((totalUptime / days.length) * 100) / 100;
}

// ============================================
// UPTIME BAR COMPONENT
// ============================================

interface UptimeBarProps {
  day: DayStatus;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}

function UptimeBar({ day, isHovered, onHover, onLeave }: UptimeBarProps) {
  return (
    <div
      className="relative group"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div
        className={cn(
          "h-8 md:h-10 w-full rounded-sm cursor-pointer transition-all duration-150",
          getStatusColor(day.status),
          isHovered && "ring-2 ring-primary ring-offset-2 ring-offset-background"
        )}
      />

      {/* Tooltip */}
      {isHovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 animate-fade-in">
          <div className="bg-popover text-popover-foreground rounded-xl shadow-lg border p-3 min-w-[180px]">
            <p className="font-medium text-sm mb-1">{formatDate(day.date)}</p>
            <div className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  STATUS_CONFIG[day.status].color
                )}
              />
              <span>{STATUS_CONFIG[day.status].label}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {day.uptime.toFixed(2)}% uptime
            </p>
            {day.incidents !== undefined && day.incidents > 0 && (
              <p className="text-xs text-muted-foreground">
                {day.incidents} incident{day.incidents > 1 ? "s" : ""}
              </p>
            )}
            {day.details && (
              <p className="text-xs text-muted-foreground mt-1">{day.details}</p>
            )}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="w-2 h-2 bg-popover border-r border-b rotate-45 transform origin-center" />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN UPTIME CHART COMPONENT
// ============================================

export function UptimeChart({
  days,
  showLabels = true,
  className,
}: UptimeChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const overallUptime = useMemo(() => calculateOverallUptime(days), [days]);

  // Get date range labels
  const dateLabels = useMemo(() => {
    if (days.length === 0) return { start: "", end: "" };
    const sortedDays = [...days].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
    return {
      start: formatDate(sortedDays[0].date),
      end: formatDate(sortedDays[sortedDays.length - 1].date),
    };
  }, [days]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Uptime History</h3>
          <p className="text-sm text-muted-foreground">
            {days.length} day overview
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {overallUptime.toFixed(2)}%
          </p>
          <p className="text-xs text-muted-foreground">Overall Uptime</p>
        </div>
      </div>

      {/* Chart Grid */}
      <div className="relative">
        <div className="grid grid-cols-[repeat(90,1fr)] gap-0.5 md:gap-1">
          {days.map((day, index) => (
            <UptimeBar
              key={day.date.toISOString()}
              day={day}
              isHovered={hoveredIndex === index}
              onHover={() => setHoveredIndex(index)}
              onLeave={() => setHoveredIndex(null)}
            />
          ))}
        </div>
      </div>

      {/* Date Labels */}
      {showLabels && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{dateLabels.start}</span>
          <span>Today</span>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className={cn("w-3 h-3 rounded-sm", config.color)} />
            <span className="text-muted-foreground">{config.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// COMPACT UPTIME DISPLAY
// ============================================

export interface CompactUptimeProps {
  uptime: number;
  period?: string;
  className?: string;
}

export function CompactUptime({
  uptime,
  period = "30 days",
  className,
}: CompactUptimeProps) {
  const getUptimeColor = (value: number): string => {
    if (value >= 99.9) return "text-emerald-600 dark:text-emerald-400";
    if (value >= 99) return "text-emerald-500 dark:text-emerald-400";
    if (value >= 95) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("text-xl font-bold", getUptimeColor(uptime))}>
        {uptime.toFixed(2)}%
      </span>
      <span className="text-xs text-muted-foreground">uptime ({period})</span>
    </div>
  );
}

// ============================================
// SERVICE UPTIME ROW
// ============================================

export interface ServiceUptimeRowProps {
  serviceName: string;
  days: DayStatus[];
  className?: string;
}

export function ServiceUptimeRow({
  serviceName,
  days,
  className,
}: ServiceUptimeRowProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const uptime = useMemo(() => calculateOverallUptime(days), [days]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{serviceName}</span>
        <span className="text-sm text-muted-foreground">
          {uptime.toFixed(2)}% uptime
        </span>
      </div>
      <div className="grid grid-cols-[repeat(90,1fr)] gap-px">
        {days.map((day, index) => (
          <div
            key={day.date.toISOString()}
            className="relative"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div
              className={cn(
                "h-6 w-full rounded-[2px] cursor-pointer transition-opacity",
                getStatusColor(day.status),
                hoveredIndex === index && "ring-1 ring-foreground/20"
              )}
            />
            {hoveredIndex === index && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
                <div className="bg-popover text-popover-foreground rounded-lg shadow-lg border px-2 py-1 text-xs whitespace-nowrap">
                  {formatDate(day.date)} - {day.uptime.toFixed(1)}%
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
