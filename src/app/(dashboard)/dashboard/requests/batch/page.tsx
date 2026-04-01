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
import { BatchCreatorSelector, type Creator } from "@/components/requests/batch-creator-selector";
import { BatchPreview, type BatchRequestItem } from "@/components/requests/batch-preview";
import { addDays, format } from "date-fns";

// Step definition
interface Step {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
}

const STEPS: Step[] = [
  { id: 1, title: "Select Creators", description: "Choose who to send requests to", icon: Users },
  { id: 2, title: "Choose Template", description: "Select a request template", icon: FileText },
  { id: 3, title: "Configure", description: "Set defaults for all requests", icon: Settings },
  { id: 4, title: "Preview", description: "Review and customize", icon: Eye },
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
          fetch("/api/creators"),
          fetch("/api/templates"),
        ]);

        if (creatorsRes.ok) {
          const creatorsData = await creatorsRes.json();
          setCreators(creatorsData);
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
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
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
              <CardTitle>Select Creators</CardTitle>
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
              <CardTitle>Choose Template (Optional)</CardTitle>
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
                      ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20"
                      : "border-border hover:border-indigo-300 dark:hover:border-indigo-700"
                    }
                  `}
                >
                  {!selectedTemplate && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle className="h-5 w-5 text-indigo-600" />
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-gray-500" />
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
                        ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20"
                        : "border-border hover:border-indigo-300 dark:hover:border-indigo-700"
                      }
                    `}
                  >
                    {selectedTemplate === template.id && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle className="h-5 w-5 text-indigo-600" />
                      </div>
                    )}
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
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
                      <Link href="/dashboard/templates/new" className="text-indigo-600 hover:underline">
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
              <CardTitle>Configure Defaults</CardTitle>
              <CardDescription>
                Set default values that will apply to all {selectedCreators.length} requests.
                You can customize individual requests in the next step.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <div className="space-y-6 max-w-xl">
                <div className="space-y-2">
                  <Label htmlFor="title">Request Title *</Label>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={config.dueDate}
                      onChange={(e) => setConfig({ ...config, dueDate: e.target.value })}
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
                  <Checkbox
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
              <CardTitle>Review & Customize</CardTitle>
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
                  <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto" />
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
                      <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                        <CheckCircle className="h-8 w-8 text-green-600" />
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
                      <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                        <X className="h-8 w-8 text-red-600" />
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
                      <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
                        <AlertTriangle className="h-8 w-8 text-amber-600" />
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
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg text-left">
                      <h4 className="text-sm font-medium text-red-800 dark:text-red-300">Errors:</h4>
                      <ul className="mt-2 text-sm text-red-600 dark:text-red-400 space-y-1">
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
                    <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
                      <Link href="/dashboard/requests/batch">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Create More
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center max-w-md mx-auto">
                  <div className="h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto">
                    <Send className="h-8 w-8 text-indigo-600" />
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
                    className="mt-6 bg-indigo-600 hover:bg-indigo-700"
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/requests">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Batch Request Creation
          </h1>
          <p className="mt-1 text-muted-foreground">
            Create multiple content requests at once
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <Card className="border-indigo-100 dark:border-indigo-900/50">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;
              const isLast = index === STEPS.length - 1;

              return (
                <div key={step.id} className="flex items-center flex-1 last:flex-initial">
                  <div className="flex flex-col items-center">
                    <div
                      className={`
                        flex items-center justify-center h-10 w-10 rounded-full transition-all
                        ${isActive
                          ? "bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-900/50"
                          : isCompleted
                          ? "bg-indigo-600 text-white"
                          : "bg-muted text-muted-foreground"
                        }
                      `}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="mt-2 text-center hidden sm:block">
                      <p
                        className={`text-sm font-medium ${
                          isActive ? "text-indigo-600" : isCompleted ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {step.title}
                      </p>
                      <p className="text-xs text-muted-foreground hidden lg:block">
                        {step.description}
                      </p>
                    </div>
                  </div>
                  {!isLast && (
                    <div
                      className={`
                        flex-1 h-0.5 mx-2 md:mx-4 transition-colors
                        ${isCompleted ? "bg-indigo-600" : "bg-muted"}
                      `}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
              className="bg-indigo-600 hover:bg-indigo-700"
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
