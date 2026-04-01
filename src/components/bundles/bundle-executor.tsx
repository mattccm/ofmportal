"use client";

import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import { format, addDays } from "date-fns";
import {
  Package,
  Users,
  Calendar,
  Clock,
  AlertTriangle,
  Zap,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Edit2,
  Bell,
  BellOff,
  Play,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  RequestBundle,
  TemplateConfig,
  UrgencyLevel,
  BundleExecutionConfig,
  BundleExecutionResult,
} from "@/types/request-bundles";

// ============================================
// TYPES
// ============================================

interface Template {
  id: string;
  name: string;
  description?: string | null;
  fieldCount: number;
  defaultDueDays: number;
  defaultUrgency: UrgencyLevel;
}

interface Creator {
  id: string;
  name: string;
  email: string;
}

interface BundleWithTemplates extends RequestBundle {
  templates: Template[];
}

interface BundleExecutorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundle: BundleWithTemplates | null;
  creators: Creator[];
  onExecute: (config: BundleExecutionConfig) => Promise<BundleExecutionResult>;
  preSelectedCreatorIds?: string[];
}

// ============================================
// URGENCY CONFIG
// ============================================

const URGENCY_CONFIG: Record<UrgencyLevel, { label: string; color: string; bgColor: string }> = {
  LOW: { label: "Low", color: "text-slate-500", bgColor: "bg-slate-500/10" },
  NORMAL: { label: "Normal", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  HIGH: { label: "High", color: "text-amber-500", bgColor: "bg-amber-500/10" },
  URGENT: { label: "Urgent", color: "text-red-500", bgColor: "bg-red-500/10" },
};

// ============================================
// EXECUTION STEPS
// ============================================

type ExecutionStep = "select-creators" | "preview" | "executing" | "complete";

// ============================================
// MAIN COMPONENT
// ============================================

export function BundleExecutor({
  open,
  onOpenChange,
  bundle,
  creators,
  onExecute,
  preSelectedCreatorIds = [],
}: BundleExecutorProps) {
  // State
  const [step, setStep] = useState<ExecutionStep>("select-creators");
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<string[]>(preSelectedCreatorIds);
  const [sendNotifications, setSendNotifications] = useState(true);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [overrides, setOverrides] = useState<Map<string, { dueDate?: string; urgency?: UrgencyLevel; sendNotification?: boolean }>>(
    new Map()
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [result, setResult] = useState<BundleExecutionResult | null>(null);
  const [expandedCreators, setExpandedCreators] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setStep("select-creators");
      setSelectedCreatorIds(preSelectedCreatorIds);
      setSendNotifications(true);
      setStartDate(format(new Date(), "yyyy-MM-dd"));
      setOverrides(new Map());
      setIsExecuting(false);
      setExecutionProgress(0);
      setResult(null);
      setExpandedCreators(new Set());
      setSearchQuery("");
    }
  }, [open, preSelectedCreatorIds]);

  // Filtered creators
  const filteredCreators = useMemo(() => {
    if (!searchQuery) return creators;
    const query = searchQuery.toLowerCase();
    return creators.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query)
    );
  }, [creators, searchQuery]);

  // Calculate preview requests for a creator
  const getPreviewRequestsForCreator = useCallback(
    (creatorId: string) => {
      if (!bundle) return [];

      const baseDate = new Date(startDate);
      return bundle.templateIds.map((templateId) => {
        const template = bundle.templates.find((t) => t.id === templateId);
        const config = bundle.templateConfigs.find((c) => c.templateId === templateId);
        const override = overrides.get(`${creatorId}-${templateId}`);

        if (!template) return null;

        const dueDays = config?.defaultDueDays ?? template.defaultDueDays;
        const staggerDays = config?.staggerDays ?? 0;
        const urgency = override?.urgency ?? config?.defaultUrgency ?? template.defaultUrgency;
        const dueDate = override?.dueDate
          ? new Date(override.dueDate)
          : addDays(addDays(baseDate, staggerDays), dueDays);

        return {
          templateId,
          templateName: template.name,
          dueDate: format(dueDate, "MMM d, yyyy"),
          dueDateRaw: format(dueDate, "yyyy-MM-dd"),
          urgency,
          sendNotification: override?.sendNotification ?? sendNotifications,
        };
      }).filter(Boolean);
    },
    [bundle, startDate, overrides, sendNotifications]
  );

  // Total requests to create
  const totalRequestsToCreate = useMemo(() => {
    return selectedCreatorIds.length * (bundle?.templateIds.length || 0);
  }, [selectedCreatorIds, bundle]);

  // Handle creator selection
  const handleCreatorToggle = (creatorId: string, checked: boolean) => {
    if (checked) {
      setSelectedCreatorIds((prev) => [...prev, creatorId]);
    } else {
      setSelectedCreatorIds((prev) => prev.filter((id) => id !== creatorId));
    }
  };

  const handleSelectAllCreators = () => {
    if (selectedCreatorIds.length === filteredCreators.length) {
      setSelectedCreatorIds([]);
    } else {
      setSelectedCreatorIds(filteredCreators.map((c) => c.id));
    }
  };

  // Handle override changes
  const handleOverrideChange = (
    creatorId: string,
    templateId: string,
    field: "dueDate" | "urgency" | "sendNotification",
    value: string | boolean
  ) => {
    const key = `${creatorId}-${templateId}`;
    const current = overrides.get(key) || {};
    setOverrides(new Map(overrides.set(key, { ...current, [field]: value })));
  };

  // Toggle creator expansion
  const toggleCreatorExpanded = (creatorId: string) => {
    const newExpanded = new Set(expandedCreators);
    if (newExpanded.has(creatorId)) {
      newExpanded.delete(creatorId);
    } else {
      newExpanded.add(creatorId);
    }
    setExpandedCreators(newExpanded);
  };

  // Execute bundle
  const handleExecute = async () => {
    if (!bundle) return;

    setIsExecuting(true);
    setStep("executing");
    setExecutionProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setExecutionProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    try {
      const config: BundleExecutionConfig = {
        bundleId: bundle.id,
        creatorIds: selectedCreatorIds,
        sendNotifications,
        startDate,
        overrides: Array.from(overrides.entries()).map(([key, value]) => {
          const [creatorId, templateId] = key.split("-");
          return {
            templateId,
            dueDate: value.dueDate,
            urgency: value.urgency,
            sendNotification: value.sendNotification,
          };
        }),
      };

      const executionResult = await onExecute(config);
      clearInterval(progressInterval);
      setExecutionProgress(100);
      setResult(executionResult);
      setStep("complete");

      if (executionResult.totalFailed === 0) {
        toast.success(`Successfully created ${executionResult.totalCreated} requests`);
      } else {
        toast.warning(
          `Created ${executionResult.totalCreated} requests, ${executionResult.totalFailed} failed`
        );
      }
    } catch (error) {
      clearInterval(progressInterval);
      toast.error("Failed to execute bundle");
      setStep("preview");
    } finally {
      setIsExecuting(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case "select-creators":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Select creators to apply this bundle to
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAllCreators}
              >
                {selectedCreatorIds.length === filteredCreators.length
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>

            <Input
              placeholder="Search creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-2 space-y-2">
                {filteredCreators.map((creator) => (
                  <div
                    key={creator.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                      selectedCreatorIds.includes(creator.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    )}
                    onClick={() =>
                      handleCreatorToggle(creator.id, !selectedCreatorIds.includes(creator.id))
                    }
                  >
                    <Checkbox
                      checked={selectedCreatorIds.includes(creator.id)}
                      onCheckedChange={(checked) =>
                        handleCreatorToggle(creator.id, checked as boolean)
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{creator.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {creator.email}
                      </p>
                    </div>
                  </div>
                ))}

                {filteredCreators.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No creators match your search" : "No creators available"}
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm">
                {selectedCreatorIds.length} creator{selectedCreatorIds.length !== 1 ? "s" : ""} selected
              </span>
              <span className="text-sm text-muted-foreground">
                {totalRequestsToCreate} request{totalRequestsToCreate !== 1 ? "s" : ""} will be created
              </span>
            </div>
          </div>
        );

      case "preview":
        return (
          <div className="space-y-4">
            {/* Global Settings */}
            <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg border bg-muted/30">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Due dates are calculated from this date
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
                <div className="space-y-0.5">
                  <Label htmlFor="send-notifications" className="cursor-pointer">
                    Send Notifications
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Email creators about new requests
                  </p>
                </div>
                <Switch
                  id="send-notifications"
                  checked={sendNotifications}
                  onCheckedChange={setSendNotifications}
                />
              </div>
            </div>

            {/* Creator Previews */}
            <ScrollArea className="h-[350px]">
              <div className="space-y-3 pr-4">
                {selectedCreatorIds.map((creatorId) => {
                  const creator = creators.find((c) => c.id === creatorId);
                  if (!creator) return null;

                  const requests = getPreviewRequestsForCreator(creatorId);
                  const isExpanded = expandedCreators.has(creatorId);

                  return (
                    <Card key={creatorId} className="overflow-hidden">
                      <CardHeader
                        className="py-3 cursor-pointer"
                        onClick={() => toggleCreatorExpanded(creatorId)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                              {creator.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <CardTitle className="text-sm">{creator.name}</CardTitle>
                              <CardDescription className="text-xs">
                                {requests.length} requests
                              </CardDescription>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </CardHeader>

                      {isExpanded && (
                        <CardContent className="pt-0 space-y-2">
                          {requests.map((request: {
                            templateId: string;
                            templateName: string;
                            dueDate: string;
                            dueDateRaw: string;
                            urgency: UrgencyLevel;
                            sendNotification: boolean;
                          } | null) => {
                            if (!request) return null;
                            return (
                              <div
                                key={request.templateId}
                                className="p-3 rounded-lg border bg-muted/30"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">
                                      {request.templateName}
                                    </p>
                                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Due: {request.dueDate}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-xs",
                                          URGENCY_CONFIG[request.urgency].color
                                        )}
                                      >
                                        {URGENCY_CONFIG[request.urgency].label}
                                      </Badge>
                                    </div>
                                  </div>

                                  {/* Quick Edit Controls */}
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="date"
                                      value={
                                        overrides.get(`${creatorId}-${request.templateId}`)?.dueDate ||
                                        request.dueDateRaw
                                      }
                                      onChange={(e) =>
                                        handleOverrideChange(
                                          creatorId,
                                          request.templateId,
                                          "dueDate",
                                          e.target.value
                                        )
                                      }
                                      className="h-7 w-32 text-xs"
                                    />
                                    <Select
                                      value={request.urgency}
                                      onValueChange={(v) =>
                                        handleOverrideChange(
                                          creatorId,
                                          request.templateId,
                                          "urgency",
                                          v
                                        )
                                      }
                                    >
                                      <SelectTrigger className="h-7 w-24 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Object.entries(URGENCY_CONFIG).map(([key, { label }]) => (
                                          <SelectItem key={key} value={key}>
                                            {label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Summary */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div>
                <p className="font-medium">Ready to create</p>
                <p className="text-sm text-muted-foreground">
                  {totalRequestsToCreate} requests for {selectedCreatorIds.length} creator
                  {selectedCreatorIds.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {sendNotifications ? (
                  <>
                    <Bell className="h-4 w-4" />
                    Notifications enabled
                  </>
                ) : (
                  <>
                    <BellOff className="h-4 w-4" />
                    No notifications
                  </>
                )}
              </div>
            </div>
          </div>
        );

      case "executing":
        return (
          <div className="py-8 space-y-6 text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Creating Requests...</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Please wait while we create {totalRequestsToCreate} requests
              </p>
            </div>
            <Progress value={executionProgress} className="w-full max-w-xs mx-auto" />
            <p className="text-sm text-muted-foreground">{executionProgress}% complete</p>
          </div>
        );

      case "complete":
        return (
          <div className="py-6 space-y-6">
            <div className="text-center">
              <div
                className={cn(
                  "mx-auto h-16 w-16 rounded-2xl flex items-center justify-center",
                  result?.totalFailed === 0
                    ? "bg-emerald-500/10"
                    : "bg-amber-500/10"
                )}
              >
                {result?.totalFailed === 0 ? (
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                )}
              </div>
              <h3 className="text-lg font-semibold mt-4">
                {result?.totalFailed === 0 ? "Bundle Executed Successfully" : "Bundle Executed with Errors"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Created {result?.totalCreated || 0} of {totalRequestsToCreate} requests
              </p>
            </div>

            {/* Results Summary */}
            {result && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="bg-emerald-500/5 border-emerald-500/20">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                      <div>
                        <p className="font-medium">{result.totalCreated} Successful</p>
                        <p className="text-sm text-muted-foreground">Requests created</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={cn(
                    result.totalFailed > 0
                      ? "bg-red-500/5 border-red-500/20"
                      : "bg-muted/50"
                  )}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <XCircle
                        className={cn(
                          "h-5 w-5",
                          result.totalFailed > 0 ? "text-red-500" : "text-muted-foreground"
                        )}
                      />
                      <div>
                        <p className="font-medium">{result.totalFailed} Failed</p>
                        <p className="text-sm text-muted-foreground">Requests not created</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Created Requests List */}
            {result && result.createdRequests.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Created Requests</h4>
                <ScrollArea className="h-[200px] border rounded-lg">
                  <div className="p-2 space-y-2">
                    {result.createdRequests.map((request) => (
                      <div
                        key={request.requestId}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{request.title}</p>
                          <p className="text-xs text-muted-foreground">
                            For: {request.creatorName} | Due: {request.dueDate || "No date"}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {request.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Failed Requests */}
            {result && result.failedRequests.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-red-500">Failed Requests</h4>
                <ScrollArea className="h-[100px] border border-red-500/20 rounded-lg">
                  <div className="p-2 space-y-2">
                    {result.failedRequests.map((failed, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 rounded-lg bg-red-500/5"
                      >
                        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        <p className="text-xs text-muted-foreground truncate">
                          {failed.error}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        );
    }
  };

  // Render footer buttons
  const renderFooter = () => {
    switch (step) {
      case "select-creators":
        return (
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => setStep("preview")}
              disabled={selectedCreatorIds.length === 0}
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </>
        );

      case "preview":
        return (
          <>
            <Button variant="outline" onClick={() => setStep("select-creators")}>
              Back
            </Button>
            <Button onClick={handleExecute} disabled={isExecuting}>
              <Play className="h-4 w-4 mr-2" />
              Execute Bundle
            </Button>
          </>
        );

      case "executing":
        return null;

      case "complete":
        return (
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        );
    }
  };

  if (!bundle) return null;

  return (
    <Dialog open={open} onOpenChange={step === "executing" ? undefined : onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Execute Bundle: {bundle.name}</DialogTitle>
              <DialogDescription>
                {bundle.templateIds.length} template{bundle.templateIds.length !== 1 ? "s" : ""} in this bundle
              </DialogDescription>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-2 pt-4">
            {["select-creators", "preview", "complete"].map((s, index) => (
              <React.Fragment key={s}>
                <div
                  className={cn(
                    "flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium transition-colors",
                    step === s || (step === "executing" && s === "preview")
                      ? "bg-primary text-primary-foreground"
                      : ["complete"].includes(step) || (step === "preview" && index === 0)
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {index + 1}
                </div>
                {index < 2 && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 transition-colors",
                      (step === "preview" && index === 0) ||
                        step === "executing" ||
                        step === "complete"
                        ? "bg-primary"
                        : "bg-muted"
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {renderStepContent()}
        </div>

        <DialogFooter>{renderFooter()}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BundleExecutor;
