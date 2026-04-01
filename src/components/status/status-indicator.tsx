"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

export type StatusLevel = "operational" | "degraded" | "partial_outage" | "major_outage";

export interface StatusIndicatorProps {
  status: StatusLevel;
  label?: string;
  showLabel?: boolean;
  showPulse?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  tooltipContent?: string;
}

// ============================================
// STATUS CONFIGURATION
// ============================================

const STATUS_CONFIG: Record<
  StatusLevel,
  {
    color: string;
    bgColor: string;
    label: string;
    description: string;
  }
> = {
  operational: {
    color: "bg-emerald-500",
    bgColor: "bg-emerald-500/20",
    label: "Operational",
    description: "All systems are working normally",
  },
  degraded: {
    color: "bg-amber-500",
    bgColor: "bg-amber-500/20",
    label: "Degraded Performance",
    description: "Some systems are experiencing slower than normal performance",
  },
  partial_outage: {
    color: "bg-orange-500",
    bgColor: "bg-orange-500/20",
    label: "Partial Outage",
    description: "Some systems are experiencing an outage",
  },
  major_outage: {
    color: "bg-red-500",
    bgColor: "bg-red-500/20",
    label: "Major Outage",
    description: "Critical systems are experiencing an outage",
  },
};

const SIZE_CONFIG = {
  sm: {
    dot: "w-2 h-2",
    text: "text-xs",
    container: "gap-1.5",
  },
  md: {
    dot: "w-3 h-3",
    text: "text-sm",
    container: "gap-2",
  },
  lg: {
    dot: "w-4 h-4",
    text: "text-base",
    container: "gap-2.5",
  },
};

// ============================================
// COMPONENT
// ============================================

export function StatusIndicator({
  status,
  label,
  showLabel = true,
  showPulse = true,
  size = "md",
  className,
  tooltipContent,
}: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const sizeConfig = SIZE_CONFIG[size];
  const displayLabel = label || config.label;
  const shouldPulse = showPulse && status !== "operational";

  return (
    <div
      className={cn(
        "inline-flex items-center",
        sizeConfig.container,
        className
      )}
      title={tooltipContent || config.description}
    >
      <span className="relative flex">
        <span
          className={cn(
            "rounded-full",
            sizeConfig.dot,
            config.color,
            shouldPulse && "animate-pulse"
          )}
        />
        {shouldPulse && (
          <span
            className={cn(
              "absolute inset-0 rounded-full opacity-75 animate-ping",
              config.color
            )}
          />
        )}
      </span>
      {showLabel && (
        <span className={cn("font-medium", sizeConfig.text)}>{displayLabel}</span>
      )}
    </div>
  );
}

// ============================================
// SERVICE STATUS BADGE
// ============================================

export interface ServiceStatusBadgeProps {
  serviceName: string;
  status: StatusLevel;
  responseTime?: number;
  lastChecked?: Date;
  className?: string;
}

export function ServiceStatusBadge({
  serviceName,
  status,
  responseTime,
  lastChecked,
  className,
}: ServiceStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <StatusIndicator status={status} showLabel={false} size="md" />
        <div>
          <p className="font-medium text-sm">{serviceName}</p>
          {lastChecked && (
            <p className="text-xs text-muted-foreground">
              Last checked:{" "}
              {lastChecked.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </div>
      <div className="text-right">
        <span
          className={cn(
            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
            config.bgColor,
            status === "operational"
              ? "text-emerald-700 dark:text-emerald-300"
              : status === "degraded"
                ? "text-amber-700 dark:text-amber-300"
                : status === "partial_outage"
                  ? "text-orange-700 dark:text-orange-300"
                  : "text-red-700 dark:text-red-300"
          )}
        >
          {config.label}
        </span>
        {responseTime !== undefined && (
          <p className="text-xs text-muted-foreground mt-1">
            {responseTime}ms response
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================
// OVERALL STATUS BANNER
// ============================================

export interface OverallStatusBannerProps {
  status: StatusLevel;
  message?: string;
  className?: string;
}

export function OverallStatusBanner({
  status,
  message,
  className,
}: OverallStatusBannerProps) {
  const config = STATUS_CONFIG[status];

  const gradientColors = {
    operational: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    degraded: "from-amber-500/10 via-amber-500/5 to-transparent",
    partial_outage: "from-orange-500/10 via-orange-500/5 to-transparent",
    major_outage: "from-red-500/10 via-red-500/5 to-transparent",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-6 md:p-8",
        "bg-gradient-to-r",
        gradientColors[status],
        className
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        <div
          className={cn(
            "flex items-center justify-center w-16 h-16 rounded-2xl",
            config.bgColor
          )}
        >
          <StatusIndicator
            status={status}
            showLabel={false}
            showPulse={status !== "operational"}
            size="lg"
          />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            {config.label}
          </h2>
          <p className="text-muted-foreground mt-1">
            {message || config.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// EXPORT STATUS CONFIG FOR USE IN OTHER COMPONENTS
// ============================================

export { STATUS_CONFIG };
