"use client";

import * as React from "react";
import { format, addDays } from "date-fns";
import {
  CalendarDays,
  Clock,
  ChevronRight,
  ChevronLeft,
  FilePlus,
  Bell,
  Archive,
  Package,
  Check,
  User,
  Users,
  FileText,
  AlertCircle,
  Repeat,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import {
  ScheduledTask,
  ScheduledTaskType,
  RecurrencePattern,
  TASK_TYPE_LABELS,
  TASK_TYPE_DESCRIPTIONS,
  RECURRENCE_LABELS,
  getUpcomingOccurrences,
  CreateScheduledTaskRequest,
} from "@/types/scheduled-tasks";

// ============================================
// TYPES
// ============================================

interface Template {
  id: string;
  name: string;
  description?: string;
}

interface Creator {
  id: string;
  name: string;
  email: string;
}

interface ScheduleRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Template[];
  creators: Creator[];
  editingTask?: ScheduledTask | null;
  initialDate?: Date | null;
  onTaskCreated: (task: ScheduledTask) => void;
}

type Step = "type" | "target" | "schedule" | "config" | "review";

// ============================================
// TASK TYPE SELECTION
// ============================================

interface TaskTypeOption {
  type: ScheduledTaskType;
  icon: React.ReactNode;
  color: string;
}

const taskTypes: TaskTypeOption[] = [
  {
    type: "create_request",
    icon: <FilePlus className="h-6 w-6" />,
    color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  },
  {
    type: "send_reminder",
    icon: <Bell className="h-6 w-6" />,
    color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  },
  {
    type: "archive_request",
    icon: <Archive className="h-6 w-6" />,
    color: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
  },
  {
    type: "create_bundle",
    icon: <Package className="h-6 w-6" />,
    color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function ScheduleRequestModal({
  open,
  onOpenChange,
  templates,
  creators,
  editingTask,
  initialDate,
  onTaskCreated,
}: ScheduleRequestModalProps) {
  const [step, setStep] = React.useState<Step>("type");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form state
  const [taskType, setTaskType] = React.useState<ScheduledTaskType>("create_request");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [scheduledDate, setScheduledDate] = React.useState<Date | undefined>(
    initialDate || addDays(new Date(), 1)
  );
  const [scheduledTime, setScheduledTime] = React.useState("09:00");
  const [recurrence, setRecurrence] = React.useState<RecurrencePattern>("once");
  const [recurrenceEndDate, setRecurrenceEndDate] = React.useState<Date | undefined>();
  const [selectedCreatorIds, setSelectedCreatorIds] = React.useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>("");

  // Request config
  const [requestTitle, setRequestTitle] = React.useState("");
  const [requestDescription, setRequestDescription] = React.useState("");
  const [dueInDays, setDueInDays] = React.useState(7);
  const [urgency, setUrgency] = React.useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [autoSend, setAutoSend] = React.useState(true);

  // Search state
  const [creatorSearch, setCreatorSearch] = React.useState("");

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (open) {
      if (editingTask) {
        // Populate form with existing task data
        setTaskType(editingTask.type);
        setName(editingTask.name);
        setDescription(editingTask.description || "");
        setScheduledDate(new Date(editingTask.scheduledFor));
        setScheduledTime(format(new Date(editingTask.scheduledFor), "HH:mm"));
        setRecurrence(editingTask.recurrence);
        setRecurrenceEndDate(
          editingTask.recurrenceEndDate
            ? new Date(editingTask.recurrenceEndDate)
            : undefined
        );
        setSelectedCreatorIds(editingTask.creatorIds || (editingTask.creatorId ? [editingTask.creatorId] : []));
        setSelectedTemplateId(editingTask.config.requestConfig?.templateId || "");
        setRequestTitle(editingTask.config.requestConfig?.title || "");
        setRequestDescription(editingTask.config.requestConfig?.description || "");
        setDueInDays(editingTask.config.requestConfig?.dueInDays || 7);
        setUrgency(editingTask.config.requestConfig?.urgency || "NORMAL");
        setAutoSend(editingTask.config.requestConfig?.autoSend ?? true);
        setStep("type");
      } else {
        // Reset to defaults
        setTaskType("create_request");
        setName("");
        setDescription("");
        setScheduledDate(initialDate || addDays(new Date(), 1));
        setScheduledTime("09:00");
        setRecurrence("once");
        setRecurrenceEndDate(undefined);
        setSelectedCreatorIds([]);
        setSelectedTemplateId("");
        setRequestTitle("");
        setRequestDescription("");
        setDueInDays(7);
        setUrgency("NORMAL");
        setAutoSend(true);
        setStep("type");
      }
    }
  }, [open, editingTask, initialDate]);

  // Filter creators by search
  const filteredCreators = React.useMemo(() => {
    if (!creatorSearch) return creators;
    const search = creatorSearch.toLowerCase();
    return creators.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.email.toLowerCase().includes(search)
    );
  }, [creators, creatorSearch]);

  // Selected template
  const selectedTemplate = React.useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId);
  }, [templates, selectedTemplateId]);

  // Calculate scheduled datetime
  const scheduledDateTime = React.useMemo(() => {
    if (!scheduledDate) return null;
    const [hours, minutes] = scheduledTime.split(":").map(Number);
    const date = new Date(scheduledDate);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }, [scheduledDate, scheduledTime]);

  // Upcoming occurrences preview
  const upcomingOccurrences = React.useMemo(() => {
    if (!scheduledDateTime) return [];
    return getUpcomingOccurrences(
      scheduledDateTime,
      recurrence,
      recurrenceEndDate,
      5
    );
  }, [scheduledDateTime, recurrence, recurrenceEndDate]);

  // Navigation
  const steps: Step[] = ["type", "target", "schedule", "config", "review"];
  const currentStepIndex = steps.indexOf(step);

  const canProceed = (): boolean => {
    switch (step) {
      case "type":
        return !!taskType;
      case "target":
        if (taskType === "create_request" || taskType === "send_reminder") {
          return selectedCreatorIds.length > 0;
        }
        return true;
      case "schedule":
        return !!scheduledDateTime;
      case "config":
        if (taskType === "create_request") {
          return !!selectedTemplateId && !!name;
        }
        return !!name;
      case "review":
        return true;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setStep(steps[currentStepIndex + 1]);
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setStep(steps[currentStepIndex - 1]);
    }
  };

  // Submit
  const handleSubmit = async () => {
    if (!scheduledDateTime) return;

    setIsSubmitting(true);

    try {
      const payload: CreateScheduledTaskRequest = {
        type: taskType,
        name,
        description: description || undefined,
        scheduledFor: scheduledDateTime.toISOString(),
        recurrence,
        recurrenceEndDate: recurrenceEndDate?.toISOString(),
        creatorIds: selectedCreatorIds.length > 0 ? selectedCreatorIds : undefined,
        templateId: selectedTemplateId || undefined,
        config: {
          requestConfig:
            taskType === "create_request"
              ? {
                  templateId: selectedTemplateId,
                  title: requestTitle || undefined,
                  description: requestDescription || undefined,
                  dueInDays,
                  urgency,
                  autoSend,
                }
              : undefined,
          reminderConfig:
            taskType === "send_reminder"
              ? {
                  requestId: "", // Would need to select a request
                  message: description || undefined,
                }
              : undefined,
        },
      };

      const url = editingTask
        ? `/api/scheduled-tasks/${editingTask.id}`
        : "/api/scheduled-tasks";
      const method = editingTask ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save task");
      }

      const savedTask = await response.json();
      onTaskCreated(savedTask);
    } catch (error) {
      console.error("Error saving task:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save task");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle creator selection
  const toggleCreator = (creatorId: string) => {
    setSelectedCreatorIds((prev) =>
      prev.includes(creatorId)
        ? prev.filter((id) => id !== creatorId)
        : [...prev, creatorId]
    );
  };

  const selectAllCreators = () => {
    setSelectedCreatorIds(filteredCreators.map((c) => c.id));
  };

  const deselectAllCreators = () => {
    setSelectedCreatorIds([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingTask ? "Edit Scheduled Task" : "Schedule New Task"}
          </DialogTitle>
          <DialogDescription>
            {step === "type" && "Select the type of task you want to schedule"}
            {step === "target" && "Choose who this task applies to"}
            {step === "schedule" && "Set when this task should run"}
            {step === "config" && "Configure task details"}
            {step === "review" && "Review and confirm your scheduled task"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <button
                onClick={() => i < currentStepIndex && setStep(s)}
                disabled={i > currentStepIndex}
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium transition-colors",
                  i <= currentStepIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                  i < currentStepIndex && "cursor-pointer hover:bg-primary/90"
                )}
              >
                {i < currentStepIndex ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </button>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2",
                    i < currentStepIndex ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="space-y-6">
          {/* Step 1: Task Type */}
          {step === "type" && (
            <div className="grid grid-cols-2 gap-4">
              {taskTypes.map((option) => (
                <button
                  key={option.type}
                  onClick={() => setTaskType(option.type)}
                  className={cn(
                    "p-4 rounded-lg border-2 text-left transition-all",
                    taskType === option.type
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/50"
                  )}
                >
                  <div className={cn("h-12 w-12 rounded-lg flex items-center justify-center mb-3", option.color)}>
                    {option.icon}
                  </div>
                  <h3 className="font-medium mb-1">{TASK_TYPE_LABELS[option.type]}</h3>
                  <p className="text-sm text-muted-foreground">
                    {TASK_TYPE_DESCRIPTIONS[option.type]}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Target Selection */}
          {step === "target" && (
            <div className="space-y-4">
              {(taskType === "create_request" || taskType === "send_reminder") && (
                <>
                  <div className="flex items-center justify-between">
                    <Label>Select Creators</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={selectAllCreators}
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={deselectAllCreators}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  <Input
                    placeholder="Search creators..."
                    value={creatorSearch}
                    onChange={(e) => setCreatorSearch(e.target.value)}
                  />
                  <div className="border rounded-lg max-h-64 overflow-y-auto">
                    {filteredCreators.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        No creators found
                      </div>
                    ) : (
                      filteredCreators.map((creator) => (
                        <label
                          key={creator.id}
                          className={cn(
                            "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 border-b last:border-b-0",
                            selectedCreatorIds.includes(creator.id) && "bg-primary/5"
                          )}
                        >
                          <Checkbox
                            checked={selectedCreatorIds.includes(creator.id)}
                            onCheckedChange={() => toggleCreator(creator.id)}
                          />
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{creator.name}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {creator.email}
                            </p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{selectedCreatorIds.length} creators selected</span>
                  </div>
                </>
              )}

              {taskType === "archive_request" && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Archive Configuration</p>
                      <p className="text-sm text-muted-foreground">
                        Archive tasks will automatically archive completed requests
                        older than a specified number of days.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {taskType === "create_bundle" && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Bundle Creation</p>
                      <p className="text-sm text-muted-foreground">
                        Bundle tasks will create multiple related requests at once.
                        Configure templates and creators in the next steps.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Schedule */}
          {step === "schedule" && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !scheduledDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {scheduledDate
                          ? format(scheduledDate, "PPP")
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        disabled={(date) => date < new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Recurrence</Label>
                <Select
                  value={recurrence}
                  onValueChange={(v) => setRecurrence(v as RecurrencePattern)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {recurrence !== "once" && (
                <div className="space-y-2">
                  <Label>End Date (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !recurrenceEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {recurrenceEndDate
                          ? format(recurrenceEndDate, "PPP")
                          : "No end date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        selected={recurrenceEndDate}
                        onSelect={setRecurrenceEndDate}
                        disabled={(date) =>
                          date < (scheduledDate || new Date())
                        }
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Preview upcoming occurrences */}
              {upcomingOccurrences.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Repeat className="h-4 w-4" />
                    Upcoming Runs
                  </Label>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    {upcomingOccurrences.map((date, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm"
                      >
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <span>{format(date, "EEEE, MMMM d, yyyy 'at' h:mm a")}</span>
                      </div>
                    ))}
                    {recurrence !== "once" && !recurrenceEndDate && (
                      <p className="text-xs text-muted-foreground italic">
                        And continues {RECURRENCE_LABELS[recurrence].toLowerCase()}...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Configuration */}
          {step === "config" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Task Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Weekly content request for creators"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description for this task..."
                  rows={3}
                />
              </div>

              {taskType === "create_request" && (
                <>
                  <div className="space-y-2">
                    <Label>Template *</Label>
                    <Select
                      value={selectedTemplateId}
                      onValueChange={setSelectedTemplateId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span>{template.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTemplate?.description && (
                      <p className="text-sm text-muted-foreground">
                        {selectedTemplate.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Custom Request Title (Optional)</Label>
                    <Input
                      value={requestTitle}
                      onChange={(e) => setRequestTitle(e.target.value)}
                      placeholder="Leave empty to use template default"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Due In (Days)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={dueInDays}
                        onChange={(e) => setDueInDays(parseInt(e.target.value) || 7)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Urgency</Label>
                      <Select
                        value={urgency}
                        onValueChange={(v) => setUrgency(v as typeof urgency)}
                      >
                        <SelectTrigger>
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

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label>Auto-send notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically notify creators when requests are created
                      </p>
                    </div>
                    <Switch
                      checked={autoSend}
                      onCheckedChange={setAutoSend}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 5: Review */}
          {step === "review" && (
            <div className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "h-12 w-12 rounded-lg flex items-center justify-center shrink-0",
                      taskType === "create_request" && "bg-blue-100 text-blue-600",
                      taskType === "send_reminder" && "bg-amber-100 text-amber-600",
                      taskType === "archive_request" && "bg-gray-100 text-gray-600",
                      taskType === "create_bundle" && "bg-purple-100 text-purple-600"
                    )}
                  >
                    {taskTypes.find((t) => t.type === taskType)?.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {TASK_TYPE_LABELS[taskType]}
                    </p>
                  </div>
                </div>

                {description && (
                  <p className="text-sm">{description}</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Scheduled For</p>
                  <p className="font-medium">
                    {scheduledDateTime
                      ? format(scheduledDateTime, "EEEE, MMMM d, yyyy")
                      : "-"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {scheduledDateTime
                      ? format(scheduledDateTime, "h:mm a")
                      : ""}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Recurrence</p>
                  <p className="font-medium">{RECURRENCE_LABELS[recurrence]}</p>
                  {recurrenceEndDate && (
                    <p className="text-sm text-muted-foreground">
                      Until {format(recurrenceEndDate, "MMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>

              {selectedCreatorIds.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Creators ({selectedCreatorIds.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedCreatorIds.slice(0, 5).map((id) => {
                      const creator = creators.find((c) => c.id === id);
                      return creator ? (
                        <Badge key={id} variant="secondary">
                          {creator.name}
                        </Badge>
                      ) : null;
                    })}
                    {selectedCreatorIds.length > 5 && (
                      <Badge variant="outline">
                        +{selectedCreatorIds.length - 5} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {selectedTemplate && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Template</p>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">{selectedTemplate.name}</span>
                  </div>
                </div>
              )}

              {taskType === "create_request" && (
                <div className="grid gap-4 md:grid-cols-3 pt-2 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Due In</p>
                    <p className="font-medium">{dueInDays} days</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Urgency</p>
                    <Badge variant="outline">{urgency}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Auto-send</p>
                    <p className="font-medium">{autoSend ? "Yes" : "No"}</p>
                  </div>
                </div>
              )}

              {/* Warning for bulk operations */}
              {selectedCreatorIds.length > 10 && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-800 dark:text-amber-200">
                  <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">Bulk Operation</p>
                    <p>
                      This will create requests for {selectedCreatorIds.length}{" "}
                      creators. Make sure this is intentional.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {currentStepIndex > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={isSubmitting}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          <div className="flex-1" />
          {currentStepIndex < steps.length - 1 ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={!canProceed()}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !canProceed()}
            >
              {isSubmitting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {editingTask ? "Update Task" : "Schedule Task"}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ScheduleRequestModal;
