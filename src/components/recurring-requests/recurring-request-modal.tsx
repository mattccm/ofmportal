"use client";

import * as React from "react";
import { format, addDays } from "date-fns";
import {
  CalendarDays,
  Clock,
  ChevronRight,
  ChevronLeft,
  Check,
  Users,
  User,
  FileText,
  Repeat,
  Info,
  AlertCircle,
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
  RecurringRequest,
  RecurrenceFrequency,
  FREQUENCY_LABELS,
  FREQUENCY_DESCRIPTIONS,
  DAY_OF_WEEK_LABELS,
  getUpcomingScheduleDates,
  RequestSettings,
} from "@/types/recurring-requests";

// ============================================
// TYPES
// ============================================

interface Template {
  id: string;
  name: string;
  description?: string | null;
}

interface Creator {
  id: string;
  name: string;
  email: string;
}

interface CreatorGroup {
  id: string;
  name: string;
  memberCount: number;
}

interface RecurringRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Template[];
  creators: Creator[];
  creatorGroups: CreatorGroup[];
  editingRequest?: RecurringRequest | null;
  onSaved: (request: RecurringRequest) => void;
}

type Step = "schedule" | "target" | "template" | "settings" | "review";

// ============================================
// STEP CONFIG
// ============================================

const STEPS: { id: Step; label: string; description: string }[] = [
  { id: "schedule", label: "Schedule", description: "Set frequency and timing" },
  { id: "target", label: "Creators", description: "Select target creators" },
  { id: "template", label: "Template", description: "Choose request template" },
  { id: "settings", label: "Settings", description: "Configure request details" },
  { id: "review", label: "Review", description: "Review and confirm" },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function RecurringRequestModal({
  open,
  onOpenChange,
  templates,
  creators,
  creatorGroups,
  editingRequest,
  onSaved,
}: RecurringRequestModalProps) {
  const [step, setStep] = React.useState<Step>("schedule");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form state
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [frequency, setFrequency] = React.useState<RecurrenceFrequency>("WEEKLY");
  const [dayOfWeek, setDayOfWeek] = React.useState<number>(1); // Monday
  const [dayOfMonth, setDayOfMonth] = React.useState<number>(1);
  const [timeOfDay, setTimeOfDay] = React.useState("09:00");
  const [timezone] = React.useState("America/New_York");
  const [startDate, setStartDate] = React.useState<Date | undefined>(addDays(new Date(), 1));
  const [endDate, setEndDate] = React.useState<Date | undefined>();
  const [maxOccurrences, setMaxOccurrences] = React.useState<number | undefined>();

  // Target selection
  const [selectionMode, setSelectionMode] = React.useState<"individual" | "group">("individual");
  const [selectedCreatorIds, setSelectedCreatorIds] = React.useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>([]);
  const [creatorSearch, setCreatorSearch] = React.useState("");

  // Template
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("");

  // Request settings
  const [titleTemplate, setTitleTemplate] = React.useState("{month} Content Request");
  const [requestDescription, setRequestDescription] = React.useState("");
  const [dueInDays, setDueInDays] = React.useState(7);
  const [urgency, setUrgency] = React.useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [autoSendNotification, setAutoSendNotification] = React.useState(true);

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (open) {
      if (editingRequest) {
        setName(editingRequest.name);
        setDescription(editingRequest.description || "");
        setFrequency(editingRequest.frequency);
        setDayOfWeek(editingRequest.dayOfWeek ?? 1);
        setDayOfMonth(editingRequest.dayOfMonth ?? 1);
        setTimeOfDay(editingRequest.timeOfDay);
        setStartDate(new Date(editingRequest.startDate));
        setEndDate(editingRequest.endDate ? new Date(editingRequest.endDate) : undefined);
        setMaxOccurrences(editingRequest.maxOccurrences);
        setSelectedCreatorIds(editingRequest.creatorIds || []);
        setSelectedGroupIds(editingRequest.creatorGroupIds || []);
        setSelectionMode(
          (editingRequest.creatorGroupIds || []).length > 0 ? "group" : "individual"
        );
        setSelectedTemplateId(editingRequest.templateId);
        const settings = editingRequest.requestSettings;
        setTitleTemplate(settings.titleTemplate);
        setRequestDescription(settings.description || "");
        setDueInDays(settings.dueInDays);
        setUrgency(settings.urgency);
        setAutoSendNotification(settings.autoSendNotification);
        setStep("schedule");
      } else {
        // Reset to defaults
        setName("");
        setDescription("");
        setFrequency("WEEKLY");
        setDayOfWeek(1);
        setDayOfMonth(1);
        setTimeOfDay("09:00");
        setStartDate(addDays(new Date(), 1));
        setEndDate(undefined);
        setMaxOccurrences(undefined);
        setSelectedCreatorIds([]);
        setSelectedGroupIds([]);
        setSelectionMode("individual");
        setSelectedTemplateId("");
        setTitleTemplate("{month} Content Request");
        setRequestDescription("");
        setDueInDays(7);
        setUrgency("NORMAL");
        setAutoSendNotification(true);
        setStep("schedule");
      }
    }
  }, [open, editingRequest]);

  // Filter creators
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
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Calculate upcoming dates preview
  const upcomingDates = React.useMemo(() => {
    if (!startDate) return [];
    return getUpcomingScheduleDates(
      frequency,
      startDate,
      timeOfDay,
      frequency === "WEEKLY" || frequency === "BIWEEKLY" ? dayOfWeek : undefined,
      frequency === "MONTHLY" || frequency === "QUARTERLY" ? dayOfMonth : undefined,
      endDate,
      maxOccurrences,
      5
    );
  }, [frequency, startDate, timeOfDay, dayOfWeek, dayOfMonth, endDate, maxOccurrences]);

  // Total creator count
  const totalCreatorCount = React.useMemo(() => {
    if (selectionMode === "individual") {
      return selectedCreatorIds.length;
    }
    return selectedGroupIds.reduce((sum, gid) => {
      const group = creatorGroups.find((g) => g.id === gid);
      return sum + (group?.memberCount || 0);
    }, 0);
  }, [selectionMode, selectedCreatorIds, selectedGroupIds, creatorGroups]);

  // Navigation
  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  const canProceed = (): boolean => {
    switch (step) {
      case "schedule":
        return !!startDate && !!frequency;
      case "target":
        return totalCreatorCount > 0;
      case "template":
        return !!selectedTemplateId;
      case "settings":
        return !!name && !!titleTemplate && dueInDays > 0;
      case "review":
        return true;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setStep(STEPS[currentStepIndex + 1].id);
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setStep(STEPS[currentStepIndex - 1].id);
    }
  };

  // Toggle selection
  const toggleCreator = (creatorId: string) => {
    setSelectedCreatorIds((prev) =>
      prev.includes(creatorId)
        ? prev.filter((id) => id !== creatorId)
        : [...prev, creatorId]
    );
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  // Submit
  const handleSubmit = async () => {
    if (!startDate) return;

    setIsSubmitting(true);

    try {
      const requestSettings: RequestSettings = {
        titleTemplate,
        description: requestDescription || undefined,
        dueInDays,
        urgency,
        autoSendNotification,
      };

      const payload = {
        name,
        description: description || undefined,
        templateId: selectedTemplateId,
        creatorIds: selectionMode === "individual" ? selectedCreatorIds : [],
        creatorGroupIds: selectionMode === "group" ? selectedGroupIds : [],
        frequency,
        dayOfWeek: frequency === "WEEKLY" || frequency === "BIWEEKLY" ? dayOfWeek : undefined,
        dayOfMonth: frequency === "MONTHLY" || frequency === "QUARTERLY" ? dayOfMonth : undefined,
        timeOfDay,
        timezone,
        startDate: startDate.toISOString(),
        endDate: endDate?.toISOString(),
        maxOccurrences,
        requestSettings,
      };

      const url = editingRequest
        ? `/api/recurring-requests/${editingRequest.id}`
        : "/api/recurring-requests";
      const method = editingRequest ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save recurring request");
      }

      const saved = await response.json();
      onSaved(saved);
      onOpenChange(false);
      toast.success(
        editingRequest
          ? "Recurring request updated"
          : "Recurring request created"
      );
    } catch (error) {
      console.error("Error saving recurring request:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save recurring request"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-primary" />
            {editingRequest ? "Edit Recurring Request" : "Create Recurring Request"}
          </DialogTitle>
          <DialogDescription>
            {STEPS.find((s) => s.id === step)?.description}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <button
                onClick={() => i < currentStepIndex && setStep(s.id)}
                disabled={i > currentStepIndex}
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium transition-colors",
                  i <= currentStepIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                  i < currentStepIndex && "cursor-pointer hover:bg-primary/90"
                )}
              >
                {i < currentStepIndex ? <Check className="h-4 w-4" /> : i + 1}
              </button>
              {i < STEPS.length - 1 && (
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
        <div className="space-y-6 min-h-[350px]">
          {/* Step 1: Schedule */}
          {step === "schedule" && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={frequency}
                    onValueChange={(v) => setFrequency(v as RecurrenceFrequency)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          <div className="flex flex-col">
                            <span>{label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {FREQUENCY_DESCRIPTIONS[frequency]}
                  </p>
                </div>

                {(frequency === "WEEKLY" || frequency === "BIWEEKLY") && (
                  <div className="space-y-2">
                    <Label>Day of Week</Label>
                    <Select
                      value={String(dayOfWeek)}
                      onValueChange={(v) => setDayOfWeek(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(DAY_OF_WEEK_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(frequency === "MONTHLY" || frequency === "QUARTERLY") && (
                  <div className="space-y-2">
                    <Label>Day of Month</Label>
                    <Select
                      value={String(dayOfMonth)}
                      onValueChange={(v) => setDayOfMonth(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                          <SelectItem key={day} value={String(day)}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        selected={startDate}
                        onSelect={setStartDate}
                        disabled={(date) => date < new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Time of Day</Label>
                  <Input
                    type="time"
                    value={timeOfDay}
                    onChange={(e) => setTimeOfDay(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>End Date (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : "No end date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => date < (startDate || new Date())}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Max Occurrences (Optional)</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Unlimited"
                    value={maxOccurrences || ""}
                    onChange={(e) =>
                      setMaxOccurrences(e.target.value ? parseInt(e.target.value) : undefined)
                    }
                  />
                </div>
              </div>

              {/* Preview upcoming dates */}
              {upcomingDates.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Repeat className="h-4 w-4" />
                    Upcoming Runs
                  </Label>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    {upcomingDates.map((date, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <span>{format(date, "EEEE, MMMM d, yyyy 'at' h:mm a")}</span>
                      </div>
                    ))}
                    {!endDate && !maxOccurrences && (
                      <p className="text-xs text-muted-foreground italic">
                        And continues {FREQUENCY_LABELS[frequency].toLowerCase()}...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Target Selection */}
          {step === "target" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={selectionMode === "individual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectionMode("individual")}
                >
                  <User className="mr-2 h-4 w-4" />
                  Individual Creators
                </Button>
                <Button
                  type="button"
                  variant={selectionMode === "group" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectionMode("group")}
                  disabled={creatorGroups.length === 0}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Creator Groups
                </Button>
              </div>

              {selectionMode === "individual" ? (
                <>
                  <div className="flex items-center justify-between">
                    <Label>Select Creators</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCreatorIds(creators.map((c) => c.id))}
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCreatorIds([])}
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
              ) : (
                <>
                  <Label>Select Creator Groups</Label>
                  <div className="border rounded-lg max-h-64 overflow-y-auto">
                    {creatorGroups.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        No groups available
                      </div>
                    ) : (
                      creatorGroups.map((group) => (
                        <label
                          key={group.id}
                          className={cn(
                            "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 border-b last:border-b-0",
                            selectedGroupIds.includes(group.id) && "bg-primary/5"
                          )}
                        >
                          <Checkbox
                            checked={selectedGroupIds.includes(group.id)}
                            onCheckedChange={() => toggleGroup(group.id)}
                          />
                          <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                            <Users className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{group.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {group.memberCount} members
                            </p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>
                      {selectedGroupIds.length} groups ({totalCreatorCount} total
                      creators)
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Template Selection */}
          {step === "template" && (
            <div className="space-y-4">
              <Label>Select Request Template</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={cn(
                      "flex items-start gap-3 p-4 rounded-lg border text-left transition-all",
                      selectedTemplateId === template.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div
                      className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                        selectedTemplateId === template.id
                          ? "bg-primary text-white"
                          : "bg-muted"
                      )}
                    >
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{template.name}</p>
                      {template.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {template.description}
                        </p>
                      )}
                    </div>
                    {selectedTemplateId === template.id && (
                      <Check className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
              {templates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No templates available</p>
                  <p className="text-sm">Create a template first to use recurring requests</p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Settings */}
          {step === "settings" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Recurring Request Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Weekly Content Requests"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes about this recurring request..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Request Title Template *</Label>
                <Input
                  value={titleTemplate}
                  onChange={(e) => setTitleTemplate(e.target.value)}
                  placeholder="{month} Content Request"
                />
                <p className="text-xs text-muted-foreground">
                  Available variables: {"{date}"}, {"{week}"}, {"{month}"}, {"{year}"}, {"{creator_name}"}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Request Description</Label>
                <Textarea
                  value={requestDescription}
                  onChange={(e) => setRequestDescription(e.target.value)}
                  placeholder="Description for each created request..."
                  rows={2}
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
                  checked={autoSendNotification}
                  onCheckedChange={setAutoSendNotification}
                />
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === "review" && (
            <div className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Repeat className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{name || "Untitled"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {FREQUENCY_LABELS[frequency]} recurring request
                    </p>
                  </div>
                </div>

                {description && <p className="text-sm">{description}</p>}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Frequency</p>
                  <p className="font-medium">{FREQUENCY_LABELS[frequency]}</p>
                  {(frequency === "WEEKLY" || frequency === "BIWEEKLY") && (
                    <p className="text-sm text-muted-foreground">
                      Every {DAY_OF_WEEK_LABELS[dayOfWeek]}
                    </p>
                  )}
                  {(frequency === "MONTHLY" || frequency === "QUARTERLY") && (
                    <p className="text-sm text-muted-foreground">
                      Day {dayOfMonth} of the month
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-medium">{timeOfDay}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Starts</p>
                  <p className="font-medium">
                    {startDate ? format(startDate, "MMM d, yyyy") : "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Ends</p>
                  <p className="font-medium">
                    {endDate
                      ? format(endDate, "MMM d, yyyy")
                      : maxOccurrences
                      ? `After ${maxOccurrences} runs`
                      : "Never"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Creators</p>
                <div className="flex flex-wrap gap-2">
                  {selectionMode === "individual" ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      {selectedGroupIds.map((id) => {
                        const group = creatorGroups.find((g) => g.id === id);
                        return group ? (
                          <Badge key={id} variant="secondary">
                            {group.name} ({group.memberCount})
                          </Badge>
                        ) : null;
                      })}
                    </>
                  )}
                </div>
              </div>

              {selectedTemplate && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Template</p>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">{selectedTemplate.name}</span>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3 pt-2 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Title Template</p>
                  <p className="font-medium text-sm">{titleTemplate}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due In</p>
                  <p className="font-medium">{dueInDays} days</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Urgency</p>
                  <Badge variant="outline">{urgency}</Badge>
                </div>
              </div>

              {totalCreatorCount > 10 && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-800 dark:text-amber-200">
                  <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">Large Creator Base</p>
                    <p>
                      This will create {totalCreatorCount} requests each time it runs.
                      Make sure this is intentional.
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
          {currentStepIndex < STEPS.length - 1 ? (
            <Button type="button" onClick={goNext} disabled={!canProceed()}>
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
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {editingRequest ? "Update Recurring Request" : "Create Recurring Request"}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RecurringRequestModal;
