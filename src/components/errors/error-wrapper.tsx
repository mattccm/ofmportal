"use client";

import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { ErrorBoundary } from "./error-boundary";

interface ErrorWrapperProps {
  children: ReactNode;
  fallbackTitle?: string;
  className?: string;
}

/**
 * Dashboard widget wrapper with built-in error boundary
 */
export function DashboardWidgetWrapper({
  children,
  fallbackTitle = "Widget Error",
  className,
}: ErrorWrapperProps) {
  return (
    <ErrorBoundary
      level="widget"
      fallback={
        <WidgetErrorCard title={fallbackTitle} className={className} />
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Dashboard section wrapper with built-in error boundary
 */
export function DashboardSectionWrapper({
  children,
  fallbackTitle = "Section Error",
  className,
}: ErrorWrapperProps) {
  return (
    <ErrorBoundary
      level="section"
      fallback={
        <SectionErrorCard title={fallbackTitle} className={className} />
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Simple widget error card component
 */
function WidgetErrorCard({
  title,
  className,
  onRetry,
}: {
  title: string;
  className?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-6 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-800/30 ${className}`}
    >
      <div className="h-12 w-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-3">
        <AlertCircle className="h-6 w-6 text-rose-500" />
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground text-center mb-3">
        Unable to load this component
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      )}
    </div>
  );
}

/**
 * Section error card component
 */
function SectionErrorCard({
  title,
  className,
  onRetry,
}: {
  title: string;
  className?: string;
  onRetry?: () => void;
}) {
  return (
    <Card
      className={`border-rose-200/50 dark:border-rose-800/30 bg-gradient-to-br from-rose-50/50 to-orange-50/30 dark:from-rose-950/20 dark:to-orange-950/10 ${className}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
            <AlertCircle className="h-5 w-5 text-rose-500" />
          </div>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          This section encountered an error and couldn&apos;t load properly.
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Async component wrapper for Suspense boundaries with error handling
 */
export function AsyncWrapper({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <ErrorBoundary
      level="widget"
      fallback={fallback || <WidgetErrorCard title="Loading Error" />}
    >
      {children}
    </ErrorBoundary>
  );
}
