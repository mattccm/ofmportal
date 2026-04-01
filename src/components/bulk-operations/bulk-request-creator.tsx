"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Search,
  FileText,
  Calendar,
  Send,
  Loader2,
  CheckCircle,
  ChevronRight,
  ChevronDown,
  X,
  Sparkles,
  Eye,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ProgressTracker } from "./progress-tracker";
import { cn } from "@/lib/utils";
import { parseTokens } from "@/lib/bulk-operations";

// Types
interface Creator {
  id: string;
  name: string;
  email: string;
  groups?: string[];
  tags?: string[];
  lastActive?: string;
}

interface CreatorGroup {
  id: string;
  name: string;
  creatorIds: string[];
  color?: string;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  defaultDueDays: number;
  defaultUrgency: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  fields?: unknown[];
}

interface BulkRequestCreatorProps {
  onComplete?: (result: BulkRequestResult) => void;
  onCancel?: () => void;
}

interface BulkRequestResult {
  operationId: string;
  created: number;
  failed: number;
  total: number;
  createdRequestIds: string[];
  canUndo: boolean;
  undoExpiresAt: string;
}

interface RequestPreviewItem {
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  title: string;
  description: string;
  dueDate: string;
  urgency: string;
}

type Step = "creators" | "template" | "configure" | "preview" | "sending";

export function BulkRequestCreator({
  onComplete,
  onCancel,
}: BulkRequestCreatorProps) {
  // Step state
  const [currentStep, setCurrentStep] = useState<Step>("creators");

  // Data states
  const [creators, setCreators] = useState<Creator[]>([]);
  const [groups, setGroups] = useState<CreatorGroup[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selection states
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<Set<string>>(new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Configuration states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));
  const [urgency, setUrgency] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [sendNotifications, setSendNotifications] = useState(true);
  const [useTokens, setUseTokens] = useState(false);
  const [staggerDates, setStaggerDates] = useState(false);
  const [staggerInterval, setStaggerInterval] = useState(1);

  // Sending states
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResult, setSendResult] = useState<BulkRequestResult | null>(null);

  // Preview states
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewItems, setPreviewItems] = useState<RequestPreviewItem[]>([]);

  // Search state
  const [creatorSearch, setCreatorSearch] = useState("");

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [creatorsRes, templatesRes, groupsRes] = await Promise.all([
          fetch("/api/creators"),
          fetch("/api/templates"),
          fetch("/api/creators/groups"),
        ]);

        if (creatorsRes.ok) {
          const data = await creatorsRes.json();
          setCreators(data);
        }

        if (templatesRes.ok) {
          const data = await templatesRes.json();
          setTemplates(data);
        }

        if (groupsRes.ok) {
          const data = await groupsRes.json();
          setGroups(data);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error("Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // Get selected template details
  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    return templates.find((t) => t.id === selectedTemplateId);
  }, [selectedTemplateId, templates]);

  // Update defaults when template changes
  useEffect(() => {
    if (selectedTemplate) {
      setDueDate(format(addDays(new Date(), selectedTemplate.defaultDueDays), "yyyy-MM-dd"));
      setUrgency(selectedTemplate.defaultUrgency);
    }
  }, [selectedTemplate]);

  // Filter creators by search
  const filteredCreators = useMemo(() => {
    if (!creatorSearch.trim()) return creators;
    const search = creatorSearch.toLowerCase();
    return creators.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.email.toLowerCase().includes(search)
    );
  }, [creators, creatorSearch]);

  // Get all selected creators (including from groups)
  const allSelectedCreators = useMemo(() => {
    const ids = new Set(selectedCreatorIds);

    // Add creators from selected groups
    for (const groupId of selectedGroupIds) {
      const group = groups.find((g) => g.id === groupId);
      if (group) {
        group.creatorIds.forEach((id) => ids.add(id));
      }
    }

    return creators.filter((c) => ids.has(c.id));
  }, [selectedCreatorIds, selectedGroupIds, creators, groups]);

  // Toggle creator selection
  const toggleCreator = useCallback((creatorId: string) => {
    setSelectedCreatorIds((prev) => {
      const next = new Set(prev);
      if (next.has(creatorId)) {
        next.delete(creatorId);
      } else {
        next.add(creatorId);
      }
      return next;
    });
  }, []);

  // Toggle group selection
  const toggleGroup = useCallback((groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Select all / none
  const selectAllCreators = useCallback(() => {
    setSelectedCreatorIds(new Set(creators.map((c) => c.id)));
  }, [creators]);

  const clearSelection = useCallback(() => {
    setSelectedCreatorIds(new Set());
    setSelectedGroupIds(new Set());
  }, []);

  // Generate preview items
  const generatePreview = useCallback(() => {
    const items: RequestPreviewItem[] = allSelectedCreators.map((creator, index) => {
      let itemTitle = title || (selectedTemplate?.name ? `${selectedTemplate.name} Request` : "Content Request");
      let itemDescription = description;

      // Apply token personalization
      if (useTokens) {
        const tokenData = {
          creator: {
            name: creator.name,
            email: creator.email,
          },
          due_date: dueDate,
        };
        itemTitle = parseTokens(itemTitle, tokenData);
        itemDescription = parseTokens(itemDescription, tokenData);
      }

      // Calculate staggered due date
      let itemDueDate = dueDate;
      if (staggerDates && index > 0) {
        const baseDate = new Date(dueDate);
        baseDate.setDate(baseDate.getDate() + (index * staggerInterval));
        itemDueDate = format(baseDate, "yyyy-MM-dd");
      }

      return {
        creatorId: creator.id,
        creatorName: creator.name,
        creatorEmail: creator.email,
        title: itemTitle,
        description: itemDescription,
        dueDate: itemDueDate,
        urgency,
      };
    });

    setPreviewItems(items);
    setShowPreviewDialog(true);
  }, [allSelectedCreators, title, description, dueDate, urgency, selectedTemplate, useTokens, staggerDates, staggerInterval]);

  // Send bulk requests
  const sendRequests = useCallback(async () => {
    if (allSelectedCreators.length === 0) {
      toast.error("No creators selected");
      return;
    }

    setIsSending(true);
    setSendProgress(0);
    setCurrentStep("sending");

    try {
      const requests = allSelectedCreators.map((creator, index) => {
        let itemTitle = title || (selectedTemplate?.name ? `${selectedTemplate.name} Request` : "Content Request");
        let itemDescription = description;

        if (useTokens) {
          const tokenData = {
            creator: {
              name: creator.name,
              email: creator.email,
            },
            due_date: dueDate,
          };
          itemTitle = parseTokens(itemTitle, tokenData);
          itemDescription = parseTokens(itemDescription, tokenData);
        }

        let itemDueDate = dueDate;
        if (staggerDates && index > 0) {
          const baseDate = new Date(dueDate);
          baseDate.setDate(baseDate.getDate() + (index * staggerInterval));
          itemDueDate = format(baseDate, "yyyy-MM-dd");
        }

        return {
          creatorId: creator.id,
          title: itemTitle,
          description: itemDescription,
          dueDate: itemDueDate,
          urgency,
        };
      });

      // Simulate progress while request is processing
      const progressInterval = setInterval(() => {
        setSendProgress((prev) => Math.min(prev + 5, 90));
      }, 200);

      const response = await fetch("/api/requests/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          requests,
          sendNotifications,
          staggerDates: staggerDates
            ? { enabled: true, intervalDays: staggerInterval }
            : undefined,
          personalization: useTokens
            ? { enabled: true, tokens: {} }
            : undefined,
        }),
      });

      clearInterval(progressInterval);
      setSendProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create requests");
      }

      setSendResult(data);

      if (data.created > 0) {
        toast.success(`Successfully created ${data.created} request(s)`);
      }
      if (data.failed > 0) {
        toast.error(`Failed to create ${data.failed} request(s)`);
      }

      onComplete?.(data);
    } catch (error) {
      console.error("Failed to send bulk requests:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create requests");
      setSendResult({
        operationId: "",
        created: 0,
        failed: allSelectedCreators.length,
        total: allSelectedCreators.length,
        createdRequestIds: [],
        canUndo: false,
        undoExpiresAt: "",
      });
    } finally {
      setIsSending(false);
    }
  }, [
    allSelectedCreators,
    title,
    description,
    dueDate,
    urgency,
    selectedTemplateId,
    selectedTemplate,
    useTokens,
    staggerDates,
    staggerInterval,
    sendNotifications,
    onComplete,
  ]);

  // Handle undo
  const handleUndo = useCallback(async () => {
    if (!sendResult?.operationId || !sendResult.createdRequestIds.length) return;

    try {
      const response = await fetch("/api/requests/bulk-create", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId: sendResult.operationId,
          requestIds: sendResult.createdRequestIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to undo");
      }

      toast.success(`Rolled back ${data.deleted} request(s)`);
      setSendResult((prev) =>
        prev
          ? {
              ...prev,
              canUndo: false,
            }
          : null
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to undo");
    }
  }, [sendResult]);

  // Step validation
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case "creators":
        return allSelectedCreators.length > 0;
      case "template":
        return true; // Template is optional
      case "configure":
        return title.trim().length > 0;
      case "preview":
        return true;
      default:
        return false;
    }
  }, [currentStep, allSelectedCreators.length, title]);

  // Navigation
  const goToStep = (step: Step) => {
    setCurrentStep(step);
  };

  const goNext = () => {
    const steps: Step[] = ["creators", "template", "configure", "preview"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const goBack = () => {
    const steps: Step[] = ["creators", "template", "configure", "preview"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Sending / Result state
  if (currentStep === "sending") {
    return (
      <div className="space-y-6">
        <ProgressTracker
          operationId={sendResult?.operationId}
          title="Creating Bulk Requests"
          status={
            isSending
              ? "in_progress"
              : sendResult?.failed === 0
              ? "completed"
              : sendResult?.created === 0
              ? "failed"
              : "partially_completed"
          }
          progress={sendProgress}
          processedItems={sendResult ? sendResult.created + sendResult.failed : 0}
          totalItems={allSelectedCreators.length}
          successCount={sendResult?.created || 0}
          failedCount={sendResult?.failed || 0}
          canUndo={sendResult?.canUndo}
          undoExpiresAt={sendResult?.undoExpiresAt ? new Date(sendResult.undoExpiresAt) : undefined}
          onUndo={handleUndo}
        />

        {sendResult && (
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={onCancel}>
              Close
            </Button>
            <Button
              onClick={() => {
                clearSelection();
                setTitle("");
                setDescription("");
                setSendResult(null);
                setCurrentStep("creators");
              }}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Create More
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { id: "creators", label: "Select Creators", icon: Users },
          { id: "template", label: "Template", icon: FileText },
          { id: "configure", label: "Configure", icon: Calendar },
          { id: "preview", label: "Preview & Send", icon: Send },
        ].map((step, index, arr) => (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => goToStep(step.id as Step)}
              disabled={step.id === "preview" && !canProceed}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors",
                currentStep === step.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <step.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {index < arr.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {currentStep === "creators" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Select Creators
            </CardTitle>
            <CardDescription>
              Choose the creators who will receive content requests.
              Selected: {allSelectedCreators.length} creator(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search and selection controls */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search creators..."
                  value={creatorSearch}
                  onChange={(e) => setCreatorSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllCreators}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>

            {/* Groups section */}
            {groups.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Quick Select Groups</Label>
                <div className="flex flex-wrap gap-2">
                  {groups.map((group) => (
                    <Badge
                      key={group.id}
                      variant={selectedGroupIds.has(group.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleGroup(group.id)}
                    >
                      {group.name} ({group.creatorIds.length})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Creator list */}
            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-2 space-y-1">
                {filteredCreators.map((creator) => {
                  const isSelected = selectedCreatorIds.has(creator.id) ||
                    Array.from(selectedGroupIds).some((gid) => {
                      const group = groups.find((g) => g.id === gid);
                      return group?.creatorIds.includes(creator.id);
                    });

                  return (
                    <div
                      key={creator.id}
                      onClick={() => toggleCreator(creator.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                        isSelected
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted"
                      )}
                    >
                      <Checkbox checked={isSelected} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{creator.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {creator.email}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
                {filteredCreators.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No creators found
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {currentStep === "template" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Choose Template (Optional)
            </CardTitle>
            <CardDescription>
              Select a request template to use as a starting point.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* No template option */}
              <div
                onClick={() => setSelectedTemplateId(null)}
                className={cn(
                  "relative p-4 rounded-lg border-2 cursor-pointer transition-all",
                  !selectedTemplateId
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                {!selectedTemplateId && (
                  <CheckCircle className="absolute top-2 right-2 h-5 w-5 text-primary" />
                )}
                <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                <h3 className="font-medium">No Template</h3>
                <p className="text-sm text-muted-foreground">Start from scratch</p>
              </div>

              {/* Template options */}
              {templates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={cn(
                    "relative p-4 rounded-lg border-2 cursor-pointer transition-all",
                    selectedTemplateId === template.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {selectedTemplateId === template.id && (
                    <CheckCircle className="absolute top-2 right-2 h-5 w-5 text-primary" />
                  )}
                  <FileText className="h-8 w-8 text-primary mb-2" />
                  <h3 className="font-medium">{template.name}</h3>
                  {template.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {template.description}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {template.defaultDueDays} days
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {template.defaultUrgency}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === "configure" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Configure Requests
            </CardTitle>
            <CardDescription>
              Set defaults for all {allSelectedCreators.length} requests.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">Request Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={selectedTemplate?.name || "e.g., Weekly Content Request"}
                />
                {useTokens && (
                  <p className="text-xs text-muted-foreground">
                    Use {"{{creator.name}}"} or {"{{due_date}}"} for personalization
                  </p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add instructions or details..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="urgency">Priority</Label>
                <Select value={urgency} onValueChange={(v) => setUrgency(v as typeof urgency)}>
                  <SelectTrigger id="urgency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced options */}
            <div className="space-y-4 pt-4 border-t">
              <Label className="text-sm font-medium">Advanced Options</Label>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="sendNotifications"
                  checked={sendNotifications}
                  onCheckedChange={(checked) => setSendNotifications(checked === true)}
                />
                <div>
                  <Label htmlFor="sendNotifications" className="cursor-pointer">
                    Send notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Notify creators via email when requests are created
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="useTokens"
                  checked={useTokens}
                  onCheckedChange={(checked) => setUseTokens(checked === true)}
                />
                <div>
                  <Label htmlFor="useTokens" className="cursor-pointer">
                    Personalize with tokens
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Use {"{{creator.name}}"}, {"{{due_date}}"} in title/description
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="staggerDates"
                  checked={staggerDates}
                  onCheckedChange={(checked) => setStaggerDates(checked === true)}
                />
                <div className="flex-1">
                  <Label htmlFor="staggerDates" className="cursor-pointer">
                    Stagger due dates
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Space out due dates across creators
                  </p>
                  {staggerDates && (
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={staggerInterval}
                        onChange={(e) => setStaggerInterval(parseInt(e.target.value) || 1)}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">
                        days apart
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview & Send
            </CardTitle>
            <CardDescription>
              Review before sending {allSelectedCreators.length} request(s).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{allSelectedCreators.length}</p>
                <p className="text-sm text-muted-foreground">Creators</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">
                  {selectedTemplate?.name?.slice(0, 10) || "None"}
                </p>
                <p className="text-sm text-muted-foreground">Template</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{format(new Date(dueDate), "MMM d")}</p>
                <p className="text-sm text-muted-foreground">Due Date</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{urgency}</p>
                <p className="text-sm text-muted-foreground">Priority</p>
              </div>
            </div>

            {/* Settings summary */}
            <div className="flex flex-wrap gap-2">
              {sendNotifications && (
                <Badge variant="secondary">
                  <Send className="mr-1 h-3 w-3" />
                  Notifications enabled
                </Badge>
              )}
              {useTokens && (
                <Badge variant="secondary">
                  <Sparkles className="mr-1 h-3 w-3" />
                  Personalized
                </Badge>
              )}
              {staggerDates && (
                <Badge variant="secondary">
                  <Clock className="mr-1 h-3 w-3" />
                  Staggered by {staggerInterval} day(s)
                </Badge>
              )}
            </div>

            {/* Preview button */}
            <Button variant="outline" onClick={generatePreview}>
              <Eye className="mr-2 h-4 w-4" />
              Preview All Requests
            </Button>

            {/* Creator list */}
            <div className="border rounded-lg">
              <div className="p-3 bg-muted/50 border-b font-medium text-sm">
                Selected Creators ({allSelectedCreators.length})
              </div>
              <ScrollArea className="h-[200px]">
                <div className="p-2 space-y-1">
                  {allSelectedCreators.map((creator) => (
                    <div
                      key={creator.id}
                      className="flex items-center justify-between p-2 rounded hover:bg-muted"
                    >
                      <div>
                        <p className="font-medium">{creator.name}</p>
                        <p className="text-sm text-muted-foreground">{creator.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleCreator(creator.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Warning for large operations */}
            {allSelectedCreators.length > 50 && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    Large operation
                  </p>
                  <p className="text-amber-600 dark:text-amber-400">
                    You are about to create {allSelectedCreators.length} requests.
                    This may take a moment to process.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={currentStep === "creators" ? onCancel : goBack}>
          {currentStep === "creators" ? "Cancel" : "Back"}
        </Button>

        <div className="flex items-center gap-3">
          {currentStep !== "creators" && (
            <span className="text-sm text-muted-foreground">
              {allSelectedCreators.length} creator(s) selected
            </span>
          )}
          {currentStep === "preview" ? (
            <Button onClick={sendRequests} disabled={!canProceed}>
              <Send className="mr-2 h-4 w-4" />
              Create {allSelectedCreators.length} Request(s)
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!canProceed}>
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Request Preview</DialogTitle>
            <DialogDescription>
              Review the requests that will be created.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-3">
              {previewItems.map((item, index) => (
                <div
                  key={item.creatorId}
                  className="p-4 border rounded-lg space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        To: {item.creatorName} ({item.creatorEmail})
                      </p>
                    </div>
                    <Badge variant="outline">#{index + 1}</Badge>
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Badge variant="secondary">
                      <Calendar className="mr-1 h-3 w-3" />
                      Due: {format(new Date(item.dueDate), "MMM d, yyyy")}
                    </Badge>
                    <Badge variant="secondary">{item.urgency}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BulkRequestCreator;
