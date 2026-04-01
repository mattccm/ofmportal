"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  ArrowLeft,
  Loader2,
  Plus,
  AlertCircle,
  Settings,
  Clock,
  Zap,
  MessageSquare,
  Check,
  X,
  Save,
  RotateCcw,
  Play,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ReminderSettingsPanel, TieredTemplatesPanel } from "@/components/reminders";

// ============================================
// TYPES
// ============================================

interface ReminderRule {
  id?: string;
  urgency: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  reminderDays: number[];
  overdueReminderFrequency: "NONE" | "DAILY" | "EVERY_2_DAYS" | "EVERY_3_DAYS" | "WEEKLY";
  maxOverdueReminders: number;
  smsEscalationDays: number | null;
  escalateToSms: boolean;
  isActive: boolean;
  name?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface RulesResponse {
  rules: ReminderRule[];
  missingUrgencies: string[];
  defaults: {
    reminderDays: number[];
    overdueReminderFrequency: string;
    maxOverdueReminders: number;
    smsEscalationDays: number | null;
    escalateToSms: boolean;
  };
}

const URGENCY_CONFIG = {
  LOW: {
    label: "Low",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    description: "Standard content with flexible deadlines",
    defaultDays: [5, 2, 0],
  },
  NORMAL: {
    label: "Normal",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    description: "Regular requests with standard deadlines",
    defaultDays: [3, 1, 0],
  },
  HIGH: {
    label: "High",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    description: "Priority content needing prompt attention",
    defaultDays: [2, 1, 0],
  },
  URGENT: {
    label: "Urgent",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    description: "Time-sensitive content with tight deadlines",
    defaultDays: [1, 0],
  },
};

const OVERDUE_FREQUENCY_OPTIONS = [
  { value: "NONE", label: "No overdue reminders" },
  { value: "DAILY", label: "Daily" },
  { value: "EVERY_2_DAYS", label: "Every 2 days" },
  { value: "EVERY_3_DAYS", label: "Every 3 days" },
  { value: "WEEKLY", label: "Weekly" },
];

// ============================================
// COMPONENTS
// ============================================

function ReminderDaysInput({
  value,
  onChange,
  disabled,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = React.useState(value.join(", "));

  const handleBlur = () => {
    const parsed = inputValue
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 0 && n <= 30)
      .sort((a, b) => b - a);

    const unique = [...new Set(parsed)];
    setInputValue(unique.join(", "));
    onChange(unique);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleBlur}
          placeholder="3, 1, 0"
          disabled={disabled}
          className="font-mono"
        />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground">
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px]">
              <p>
                Enter days before the due date to send reminders. Use comma-separated values.
                <br /><br />
                Example: "3, 1, 0" means reminders will be sent 3 days before, 1 day before, and on the due date.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex flex-wrap gap-1">
        {value.map((day) => (
          <Badge key={day} variant="secondary" className="text-xs">
            {day === 0 ? "Due day" : `${day} day${day > 1 ? "s" : ""} before`}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function RuleCard({
  rule,
  onChange,
  onSave,
  onDelete,
  isNew,
  isSaving,
}: {
  rule: ReminderRule;
  onChange: (updates: Partial<ReminderRule>) => void;
  onSave: () => void;
  onDelete?: () => void;
  isNew?: boolean;
  isSaving?: boolean;
}) {
  const config = URGENCY_CONFIG[rule.urgency];

  return (
    <Card className="card-elevated">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Badge className={config.color}>{config.label}</Badge>
            <div className="flex items-center gap-2">
              <Switch
                checked={rule.isActive}
                onCheckedChange={(checked) => onChange({ isActive: checked })}
              />
              <span className="text-sm text-muted-foreground">
                {rule.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
          {isNew && (
            <Badge variant="outline" className="text-xs">
              New
            </Badge>
          )}
        </div>
        <CardDescription className="mt-2">{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Reminder Days */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Reminder Schedule (days before due date)
          </Label>
          <ReminderDaysInput
            value={rule.reminderDays}
            onChange={(days) => onChange({ reminderDays: days })}
            disabled={!rule.isActive}
          />
        </div>

        {/* Overdue Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              Overdue Reminder Frequency
            </Label>
            <Select
              value={rule.overdueReminderFrequency}
              onValueChange={(value) =>
                onChange({
                  overdueReminderFrequency: value as ReminderRule["overdueReminderFrequency"],
                })
              }
              disabled={!rule.isActive}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OVERDUE_FREQUENCY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Max Overdue Reminders</Label>
            <Input
              type="number"
              min={0}
              max={20}
              value={rule.maxOverdueReminders}
              onChange={(e) =>
                onChange({ maxOverdueReminders: parseInt(e.target.value) || 0 })
              }
              disabled={!rule.isActive || rule.overdueReminderFrequency === "NONE"}
            />
          </div>
        </div>

        {/* SMS Escalation */}
        <div className="space-y-4 p-4 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 cursor-pointer">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              SMS Escalation
            </Label>
            <Switch
              checked={rule.escalateToSms}
              onCheckedChange={(checked) =>
                onChange({
                  escalateToSms: checked,
                  smsEscalationDays: checked ? (rule.smsEscalationDays || 2) : null,
                })
              }
              disabled={!rule.isActive}
            />
          </div>

          {rule.escalateToSms && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Escalate to SMS after how many days overdue?
              </Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={rule.smsEscalationDays || 2}
                onChange={(e) =>
                  onChange({ smsEscalationDays: parseInt(e.target.value) || 2 })
                }
                disabled={!rule.isActive}
                className="max-w-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                After {rule.smsEscalationDays || 2} days overdue, reminders will also be sent via SMS
                (if the creator has a phone number and SMS contact preference).
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-2" />
                Remove Rule
              </Button>
            )}
          </div>
          <Button onClick={onSave} disabled={isSaving} size="sm">
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isNew ? "Create Rule" : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function ReminderRulesPage() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = React.useState(false);
  const [rules, setRules] = React.useState<ReminderRule[]>([]);
  const [missingUrgencies, setMissingUrgencies] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch rules on mount
  React.useEffect(() => {
    fetchRules();
  }, []);

  async function fetchRules() {
    try {
      setIsLoading(true);
      const response = await fetch("/api/reminder-rules");

      if (!response.ok) {
        throw new Error("Failed to fetch reminder rules");
      }

      const data: RulesResponse = await response.json();
      setRules(data.rules);
      setMissingUrgencies(data.missingUrgencies);
    } catch (err) {
      console.error("Error fetching reminder rules:", err);
      setError("Failed to load reminder rules. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // Add a new rule for a missing urgency
  function addRule(urgency: string) {
    const config = URGENCY_CONFIG[urgency as keyof typeof URGENCY_CONFIG];
    const newRule: ReminderRule = {
      urgency: urgency as ReminderRule["urgency"],
      reminderDays: config.defaultDays,
      overdueReminderFrequency: "DAILY",
      maxOverdueReminders: 5,
      smsEscalationDays: null,
      escalateToSms: false,
      isActive: true,
    };

    setRules((prev) => [...prev, newRule]);
    setMissingUrgencies((prev) => prev.filter((u) => u !== urgency));
  }

  // Update a rule locally
  function updateRule(urgency: string, updates: Partial<ReminderRule>) {
    setRules((prev) =>
      prev.map((r) => (r.urgency === urgency ? { ...r, ...updates } : r))
    );
  }

  // Save a rule
  async function saveRule(rule: ReminderRule) {
    try {
      setIsSaving(rule.urgency);

      const method = rule.id ? "PUT" : "POST";
      const body = rule.id
        ? { id: rule.id, ...rule }
        : rule;

      const response = await fetch("/api/reminder-rules", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save rule");
      }

      const data = await response.json();

      // Update the rule with the returned data (includes ID)
      setRules((prev) =>
        prev.map((r) => (r.urgency === rule.urgency ? data.rule : r))
      );

      toast.success(`${URGENCY_CONFIG[rule.urgency].label} urgency rule saved`);
    } catch (err) {
      console.error("Error saving rule:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save rule");
    } finally {
      setIsSaving(null);
    }
  }

  // Delete a rule
  async function deleteRule(rule: ReminderRule) {
    if (!rule.id) {
      // Just remove from local state if not saved yet
      setRules((prev) => prev.filter((r) => r.urgency !== rule.urgency));
      setMissingUrgencies((prev) => [...prev, rule.urgency]);
      return;
    }

    try {
      const response = await fetch(`/api/reminder-rules?id=${rule.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete rule");
      }

      setRules((prev) => prev.filter((r) => r.urgency !== rule.urgency));
      setMissingUrgencies((prev) => [...prev, rule.urgency]);
      toast.success(`${URGENCY_CONFIG[rule.urgency].label} urgency rule removed`);
    } catch (err) {
      console.error("Error deleting rule:", err);
      toast.error("Failed to delete rule");
    }
  }

  // Reschedule all pending requests
  async function rescheduleAll() {
    try {
      setIsRescheduling(true);

      const response = await fetch("/api/reminder-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: rules,
          rescheduleExisting: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reschedule reminders");
      }

      const data = await response.json();
      toast.success(
        `Reminders rescheduled for ${data.rescheduleResult?.success || 0} requests`
      );
    } catch (err) {
      console.error("Error rescheduling:", err);
      toast.error("Failed to reschedule reminders");
    } finally {
      setIsRescheduling(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Loading reminder rules...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
            <Bell className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Auto-Reminder Rules
            </h1>
            <p className="text-muted-foreground">
              Configure automatic reminder schedules by urgency level
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={rescheduleAll}
          disabled={isRescheduling || rules.length === 0}
        >
          {isRescheduling ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4 mr-2" />
          )}
          Reschedule All
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          <button
            onClick={fetchRules}
            className="text-sm text-red-600 hover:underline ml-auto"
          >
            Retry
          </button>
        </div>
      )}

      {/* Tabs for Rules, Templates, and Settings */}
      <Tabs defaultValue="rules" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-[500px]">
          <TabsTrigger value="rules">Urgency Rules</TabsTrigger>
          <TabsTrigger value="templates">Message Templates</TabsTrigger>
          <TabsTrigger value="settings">Settings & Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-6">
          {/* Info Card */}
          <Card className="card-elevated bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200/50 dark:border-blue-800/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p>
                    <strong>How it works:</strong> When a content request is created,
                    the system automatically schedules reminders based on the urgency
                    level. These reminders are sent before the due date and (optionally)
                    after the request becomes overdue.
                  </p>
                  <p className="mt-2">
                    Creators with custom reminder settings will override these rules.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Existing Rules */}
          <div className="space-y-4">
            {rules
              .sort((a, b) => {
                const order = ["LOW", "NORMAL", "HIGH", "URGENT"];
                return order.indexOf(a.urgency) - order.indexOf(b.urgency);
              })
              .map((rule) => (
                <RuleCard
                  key={rule.urgency}
                  rule={rule}
                  onChange={(updates) => updateRule(rule.urgency, updates)}
                  onSave={() => saveRule(rule)}
                  onDelete={() => deleteRule(rule)}
                  isNew={!rule.id}
                  isSaving={isSaving === rule.urgency}
                />
              ))}
          </div>

          {/* Add Missing Urgencies */}
          {missingUrgencies.length > 0 && (
            <Card className="card-elevated border-dashed">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className="h-12 w-12 rounded-xl bg-muted mx-auto flex items-center justify-center">
                    <Plus className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium">Add Reminder Rules</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Create rules for the following urgency levels:
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {missingUrgencies.map((urgency) => {
                      const config = URGENCY_CONFIG[urgency as keyof typeof URGENCY_CONFIG];
                      return (
                        <Button
                          key={urgency}
                          variant="outline"
                          onClick={() => addRule(urgency)}
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          <Badge className={config.color}>{config.label}</Badge>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {rules.length === 0 && missingUrgencies.length === 0 && (
            <Card className="card-elevated">
              <CardContent className="p-12">
                <div className="text-center space-y-4">
                  <div className="h-16 w-16 rounded-2xl bg-muted mx-auto flex items-center justify-center">
                    <Bell className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">No Reminder Rules</h3>
                    <p className="text-muted-foreground mt-1">
                      Get started by creating reminder rules for different urgency levels.
                    </p>
                  </div>
                  <Button onClick={fetchRules}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preview Section */}
          {rules.length > 0 && (
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5 text-muted-foreground" />
                  Preview
                </CardTitle>
                <CardDescription>
                  See how reminders would be scheduled for a sample request
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {rules
                    .filter((r) => r.isActive)
                    .map((rule) => {
                      const config = URGENCY_CONFIG[rule.urgency];
                      return (
                        <div
                          key={rule.urgency}
                          className="flex items-start gap-4 p-4 rounded-lg bg-muted/50"
                        >
                          <Badge className={config.color}>{config.label}</Badge>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium">
                              Pre-due-date reminders:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {rule.reminderDays.map((day) => (
                                <Badge key={day} variant="outline" className="text-xs">
                                  {day === 0
                                    ? "Due day"
                                    : `${day}d before`}
                                </Badge>
                              ))}
                            </div>
                            {rule.overdueReminderFrequency !== "NONE" && (
                              <>
                                <p className="text-sm font-medium mt-2">
                                  Overdue reminders:
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {OVERDUE_FREQUENCY_OPTIONS.find(
                                    (o) => o.value === rule.overdueReminderFrequency
                                  )?.label}
                                  {" "} (max {rule.maxOverdueReminders})
                                </p>
                              </>
                            )}
                            {rule.escalateToSms && rule.smsEscalationDays && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                                <Zap className="h-3 w-3 inline mr-1" />
                                SMS escalation after {rule.smsEscalationDays} days overdue
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="templates">
          <TieredTemplatesPanel />
        </TabsContent>

        <TabsContent value="settings">
          <ReminderSettingsPanel rules={rules} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
