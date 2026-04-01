"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Undo2,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  X,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  type BulkOperationType,
  type EnhancedUndoOperation,
  UNDO_STORAGE_KEY,
  UNDO_WINDOW_SECONDS,
  isUndoWindowValid,
  getRemainingUndoTime,
  getOperationTypeLabel,
} from "@/lib/bulk-operations";

interface UndoableOperation {
  operationId: string;
  type: BulkOperationType;
  description: string;
  affectedCount: number;
  affectedIds: string[];
  previousStates: Record<string, unknown>[];
  createdAt: string;
  expiresAt: string;
}

interface UndoManagerProps {
  className?: string;
}

interface UndoManagerState {
  operations: UndoableOperation[];
  isProcessing: boolean;
  processingId: string | null;
}

// Global undo state manager using a custom hook
export function useUndoManager() {
  const [state, setState] = useState<UndoManagerState>({
    operations: [],
    isProcessing: false,
    processingId: null,
  });

  // Load operations from storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(UNDO_STORAGE_KEY);
      if (stored) {
        const operations: UndoableOperation[] = JSON.parse(stored);
        // Filter out expired operations
        const validOperations = operations.filter((op) => isUndoWindowValid(op.expiresAt));
        setState((prev) => ({ ...prev, operations: validOperations }));

        // Update storage to remove expired
        if (validOperations.length !== operations.length) {
          localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(validOperations));
        }
      }
    } catch (error) {
      console.error("Failed to load undo operations:", error);
    }
  }, []);

  // Register a new undoable operation
  const registerUndo = useCallback((operation: UndoableOperation) => {
    setState((prev) => {
      const newOperations = [...prev.operations, operation];
      localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(newOperations));
      return { ...prev, operations: newOperations };
    });
  }, []);

  // Execute undo
  const executeUndo = useCallback(async (
    operationId: string,
    undoAction: () => Promise<boolean>
  ): Promise<boolean> => {
    setState((prev) => ({ ...prev, isProcessing: true, processingId: operationId }));

    try {
      const success = await undoAction();

      if (success) {
        setState((prev) => {
          const newOperations = prev.operations.filter((op) => op.operationId !== operationId);
          localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(newOperations));
          return { ...prev, operations: newOperations, isProcessing: false, processingId: null };
        });
        toast.success("Operation undone successfully");
        return true;
      } else {
        toast.error("Failed to undo operation");
        setState((prev) => ({ ...prev, isProcessing: false, processingId: null }));
        return false;
      }
    } catch (error) {
      console.error("Undo failed:", error);
      toast.error("Failed to undo operation");
      setState((prev) => ({ ...prev, isProcessing: false, processingId: null }));
      return false;
    }
  }, []);

  // Remove an operation (expired or dismissed)
  const removeOperation = useCallback((operationId: string) => {
    setState((prev) => {
      const newOperations = prev.operations.filter((op) => op.operationId !== operationId);
      localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(newOperations));
      return { ...prev, operations: newOperations };
    });
  }, []);

  // Clear all operations
  const clearAll = useCallback(() => {
    localStorage.removeItem(UNDO_STORAGE_KEY);
    setState((prev) => ({ ...prev, operations: [] }));
  }, []);

  return {
    operations: state.operations,
    isProcessing: state.isProcessing,
    processingId: state.processingId,
    registerUndo,
    executeUndo,
    removeOperation,
    clearAll,
    hasUndoableOperations: state.operations.length > 0,
  };
}

// Floating undo toast component
interface UndoToastProps {
  operation: UndoableOperation;
  onUndo: () => Promise<void>;
  onDismiss: () => void;
  isProcessing?: boolean;
}

export function UndoToast({
  operation,
  onUndo,
  onDismiss,
  isProcessing = false,
}: UndoToastProps) {
  const [timeLeft, setTimeLeft] = useState(getRemainingUndoTime(operation.expiresAt));
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const remaining = getRemainingUndoTime(operation.expiresAt);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        onDismiss();
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [operation.expiresAt, onDismiss]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    return `${secs}s`;
  };

  const progress = (timeLeft / UNDO_WINDOW_SECONDS) * 100;

  return (
    <Card className="fixed bottom-4 right-4 z-50 shadow-lg border-amber-200 bg-white dark:bg-gray-900 w-[380px]">
      <CardContent className="p-4">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100 dark:bg-gray-800 overflow-hidden rounded-t-lg">
          <div
            className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-start gap-3 mt-1">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
            <History className="h-5 w-5 text-amber-600" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{operation.description}</p>
              <Badge variant="secondary" className="text-xs">
                {operation.affectedCount} item(s)
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {getOperationTypeLabel(operation.type)} completed
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDismiss}
            className="h-6 w-6 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Undo available for {formatTime(timeLeft)}</span>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={onUndo}
            disabled={isProcessing}
            className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950"
          >
            {isProcessing ? (
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
      </CardContent>
    </Card>
  );
}

// Full undo manager panel (for history view)
export function UndoManager({ className }: UndoManagerProps) {
  const {
    operations,
    isProcessing,
    processingId,
    executeUndo,
    removeOperation,
    clearAll,
  } = useUndoManager();

  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<UndoableOperation | null>(null);

  const handleUndo = async (operation: UndoableOperation) => {
    // This would be replaced with actual undo API call
    const undoAction = async (): Promise<boolean> => {
      try {
        const response = await fetch(`/api/bulk-operations/undo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operationId: operation.operationId,
            type: operation.type,
            affectedIds: operation.affectedIds,
            previousStates: operation.previousStates,
          }),
        });

        return response.ok;
      } catch {
        return false;
      }
    };

    await executeUndo(operation.operationId, undoAction);
  };

  if (operations.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Undo2 className="h-4 w-4" />
          Recent Operations (Undoable)
        </h3>
        <Button variant="ghost" size="sm" onClick={clearAll}>
          Clear All
        </Button>
      </div>

      <div className="space-y-2">
        {operations.map((operation) => {
          const timeLeft = getRemainingUndoTime(operation.expiresAt);
          const isExpired = timeLeft <= 0;
          const isCurrentlyProcessing = processingId === operation.operationId;

          return (
            <Card
              key={operation.operationId}
              className={cn(
                "transition-opacity",
                isExpired && "opacity-50"
              )}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {operation.description}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {operation.affectedCount}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{getOperationTypeLabel(operation.type)}</span>
                      {!isExpired && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Clock className="h-3 w-3" />
                          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")} remaining
                        </span>
                      )}
                      {isExpired && (
                        <span className="text-red-500">Expired</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {!isExpired && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUndo(operation)}
                        disabled={isProcessing}
                      >
                        {isCurrentlyProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Undo2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeOperation(operation.operationId)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Confirmation dialog for undo
interface UndoConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operation: UndoableOperation | null;
  onConfirm: () => void;
  isProcessing: boolean;
}

export function UndoConfirmDialog({
  open,
  onOpenChange,
  operation,
  onConfirm,
  isProcessing,
}: UndoConfirmDialogProps) {
  if (!operation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5" />
            Undo Operation?
          </DialogTitle>
          <DialogDescription>
            This will revert the following operation:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <History className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{operation.description}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getOperationTypeLabel(operation.type)} - {operation.affectedCount} item(s) affected
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                This action will:
              </p>
              <ul className="mt-2 space-y-1 text-amber-700 dark:text-amber-400 list-disc list-inside">
                <li>Restore {operation.affectedCount} item(s) to their previous state</li>
                <li>Remove notifications that were sent</li>
                <li>Log this undo action in the activity history</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Undoing...
              </>
            ) : (
              <>
                <Undo2 className="mr-2 h-4 w-4" />
                Confirm Undo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UndoManager;
