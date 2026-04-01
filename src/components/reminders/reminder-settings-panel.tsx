"use client";

import * as React from "react";
import { format, addDays } from "date-fns";
import {
  Send,
  Loader2,
  Check,
  X,
  Clock,
  Moon,
  Settings,
  Mail,
  MessageSquare,
  Info,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { toast } from "sonner";
import { ReminderPreviewCalendar, ScheduledReminder } from "./reminder-preview-calendar";

// ============================================
// TYPES
// ============================================

interface ReminderRule {
  urgency: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  reminderDays: number[];
  overdueReminderFrequency: string;
  maxOverdueReminders: number;
  smsEscalationDays: number | null;
  escalateToSms: boolean;
  isActive: boolean;
}

interface QuietHoursConfig {
  enabled: boolean;
  start: string;
  end: string;
}

interface ReminderSettingsPanelProps {
  rules: ReminderRule[];
  className?: string;
}

// ============================================
// TEST REMINDER COMPONENT
// ============================================

function TestReminderSection() {
  const [isSending, setIsSending] = React.useState(false);
  const [channel, setChannel] = React.useState<"EMAIL" | "SMS">("EMAIL");
  const [testResult, setTestResult] = React.useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleSendTest = async () => {
    setIsSending(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/reminders/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestResult({
          success: true,
          message: data.message || "Test reminder sent successfully!",
        });
        toast.success(data.message || "Test reminder sent!");
      } else {
        setTestResult({
          success: false,
          message: data.error || "Failed to send test reminder",
        });
        toast.error(data.error || "Failed to send test reminder");
      }
    } catch (error) {
      console.error("Error sending test reminder:", error);
      setTestResult({
        success: false,
        message: "Network error - please try again",
      });
      toast.error("Failed to send test reminder");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="card-elevated">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
            <Send className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <CardTitle className="text-base">Test Reminder</CardTitle>
            <CardDescription>
              Send a test reminder to verify your setup
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="space-y-2 flex-1">
            <Label>Send test via</Label>
            <Select
              value={channel}
              onValueChange={(v) => setChannel(v as "EMAIL" | "SMS")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMAIL">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </div>
                </SelectItem>
                <SelectItem value="SMS">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    SMS
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="pt-6">
            <Button onClick={handleSendTest} disabled={isSending}>
              {isSending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Test
            </Button>
          </div>
        </div>

        {testResult && (
          <div
            className={cn(
              "flex items-center gap-2 p-3 rounded-lg text-sm",
              testResult.success
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
            )}
          >
            {testResult.success ? (
              <Check className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
            {testResult.message}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          The test will be sent to your account email/phone. Use this to verify
          your email and SMS providers are configured correctly.
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================
// SCHEDULE PREFERENCES COMPONENT
// ============================================

interface SchedulePreferences {
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  preferredSendTime: string;
  usePreferredTime: boolean;
  skipWeekends: boolean;
  allowedDays: number[]; // 0=Sunday, 6=Saturday
  batchReminders: boolean;
  batchTime: string;
}

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

function SchedulePreferencesSection() {
  const [prefs, setPrefs] = React.useState<SchedulePreferences>({
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    preferredSendTime: "09:00",
    usePreferredTime: false,
    skipWeekends: false,
    allowedDays: [1, 2, 3, 4, 5], // Mon-Fri by default
    batchReminders: false,
    batchTime: "10:00",
  });
  const [isSaving, setIsSaving] = React.useState(false);

  const toggleDay = (day: number) => {
    setPrefs((prev) => ({
      ...prev,
      allowedDays: prev.allowedDays.includes(day)
        ? prev.allowedDays.filter((d) => d !== day)
        : [...prev.allowedDays, day].sort(),
    }));
  };

  return (
    <Card className="card-elevated">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
            <Settings className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <CardTitle className="text-base">Schedule Preferences</CardTitle>
            <CardDescription>
              Fine-tune when and how reminders are sent
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quiet Hours */}
        <div className="space-y-4 p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium">Quiet Hours</Label>
            </div>
            <Switch
              checked={prefs.quietHoursEnabled}
              onCheckedChange={(enabled) => setPrefs({ ...prefs, quietHoursEnabled: enabled })}
            />
          </div>
          {prefs.quietHoursEnabled && (
            <div className="grid grid-cols-2 gap-4 pl-6">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Start</Label>
                <Input
                  type="time"
                  value={prefs.quietHoursStart}
                  onChange={(e) => setPrefs({ ...prefs, quietHoursStart: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">End</Label>
                <Input
                  type="time"
                  value={prefs.quietHoursEnd}
                  onChange={(e) => setPrefs({ ...prefs, quietHoursEnd: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>

        {/* Preferred Send Time */}
        <div className="space-y-4 p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium">Preferred Send Time</Label>
            </div>
            <Switch
              checked={prefs.usePreferredTime}
              onCheckedChange={(enabled) => setPrefs({ ...prefs, usePreferredTime: enabled })}
            />
          </div>
          {prefs.usePreferredTime && (
            <div className="pl-6 space-y-2">
              <Label className="text-xs text-muted-foreground">
                Send all reminders at this time (creator's local time)
              </Label>
              <Input
                type="time"
                value={prefs.preferredSendTime}
                onChange={(e) => setPrefs({ ...prefs, preferredSendTime: e.target.value })}
                className="w-[140px]"
              />
            </div>
          )}
        </div>

        {/* Allowed Days */}
        <div className="space-y-4 p-4 rounded-lg border">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label className="font-medium">Send Reminders On</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <Badge
                key={day.value}
                variant={prefs.allowedDays.includes(day.value) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleDay(day.value)}
              >
                {day.label}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Reminders will only be sent on selected days. If a reminder falls on a non-allowed day, it will be sent on the next allowed day.
          </p>
        </div>

        {/* Batch Reminders */}
        <div className="space-y-4 p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium">Batch Reminders</Label>
            </div>
            <Switch
              checked={prefs.batchReminders}
              onCheckedChange={(enabled) => setPrefs({ ...prefs, batchReminders: enabled })}
            />
          </div>
          {prefs.batchReminders && (
            <div className="pl-6 space-y-2">
              <Label className="text-xs text-muted-foreground">
                Combine multiple reminders into one email at this time
              </Label>
              <Input
                type="time"
                value={prefs.batchTime}
                onChange={(e) => setPrefs({ ...prefs, batchTime: e.target.value })}
                className="w-[140px]"
              />
              <p className="text-xs text-muted-foreground">
                If a creator has multiple requests due, they'll receive one email with all of them instead of multiple emails.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="text-muted-foreground">
            All times are interpreted in the creator's local timezone when possible.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// PREVIEW CALENDAR SECTION
// ============================================

function PreviewCalendarSection({ rules }: { rules: ReminderRule[] }) {
  const [selectedUrgency, setSelectedUrgency] = React.useState<string>("NORMAL");
  const [dueDate, setDueDate] = React.useState<string>(
    format(addDays(new Date(), 7), "yyyy-MM-dd")
  );

  // Calculate preview reminders based on selected rule and due date
  const previewReminders = React.useMemo(() => {
    const selectedRule = rules.find((r) => r.urgency === selectedUrgency && r.isActive);
    if (!selectedRule) return [];

    const dueDateObj = new Date(dueDate);
    const today = new Date();
    const reminders: ScheduledReminder[] = [];

    // Pre-due-date reminders
    for (const daysBefore of selectedRule.reminderDays) {
      const reminderDate = addDays(dueDateObj, -daysBefore);
      if (reminderDate >= today) {
        reminders.push({
          scheduledAt: reminderDate,
          type: daysBefore === 0 ? "DUE_TODAY" : "UPCOMING",
          channel: "EMAIL",
          daysFromDue: -daysBefore,
          isEscalation: false,
        });
      }
    }

    // Overdue reminders
    if (selectedRule.overdueReminderFrequency !== "NONE") {
      const interval =
        selectedRule.overdueReminderFrequency === "DAILY"
          ? 1
          : selectedRule.overdueReminderFrequency === "EVERY_2_DAYS"
            ? 2
            : selectedRule.overdueReminderFrequency === "EVERY_3_DAYS"
              ? 3
              : 7;

      for (let i = 1; i <= selectedRule.maxOverdueReminders; i++) {
        const daysOverdue = interval * i;
        const reminderDate = addDays(dueDateObj, daysOverdue);
        if (reminderDate >= today) {
          const isEscalation =
            selectedRule.escalateToSms &&
            selectedRule.smsEscalationDays !== null &&
            daysOverdue >= selectedRule.smsEscalationDays;

          reminders.push({
            scheduledAt: reminderDate,
            type: isEscalation ? "ESCALATION" : "OVERDUE",
            channel: isEscalation ? "SMS" : "EMAIL",
            daysFromDue: daysOverdue,
            isEscalation,
          });
        }
      }
    }

    return reminders.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }, [rules, selectedUrgency, dueDate]);

  const urgencyConfig: Record<string, { label: string; color: string }> = {
    LOW: { label: "Low", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
    NORMAL: { label: "Normal", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    HIGH: { label: "High", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    URGENT: { label: "Urgent", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="space-y-2">
          <Label>Urgency Level</Label>
          <Select value={selectedUrgency} onValueChange={setSelectedUrgency}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(urgencyConfig).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>
                  <Badge className={cfg.color}>{cfg.label}</Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Sample Due Date</Label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-[160px]"
          />
        </div>
      </div>

      <ReminderPreviewCalendar
        reminders={previewReminders}
        dueDate={new Date(dueDate)}
        title="Preview Schedule"
        description={`Preview for ${urgencyConfig[selectedUrgency]?.label || ""} urgency requests`}
      />

      {previewReminders.length === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm">
          <AlertCircle className="h-4 w-4" />
          No active rule found for {urgencyConfig[selectedUrgency]?.label} urgency.
          Create a rule to see the preview.
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ReminderSettingsPanel({ rules, className }: ReminderSettingsPanelProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Test Reminder */}
      <TestReminderSection />

      {/* Schedule Preferences (includes quiet hours) */}
      <SchedulePreferencesSection />

      {/* Preview Calendar */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-base">Schedule Preview</CardTitle>
              <CardDescription>
                See when reminders will be sent based on your rules
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PreviewCalendarSection rules={rules} />
        </CardContent>
      </Card>
    </div>
  );
}

export default ReminderSettingsPanel;
