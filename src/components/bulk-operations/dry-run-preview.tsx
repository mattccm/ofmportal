"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Eye,
  Play,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Clock,
  Info,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BulkOperationType, DryRunResult, DryRunItem } from "@/lib/bulk-operations";

interface DryRunPreviewProps {
  operationType: BulkOperationType;
  selectedItems: string[];
  onPreview: () => Promise<DryRunResult>;
  onExecute: () => void;
  isExecuting?: boolean;
  disabled?: boolean;
  className?: string;
}

export function DryRunPreview({
  operationType,
  selectedItems,
  onPreview,
  onExecute,
  isExecuting = false,
  disabled = false,
  className,
}: DryRunPreviewProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<DryRunResult | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Run dry-run preview
  const runPreview = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await onPreview();
      setPreviewResult(result);
      setShowPreview(true);
    } catch (error) {
      console.error("Failed to run preview:", error);
    } finally {
      setIsLoading(false);
    }
  }, [onPreview]);

  // Toggle expanded item
  const toggleExpanded = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Execute and close
  const handleExecute = () => {
    setShowPreview(false);
    onExecute();
  };

  // Format duration estimate
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return "Less than a second";
    if (ms < 60000) return `~${Math.round(ms / 1000)} seconds`;
    return `~${Math.round(ms / 60000)} minutes`;
  };

  return (
    <div className={cn("flex gap-2", className)}>
      {/* Dry Run Button */}
      <Button
        variant="outline"
        onClick={runPreview}
        disabled={disabled || selectedItems.length === 0 || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Eye className="mr-2 h-4 w-4" />
            Preview Changes
          </>
        )}
      </Button>

      {/* Execute Button */}
      <Button
        onClick={onExecute}
        disabled={disabled || selectedItems.length === 0 || isExecuting}
      >
        {isExecuting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" />
            Execute Now
          </>
        )}
      </Button>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Dry Run Preview
            </DialogTitle>
            <DialogDescription>
              Review what will happen before executing this operation.
            </DialogDescription>
          </DialogHeader>

          {previewResult && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className={cn(
                  "border-2",
                  previewResult.canProceed ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20" : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                )}>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      {previewResult.canProceed ? (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-500" />
                      )}
                    </div>
                    <p className="text-sm font-medium">
                      {previewResult.canProceed ? "Ready to Execute" : "Cannot Proceed"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold">{previewResult.willAffect}</p>
                    <p className="text-sm text-muted-foreground">Items Affected</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">
                      {formatDuration(previewResult.estimatedDuration)}
                    </p>
                    <p className="text-xs text-muted-foreground">Estimated Time</p>
                  </CardContent>
                </Card>
              </div>

              {/* Warnings */}
              {previewResult.warnings.length > 0 && (
                <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-300">
                          Warnings
                        </p>
                        <ul className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-400">
                          {previewResult.warnings.map((warning, i) => (
                            <li key={i}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Affected Items */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Changes Preview</CardTitle>
                  <CardDescription>
                    Review each item that will be affected by this operation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[300px]">
                    <div className="divide-y">
                      {previewResult.items.map((item) => (
                        <Collapsible
                          key={item.id}
                          open={expandedItems.has(item.id)}
                          onOpenChange={() => toggleExpanded(item.id)}
                        >
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50">
                              <Button variant="ghost" size="icon-sm" className="h-6 w-6">
                                {expandedItems.has(item.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>

                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{item.name}</p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {item.changeDescription}
                                </p>
                              </div>

                              {item.warningMessage && (
                                <Badge variant="outline" className="text-amber-600 border-amber-300">
                                  <AlertTriangle className="mr-1 h-3 w-3" />
                                  Warning
                                </Badge>
                              )}
                            </div>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            <div className="px-4 pb-4 pl-12">
                              <div className="p-3 bg-muted rounded-lg space-y-3">
                                {/* Current State */}
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">
                                    Current State
                                  </p>
                                  <pre className="text-xs bg-background p-2 rounded overflow-auto">
                                    {JSON.stringify(item.currentState, null, 2)}
                                  </pre>
                                </div>

                                {/* Arrow */}
                                <div className="flex items-center justify-center">
                                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </div>

                                {/* Proposed Change */}
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">
                                    After Operation
                                  </p>
                                  <pre className="text-xs bg-background p-2 rounded overflow-auto">
                                    {JSON.stringify(item.proposedChange, null, 2)}
                                  </pre>
                                </div>

                                {/* Item Warning */}
                                {item.warningMessage && (
                                  <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded text-sm">
                                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                    <span className="text-amber-700 dark:text-amber-400">
                                      {item.warningMessage}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Info Note */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm">
                <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <span className="text-blue-700 dark:text-blue-400">
                  This is a preview only. No changes have been made yet.
                  Click "Execute Now" to apply these changes.
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExecute}
              disabled={!previewResult?.canProceed || isExecuting}
            >
              <Play className="mr-2 h-4 w-4" />
              Execute Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Simpler inline preview for quick operations
interface InlineDryRunProps {
  itemCount: number;
  operationDescription: string;
  changes: { label: string; from: string; to: string }[];
  warnings?: string[];
  className?: string;
}

export function InlineDryRunPreview({
  itemCount,
  operationDescription,
  changes,
  warnings = [],
  className,
}: InlineDryRunProps) {
  return (
    <Card className={cn("border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20", className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Eye className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-blue-800 dark:text-blue-300">
              Preview: {operationDescription}
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              This will affect {itemCount} item(s)
            </p>

            {changes.length > 0 && (
              <div className="mt-3 space-y-2">
                {changes.map((change, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{change.label}:</span>
                    <Badge variant="outline" className="font-normal">
                      {change.from}
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="secondary">
                      {change.to}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {warnings.length > 0 && (
              <div className="mt-3 p-2 bg-amber-100 dark:bg-amber-900/30 rounded">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
                    {warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default DryRunPreview;
