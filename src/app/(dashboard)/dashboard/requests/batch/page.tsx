"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  ArrowRight,
  Users,
  FileText,
  Settings,
  Eye,
  Send,
  CheckCircle,
  Loader2,
  Calendar,
  AlertTriangle,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { DueDateField } from "@/components/requests/deadline-picker";
import { cn } from "@/lib/utils";
import { BatchCreatorSelector, type Creator } from "@/components/requests/batch-creator-selector";
import { BatchPreview, type BatchRequestItem } from "@/components/requests/batch-preview";
import { addDays, format } from "date-fns";
import { useAccess } from "@/lib/access/client";
import { NoAccess } from "@/components/access/no-access";

// Step definition
interface Step {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
}

const STEPS: Step[] = [
  { id: 1, title: "Creators", description: "Choose who to send requests to", icon: Users },
  { id: 2, title: "Template", description: "Select a request template", icon: FileText },
  { id: 3, title: "Defaults", description: "Set defaults for all requests", icon: Settings },
  { id: 4, title: "Check each one", description: "Review and customize", icon: Eye },
  { id: 5, title: "Send", description: "Create and send requests", icon: Send },
];

interface Template {
  id: string;
  name: string;
  description?: string;
  defaultDueDays: number;
  defaultUrgency: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  fields: unknown[];
}

interface BatchConfig {
  title: string;
  description: string;
  dueDate: string;
  urgency: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  sendNotifications: boolean;
}

export default function BatchRequestPage() {
  const { can, roleName } = useAccess();
  if (!can("requests.create")) return <NoAccess what="creating requests" roleName={roleName} />;
  return <BatchRequestComposer />;
}

function BatchRequestComposer() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [creationProgress, setCreationProgress] = useState(0);
  const [creationResults, setCreationResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  // Data states
  const [creators, setCreators] = useState<Creator[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedCreators, setSelectedCreators] = useState<Creator[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [config, setConfig] = useState<BatchConfig>({
    title: "",
    description: "",
    dueDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    urgency: "NORMAL",
    sendNotifications: true,
  });
  const [batchItems, setBatchItems] = useState<BatchRequestItem[]>([]);

  // Fetch creators and templates
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [creatorsRes, templatesRes] = await Promise.all([
          fetch("/api/creators?limit=100&sortBy=name&sortOrder=asc"),
          fetch("/api/templates"),
        ]);

        if (creatorsRes.ok) {
          const creatorsData = await creatorsRes.json();
          // /api/creators returns a paginated { data, pagination } response
          setCreators(Array.isArray(creatorsData) ? creatorsData : creatorsData.data ?? []);
        }

        if (templatesRes.ok) {
          const templatesData = await templatesRes.json();
          setTemplates(templatesData.filter((t: Template) => t.id)); // Filter active templates
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
  const templateDetails = useMemo(() => {
    if (!selectedTemplate) return null;
    return templates.find((t) => t.id === selectedTemplate);
  }, [selectedTemplate, templates]);

  // Update config when template changes
  useEffect(() => {
    if (templateDetails) {
      setConfig((prev) => ({
        ...prev,
        dueDate: format(addDays(new Date(), templateDetails.defaultDueDays), "yyyy-MM-dd"),
        urgency: templateDetails.defaultUrgency,
      }));
    }
  }, [templateDetails]);

  // Generate batch items when entering preview step
  useEffect(() => {
    if (currentStep === 4 && selectedCreators.length > 0) {
      const items: BatchRequestItem[] = selectedCreators.map((creator, index) => {
        // Check for existing item to preserve customizations
        const existingItem = batchItems.find((i) => i.creator.id === creator.id);
        if (existingItem) return existingItem;

        const title = config.title || (templateDetails?.name ? `${templateDetails.name} Request` : "Content Request");
        const errors: string[] = [];
        if (!title.trim()) errors.push("Title is required");

        return {
          id: `batch-${creator.id}-${Date.now()}`,
          creator,
          title,
          description: config.description,
          dueDate: config.dueDate,
          urgency: config.urgency,
          customized: false,
          valid: errors.length === 0,
          validationErrors: errors,
        };
      });

      setBatchItems(items);
    }
  }, [currentStep, selectedCreators, config, templateDetails]);

  // Step validation
  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 1:
        return selectedCreators.length > 0;
      case 2:
        return true; // Template is optional
      case 3:
        return config.title.trim().length > 0;
      case 4:
        return batchItems.length > 0 && batchItems.every((i) => i.valid);
      default:
        return true;
    }
  }, [currentStep, selectedCreators, config, batchItems]);

  // Navigation handlers
  const goToNextStep = useCallback(() => {
    if (canProceed() && currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [canProceed, currentStep]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  // Batch item handlers
  const handleItemUpdate = useCallback((id: string, updates: Partial<BatchRequestItem>) => {
    setBatchItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  const handleItemRemove = useCallback((id: string) => {
    setBatchItems((prev) => prev.filter((item) => item.id !== id));
    // Also remove from selected creators
    const removedItem = batchItems.find((i) => i.id === id);
    if (removedItem) {
      setSelectedCreators((prev) =>
        prev.filter((c) => c.id !== removedItem.creator.id)
      );
    }
  }, [batchItems]);

  const handleReorder = useCallback((items: BatchRequestItem[]) => {
    setBatchItems(items);
  }, []);

  // Create batch requests
  const createBatchRequests = useCallback(async () => {
    setIsCreating(true);
    setCreationProgress(0);
    setCreationResults(null);

    try {
      const response = await fetch("/api/requests/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate,
          requests: batchItems.map((item) => ({
            creatorId: item.creator.id,
            title: item.title,
            description: item.description,
            dueDate: item.dueDate,
            urgency: item.urgency,
          })),
          sendNotifications: config.sendNotifications,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create requests");
      }

      // Simulate progress for UI feedback
      for (let i = 0; i <= 100; i += 10) {
        setCreationProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      setCreationResults({
        success: data.created || 0,
        failed: data.failed || 0,
        errors: data.errors || [],
      });

      if (data.created > 0) {
        toast.success(`Successfully created ${data.created} request(s)`);
      }
      if (data.failed > 0) {
        toast.error(`Failed to create ${data.failed} request(s)`);
      }

      // Move to completion step
      setCurrentStep(5);
    } catch (error) {
      console.error("Failed to create batch requests:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create requests");
      setCreationResults({
        success: 0,
        failed: batchItems.length,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
    } finally {
      setIsCreating(false);
    }
  }, [batchItems, selectedTemplate, config.sendNotifications]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-foreground mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card className="border-0 shadow-none">
            <CardHeader className="px-0">
              <CardTitle>Who gets one</CardTitle>
              <CardDescription>
                Choose the creators who will receive content requests. You can filter and search to find specific creators.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <BatchCreatorSelector
                creators={creators}
                selectedCreators={selectedCreators}
                onSelectionChange={setSelectedCreators}
              />
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card className="border-0 shadow-none">
            <CardHeader className="px-0">
              <CardTitle>Template (optional)</CardTitle>
              <CardDescription>
                Select a request template to use as a starting point, or skip to create requests without a template.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* No template option */}
                <div
                  onClick={() => setSelectedTemplate(null)}
                  className={`
                    relative p-4 rounded-lg border-2 cursor-pointer transition-all
                    ${!selectedTemplate
                      ? "border-ctl bg-tile-hi dark:bg-tile-hi"
                      : "border-border hover:border-ctl dark:hover:border-ctl"
                    }
                  `}
                >
                  {!selectedTemplate && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle className="h-5 w-5 text-foreground" />
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-lg bg-tile-hi flex items-center justify-center">
                      <FileText className="h-5 w-5 text-ink-2" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">No Template</h3>
                      <p className="text-xs text-muted-foreground">Start from scratch</p>
                    </div>
                  </div>
                </div>

                {/* Template options */}
                {templates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`
                      relative p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${selectedTemplate === template.id
                        ? "border-ctl bg-tile-hi dark:bg-tile-hi"
                        : "border-border hover:border-ctl dark:hover:border-ctl"
                      }
                    `}
                  >
                    {selectedTemplate === template.id && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle className="h-5 w-5 text-foreground" />
                      </div>
                    )}
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-lg bg-raised-hi flex items-center justify-center">
                        <FileText className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{template.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {template.fields?.length || 0} fields
                        </p>
                      </div>
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="mr-1 h-3 w-3" />
                        {template.defaultDueDays} days
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {template.defaultUrgency}
                      </Badge>
                    </div>
                  </div>
                ))}

                {templates.length === 0 && (
                  <div className="col-span-full text-center py-8">
                    <FileText className="h-10 w-10 text-muted-foreground/50 mx-auto" />
                    <p className="mt-2 text-muted-foreground">
                      No templates available.{" "}
                      <Link href="/dashboard/templates/new" className="text-foreground hover:underline">
                        Create one
                      </Link>
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card className="border-0 shadow-none">
            <CardHeader className="px-0">
              <CardTitle>Defaults for every request</CardTitle>
              <CardDescription>
                Set default values that will apply to all {selectedCreators.length} requests.
                You can customize individual requests in the next step.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <div className="space-y-6 max-w-xl">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={config.title}
                    onChange={(e) => setConfig({ ...config, title: e.target.value })}
                    placeholder={templateDetails?.name || "e.g., Weekly Content Request"}
                  />
                  <p className="text-xs text-muted-foreground">
                    This title will be used for all requests
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={config.description}
                    onChange={(e) => setConfig({ ...config, description: e.target.value })}
                    placeholder="Add any additional details or instructions..."
                    rows={3}
                  />
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <p id="dueDate-l" className="text-sm font-medium">Due</p>
                    <DueDateField
                      id="dueDate"
                      value={config.dueDate}
                      onChange={(v) => setConfig({ ...config, dueDate: v })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="urgency">Priority</Label>
                    <Select
                      value={config.urgency}
                      onValueChange={(v) => setConfig({ ...config, urgency: v as BatchConfig["urgency"] })}
                    >
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

                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <Checkbox aria-label="Send notifications"
                    id="sendNotifications"
                    checked={config.sendNotifications}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, sendNotifications: checked === true })
                    }
                  />
                  <div>
                    <Label htmlFor="sendNotifications" className="font-medium cursor-pointer">
                      Send notifications
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Notify creators via email when requests are created
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 4:
        return (
          <Card className="border-0 shadow-none">
            <CardHeader className="px-0">
              <CardTitle>Check each one</CardTitle>
              <CardDescription>
                Review the requests that will be created. Click on any row to customize individual requests.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <BatchPreview
                items={batchItems}
                templateName={templateDetails?.name}
                onItemUpdate={handleItemUpdate}
                onItemRemove={handleItemRemove}
                onReorder={handleReorder}
              />
            </CardContent>
          </Card>
        );

      case 5:
        return (
          <Card className="border-0 shadow-none">
            <CardContent className="px-0 py-12">
              {isCreating ? (
                <div className="text-center max-w-md mx-auto">
                  <Loader2 className="h-12 w-12 animate-spin text-foreground mx-auto" />
                  <h3 className="mt-4 text-lg font-semibold text-foreground">
                    Creating Requests...
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    Please wait while we create {batchItems.length} requests.
                  </p>
                  <div className="mt-6">
                    <Progress value={creationProgress}>
                      <ProgressLabel>Progress</ProgressLabel>
                      <ProgressValue>{() => `${creationProgress}%`}</ProgressValue>
                    </Progress>
                  </div>
                </div>
              ) : creationResults ? (
                <div className="text-center max-w-md mx-auto">
                  {creationResults.success > 0 && creationResults.failed === 0 ? (
                    <>
                      <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                        <CheckCircle className="h-8 w-8 text-success" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-foreground">
                        All Requests Created!
                      </h3>
                      <p className="mt-2 text-muted-foreground">
                        Successfully created {creationResults.success} content request
                        {creationResults.success !== 1 ? "s" : ""}.
                        {config.sendNotifications && " Notifications have been sent to creators."}
                      </p>
                    </>
                  ) : creationResults.failed > 0 && creationResults.success === 0 ? (
                    <>
                      <div className="h-16 w-16 rounded-full bg-late/10 flex items-center justify-center mx-auto">
                        <X className="h-8 w-8 text-late" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-foreground">
                        Failed to Create Requests
                      </h3>
                      <p className="mt-2 text-muted-foreground">
                        None of the requests could be created. Please try again.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="h-16 w-16 rounded-full bg-tile-hi flex items-center justify-center mx-auto">
                        <AlertTriangle className="h-8 w-8 text-ink-2" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-foreground">
                        Partially Completed
                      </h3>
                      <p className="mt-2 text-muted-foreground">
                        Created {creationResults.success} request{creationResults.success !== 1 ? "s" : ""},
                        but {creationResults.failed} failed.
                      </p>
                    </>
                  )}

                  {creationResults.errors.length > 0 && (
                    <div className="mt-4 p-4 bg-late/10 rounded-lg text-left">
                      <h4 className="text-sm font-medium text-late">Errors:</h4>
                      <ul className="mt-2 text-sm text-late space-y-1">
                        {creationResults.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-6 flex justify-center gap-3">
                    <Button variant="outline" asChild>
                      <Link href="/dashboard/requests">
                        View All Requests
                      </Link>
                    </Button>
                    <Button asChild className="bg-raised-hi text-ink hover:bg-raised-hi">
                      <Link href="/dashboard/requests/batch">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Create More
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center max-w-md mx-auto">
                  <div className="h-16 w-16 rounded-full bg-tile-hi dark:bg-tile-hi flex items-center justify-center mx-auto">
                    <Send className="h-8 w-8 text-foreground" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">
                    Ready to Create Requests
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    You are about to create {batchItems.length} content request
                    {batchItems.length !== 1 ? "s" : ""}.
                    {config.sendNotifications && " Creators will be notified via email."}
                  </p>
                  <Button
                    onClick={createBatchRequests}
                    className="mt-6 bg-raised-hi text-ink hover:bg-raised-hi"
                    size="lg"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Create {batchItems.length} Request{batchItems.length !== 1 ? "s" : ""}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <header className="min-w-0">
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.01em] sm:text-[26px]">Batch requests</h1>
        <p className="mt-1 max-w-[70ch] text-[15px]">
          One template to many creators, each with their own title, note and due date.{" "}
          <Link href="/dashboard/requests/new" className="text-ink-2 underline">
            Same request for everyone? Use New request.
          </Link>
        </p>
      </header>

      <ol aria-label="Steps" className="flex list-none gap-1 overflow-x-auto rounded-[var(--tw-r-ctl)] bg-well p-1 [scrollbar-width:none]">
        {STEPS.map((step) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          return (
            <li
              key={step.id}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "flex min-w-0 flex-1 shrink-0 items-center gap-2 rounded-[6px] px-3 py-2 text-sm",
                isActive ? "bg-tile-hi font-semibold text-ink" : isCompleted ? "text-ink" : "text-ink-2"
              )}
            >
              {isCompleted ? (
                <CheckCircle className="size-4 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <span className="tabular-nums" aria-hidden="true">{step.id}</span>
              )}
              <span className="whitespace-nowrap">{step.title}</span>
              {isCompleted && <span className="sr-only">(done)</span>}
            </li>
          );
        })}
      </ol>

      {/* Step Content */}
      <Card>
        <CardContent className="p-4 md:p-6">
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation */}
      {currentStep < 5 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={goToPreviousStep}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {currentStep === 4 && (
              <span className="text-sm text-muted-foreground mr-2">
                {batchItems.filter((i) => i.valid).length} of {batchItems.length} valid
              </span>
            )}
            <Button
              onClick={currentStep === 4 ? createBatchRequests : goToNextStep}
              disabled={!canProceed() || isCreating}
              className="bg-raised-hi text-ink hover:bg-raised-hi"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : currentStep === 4 ? (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Create Requests
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
