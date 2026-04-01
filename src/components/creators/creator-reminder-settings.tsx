"use client";

import * as React from "react";
import {
  Bell,
  Loader2,
  AlertCircle,
  Clock,
  MessageSquare,
  Save,
  RotateCcw,
  Info,
  Check,
  X,
  BellOff,
  Settings,
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
import { Textarea } from "@/components/ui/textarea";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

interface ReminderOverride {
  id?: string;
  useCustomSettings: boolean;
  reminderDays: number[];
  overdueReminderFrequency: "NONE" | "DAILY" | "EVERY_2_DAYS" | "EVERY_3_DAYS" | "WEEKLY";
  maxOverdueReminders: number;
  smsEscalationDays: number | null;
  escalateToSms: boolean;
  disableReminders: boolean;
  notes: string | null;
}

interface AgencyRule {
  urgency: string;
  reminderDays: number[];
  overdueReminderFrequency: string;
  maxOverdueReminders: number;
  smsEscalationDays: number | null;
  escalateToSms: boolean;
}

interface ReminderSettingsResponse {
  creator: {
    id: string;
    name: string;
    preferredContact: string;
  };
  override: ReminderOverride | null;
  hasCustomSettings: boolean;
  agencyRules: AgencyRule[];
  pendingRequestsCount: number;
  defaults: {
    reminderDays: number[];
    overdueReminderFrequency: string;
    maxOverdueReminders: number;
    smsEscalationDays: number | null;
    escalateToSms: boolean;
    disableReminders: boolean;
  };
}

interface CreatorReminderSettingsProps {
  creatorId: string;
  creatorName?: string;
  onSave?: () => void;
  compact?: boolean;
}

const OVERDUE_FREQUENCY_OPTIONS = [
  { value: "NONE", label: "No overdue reminders" },
  { value: "DAILY", label: "Daily" },
  { value: "EVERY_2_DAYS", label: "Every 2 days" },
  { value: "EVERY_3_DAYS", label: "Every 3 days" },
  { value: "WEEKLY", label: "Weekly" },
];

// ============================================
// REMINDER DAYS INPUT COMPONENT
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

  React.useEffect(() => {
    setInputValue(value.join(", "));
  }, [value]);

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
                Example: "3, 1, 0" means reminders 3 days before, 1 day before, and on the due date.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex flex-wrap gap-1">
        {value.map((day) => (
          <Badge key={day} variant="secondary" className="text-xs">
            {day === 0 ? "Due day" : `${day}d before`}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CreatorReminderSettings({
  creatorId,
  creatorName,
  onSave,
  compact = false,
}: CreatorReminderSettingsProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<ReminderSettingsResponse | null>(null);
  const [localSettings, setLocalSettings] = React.useState<ReminderOverride | null>(null);
  const [isOpen, setIsOpen] = React.useState(!compact);

  // Fetch settings on mount
  React.useEffect(() => {
    fetchSettings();
  }, [creatorId]);

  async function fetchSettings() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/creators/${creatorId}/reminder-settings`);

      if (!response.ok) {
        throw new Error("Failed to fetch reminder settings");
      }

      const responseData: ReminderSettingsResponse = await response.json();
      setData(responseData);

      // Initialize local settings
      if (responseData.override) {
        setLocalSettings(responseData.override);
      } else {
        setLocalSettings({
          useCustomSettings: false,
          reminderDays: responseData.defaults.reminderDays,
          overdueReminderFrequency: responseData.defaults.overdueReminderFrequency as ReminderOverride["overdueReminderFrequency"],
          maxOverdueReminders: responseData.defaults.maxOverdueReminders,
          smsEscalationDays: responseData.defaults.smsEscalationDays,
          escalateToSms: responseData.defaults.escalateToSms,
          disableReminders: responseData.defaults.disableReminders,
          notes: null,
        });
      }
    } catch (err) {
      console.error("Error fetching reminder settings:", err);
      setError("Failed to load reminder settings");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveSettings(reschedule: boolean = false) {
    if (!localSettings) return;

    try {
      setIsSaving(true);

      const response = await fetch(`/api/creators/${creatorId}/reminder-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...localSettings,
          rescheduleExisting: reschedule,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save settings");
      }

      const result = await response.json();

      toast.success(
        reschedule
          ? `Settings saved and ${result.rescheduleResult?.success || 0} requests rescheduled`
          : "Reminder settings saved"
      );

      onSave?.();
      fetchSettings(); // Refresh data
    } catch (err) {
      console.error("Error saving settings:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  async function resetToDefaults() {
    if (!data) return;

    try {
      setIsSaving(true);

      const response = await fetch(
        `/api/creators/${creatorId}/reminder-settings?reschedule=true`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to reset settings");
      }

      toast.success("Reminder settings reset to agency defaults");
      onSave?.();
      fetchSettings();
    } catch (err) {
      console.error("Error resetting settings:", err);
      toast.error("Failed to reset settings");
    } finally {
      setIsSaving(false);
    }
  }

  function updateSettings(updates: Partial<ReminderOverride>) {
    setLocalSettings((prev) => (prev ? { ...prev, ...updates } : null));
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className="card-elevated">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-3 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading reminder settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error || !data || !localSettings) {
    return (
      <Card className="card-elevated border-red-200 dark:border-red-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span>{error || "Failed to load settings"}</span>
            <Button variant="ghost" size="sm" onClick={fetchSettings}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasChanges = JSON.stringify(localSettings) !== JSON.stringify(data.override || {
    useCustomSettings: false,
    reminderDays: data.defaults.reminderDays,
    overdueReminderFrequency: data.defaults.overdueReminderFrequency,
    maxOverdueReminders: data.defaults.maxOverdueReminders,
    smsEscalationDays: data.defaults.smsEscalationDays,
    escalateToSms: data.defaults.escalateToSms,
    disableReminders: data.defaults.disableReminders,
    notes: null,
  });

  const content = (
    <div className="space-y-6">
      {/* Disable Reminders Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
            localSettings.disableReminders
              ? "bg-red-100 dark:bg-red-900/30"
              : "bg-emerald-100 dark:bg-emerald-900/30"
          }`}>
            {localSettings.disableReminders ? (
              <BellOff className="h-5 w-5 text-red-600 dark:text-red-400" />
            ) : (
              <Bell className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            )}
          </div>
          <div>
            <p className="font-medium">
              {localSettings.disableReminders ? "Reminders Disabled" : "Reminders Enabled"}
            </p>
            <p className="text-sm text-muted-foreground">
              {localSettings.disableReminders
                ? "No automatic reminders will be sent to this creator"
                : "Automatic reminders are active for this creator"}
            </p>
          </div>
        </div>
        <Switch
          checked={!localSettings.disableReminders}
          onCheckedChange={(checked) =>
            updateSettings({ disableReminders: !checked })
          }
        />
      </div>

      {!localSettings.disableReminders && (
        <>
          {/* Custom Settings Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Use Custom Settings</Label>
              <p className="text-sm text-muted-foreground">
                Override agency default rules for this creator
              </p>
            </div>
            <Switch
              checked={localSettings.useCustomSettings}
              onCheckedChange={(checked) =>
                updateSettings({ useCustomSettings: checked })
              }
            />
          </div>

          {!localSettings.useCustomSettings && data.agencyRules.length > 0 && (
            <div className="p-4 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-700 dark:text-blue-400">
                    Using Agency Default Rules
                  </p>
                  <p className="text-muted-foreground mt-1">
                    This creator will follow the agency-wide reminder rules based on request urgency.
                    Enable custom settings above to override these defaults.
                  </p>
                </div>
              </div>
            </div>
          )}

          {localSettings.useCustomSettings && (
            <>
              {/* Reminder Days */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Reminder Schedule (days before due date)
                </Label>
                <ReminderDaysInput
                  value={localSettings.reminderDays}
                  onChange={(days) => updateSettings({ reminderDays: days })}
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
                    value={localSettings.overdueReminderFrequency}
                    onValueChange={(value) =>
                      updateSettings({
                        overdueReminderFrequency: value as ReminderOverride["overdueReminderFrequency"],
                      })
                    }
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
                    value={localSettings.maxOverdueReminders}
                    onChange={(e) =>
                      updateSettings({
                        maxOverdueReminders: parseInt(e.target.value) || 0,
                      })
                    }
                    disabled={localSettings.overdueReminderFrequency === "NONE"}
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
                    checked={localSettings.escalateToSms}
                    onCheckedChange={(checked) =>
                      updateSettings({
                        escalateToSms: checked,
                        smsEscalationDays: checked
                          ? localSettings.smsEscalationDays || 2
                          : null,
                      })
                    }
                  />
                </div>

                {localSettings.escalateToSms && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Escalate to SMS after how many days overdue?
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={localSettings.smsEscalationDays || 2}
                      onChange={(e) =>
                        updateSettings({
                          smsEscalationDays: parseInt(e.target.value) || 2,
                        })
                      }
                      className="max-w-[120px]"
                    />
                    {data.creator.preferredContact === "EMAIL" && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Note: This creator's preferred contact is Email only.
                        SMS escalation requires a phone number and SMS preference.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Add notes about why this creator has custom settings..."
              value={localSettings.notes || ""}
              onChange={(e) => updateSettings({ notes: e.target.value || null })}
              rows={3}
            />
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div>
          {data.override && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToDefaults}
              disabled={isSaving}
              className="text-muted-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data.pendingRequestsCount > 0 && hasChanges && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveSettings(true)}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Save & Reschedule ({data.pendingRequestsCount})
            </Button>
          )}
          <Button
            onClick={() => saveSettings(false)}
            disabled={isSaving || !hasChanges}
            size="sm"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );

  // Compact mode with collapsible
  if (compact) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="card-elevated">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Reminder Settings</CardTitle>
                    <CardDescription className="text-sm">
                      {localSettings.disableReminders
                        ? "Reminders disabled"
                        : localSettings.useCustomSettings
                        ? "Using custom settings"
                        : "Using agency defaults"}
                    </CardDescription>
                  </div>
                </div>
                <Settings
                  className={`h-5 w-5 text-muted-foreground transition-transform ${
                    isOpen ? "rotate-90" : ""
                  }`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">{content}</CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  // Full mode
  return (
    <Card className="card-elevated">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <CardTitle>Reminder Settings</CardTitle>
            <CardDescription>
              Configure automatic reminder schedule for {creatorName || data.creator.name}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

export default CreatorReminderSettings;
