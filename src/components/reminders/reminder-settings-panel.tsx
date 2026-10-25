"use client";

import * as React from "react";
import { format, addDays } from "date-fns";
import {
  Send,
  Loader2,
  Check,
  X,
  Mail,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { DayField } from "@/components/ui/day-field";
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


import { toast } from "sonner";
import { ReminderPreviewCalendar, ScheduledReminder } from "./reminder-preview-calendar";

// TYPES

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

// TEST REMINDER COMPONENT

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
          message: data.message || "Test reminder sent",
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
          <div>
            <CardTitle className="text-base">Test reminder</CardTitle>
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
              <SelectTrigger aria-label="Send test via">
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
            <Button variant="outline" onClick={handleSendTest} disabled={isSending}>
              {isSending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send test
            </Button>
          </div>
        </div>

        {testResult && (
          <div
            className={cn(
              "flex items-center gap-2 p-3 rounded-lg text-sm",
              testResult.success
                ? "bg-success/10 text-success"
                : "bg-late/12 text-late"
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

// PREVIEW CALENDAR SECTION

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
    LOW: { label: "Low", color: "bg-tile-hi text-ink-2" },
    NORMAL: { label: "Normal", color: "bg-tile-hi text-ink" },
    HIGH: { label: "High", color: "bg-tile-hi text-ink" },
    URGENT: { label: "Urgent", color: "bg-late/14 text-late" },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="space-y-2">
          <Label>Urgency level</Label>
          <Select value={selectedUrgency} onValueChange={setSelectedUrgency}>
            <SelectTrigger aria-label="Urgency level" className="w-[160px]">
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
          <Label>Sample due date</Label>
          <DayField
            label="Sample due date"
            value={dueDate}
            onChange={(v) => v && setDueDate(v)}
            className="w-[170px]"
          />
        </div>
      </div>

      <ReminderPreviewCalendar
        reminders={previewReminders}
        dueDate={new Date(dueDate)}
        title="Preview schedule"
        description={`Preview for ${urgencyConfig[selectedUrgency]?.label || ""} urgency requests`}
      />

      {previewReminders.length === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-well text-ink-2 text-sm">
          <AlertCircle className="h-4 w-4" />
          No active rule found for {urgencyConfig[selectedUrgency]?.label} urgency.
          Create a rule to see the preview.
        </div>
      )}
    </div>
  );
}

// MAIN COMPONENT

export function ReminderSettingsPanel({ rules, className }: ReminderSettingsPanelProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Test Reminder */}
      <TestReminderSection />

      {/* Preview Calendar */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div>
              <CardTitle className="text-base">Schedule preview</CardTitle>
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
