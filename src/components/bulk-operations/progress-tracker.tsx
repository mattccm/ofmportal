"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Undo2,
  Clock,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BulkOperationProgress, BulkOperationStatus } from "@/lib/bulk-operations";

interface ProgressTrackerProps {
  operationId?: string;
  title: string;
  status: BulkOperationStatus;
  progress: number;
  processedItems: number;
  totalItems: number;
  successCount: number;
  failedCount: number;
  currentItem?: string;
  estimatedTimeRemaining?: number;
  canUndo?: boolean;
  undoExpiresAt?: Date;
  onUndo?: () => Promise<void>;
  onDismiss?: () => void;
  errors?: string[];
  className?: string;
}

export function ProgressTracker({
  operationId,
  title,
  status,
  progress,
  processedItems,
  totalItems,
  successCount,
  failedCount,
  currentItem,
  estimatedTimeRemaining,
  canUndo = false,
  undoExpiresAt,
  onUndo,
  onDismiss,
  errors = [],
  className,
}: ProgressTrackerProps) {
  const [undoTimeLeft, setUndoTimeLeft] = useState<number | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // Calculate undo countdown
  useEffect(() => {
    if (!canUndo || !undoExpiresAt) {
      setUndoTimeLeft(null);
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const expiresAt = new Date(undoExpiresAt);
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      setUndoTimeLeft(diff);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [canUndo, undoExpiresAt]);

  const handleUndo = useCallback(async () => {
    if (!onUndo) return;
    setIsUndoing(true);
    try {
      await onUndo();
    } finally {
      setIsUndoing(false);
    }
  }, [onUndo]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStatusIcon = () => {
    switch (status) {
      case "in_progress":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "partially_completed":
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "rolled_back":
        return <Undo2 className="h-5 w-5 text-gray-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case "pending":
        return "Pending";
      case "in_progress":
        return "Processing...";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      case "partially_completed":
        return "Partially Completed";
      case "rolled_back":
        return "Rolled Back";
      default:
        return status;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "in_progress":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      case "partially_completed":
        return "bg-amber-500";
      case "rolled_back":
        return "bg-gray-500";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={cn(
                "text-white",
                getStatusColor()
              )}
            >
              {getStatusLabel()}
            </Badge>
            {onDismiss && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onDismiss}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 bg-muted rounded-full overflow-hidden mb-3">
          <div
            className={cn(
              "absolute inset-y-0 left-0 transition-all duration-300",
              getStatusColor()
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span>
            {processedItems} of {totalItems} items
          </span>
          <span>{Math.round(progress)}%</span>
        </div>

        {/* Success/Failure counts */}
        {(successCount > 0 || failedCount > 0) && (
          <div className="flex items-center gap-4 text-sm mb-2">
            {successCount > 0 && (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                {successCount} succeeded
              </span>
            )}
            {failedCount > 0 && (
              <button
                onClick={() => setShowErrors(!showErrors)}
                className="flex items-center gap-1 text-red-600 hover:underline"
              >
                <XCircle className="h-4 w-4" />
                {failedCount} failed
              </button>
            )}
          </div>
        )}

        {/* Current item being processed */}
        {status === "in_progress" && currentItem && (
          <div className="text-sm text-muted-foreground truncate">
            Processing: {currentItem}
          </div>
        )}

        {/* Estimated time remaining */}
        {status === "in_progress" && estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && (
          <div className="text-sm text-muted-foreground mt-1">
            Est. time remaining: {formatTime(estimatedTimeRemaining)}
          </div>
        )}

        {/* Error list */}
        {showErrors && errors.length > 0 && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
            <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
              Errors:
            </p>
            <ul className="text-sm text-red-600 dark:text-red-400 space-y-1 list-disc list-inside max-h-32 overflow-y-auto">
              {errors.slice(0, 10).map((error, i) => (
                <li key={i} className="truncate">
                  {error}
                </li>
              ))}
              {errors.length > 10 && (
                <li className="text-muted-foreground">
                  ...and {errors.length - 10} more errors
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Undo button */}
        {canUndo && undoTimeLeft !== null && undoTimeLeft > 0 && onUndo && (
          <div className="mt-3 flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
              <Clock className="h-4 w-4" />
              <span>Undo available for {undoTimeLeft}s</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={isUndoing}
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              {isUndoing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Undoing...
                </>
              ) : (
                <>
                  <Undo2 className="mr-2 h-4 w-4" />
                  Undo
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Multiple operations tracker
interface MultiProgressTrackerProps {
  operations: BulkOperationProgress[];
  className?: string;
}

export function MultiProgressTracker({
  operations,
  className,
}: MultiProgressTrackerProps) {
  if (operations.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {operations.map((op) => (
        <ProgressTracker
          key={op.operationId}
          operationId={op.operationId}
          title={`Operation ${op.operationId.slice(-6)}`}
          status={op.status}
          progress={op.progress}
          processedItems={op.processedItems}
          totalItems={op.totalItems}
          successCount={op.successCount}
          failedCount={op.failedCount}
          currentItem={op.currentItem}
          estimatedTimeRemaining={op.estimatedTimeRemaining}
        />
      ))}
    </div>
  );
}

export default ProgressTracker;
