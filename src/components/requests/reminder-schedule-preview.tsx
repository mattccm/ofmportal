"use client";

import * as React from "react";
import {
  Bell,
  Clock,
  MessageSquare,
  Mail,
  Loader2,
  AlertCircle,
  Info,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// TYPES

interface ReminderPreview {
  scheduledAt: string;
  type: "UPCOMING" | "DUE_TODAY" | "OVERDUE" | "ESCALATION";
  channel: "EMAIL" | "SMS";
  daysFromDue: number;
  isEscalation: boolean;
  formattedDate: string;
  formattedTime: string;
  label: string;
}

interface ReminderPreviewResponse {
  reminders: ReminderPreview[];
  count: number;
  config: {
    source: "creator_override" | "urgency_rule" | "default" | "template" | "request";
    ruleId?: string;
    overrideId?: string;
    /** "From template Story clips", "Agency defaults", "Jade's own schedule" */
    label?: string;
  };
  summary: string;
}

interface ReminderSchedulePreviewProps {
  creatorId: string | null;
  urgency: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueDate: string | null;
  className?: string;
  showDetails?: boolean;
  /** The template the request is made from (its plan applies) */
  templateId?: string;
  /** A plan set for this request; undefined = the template's */
  messaging?: unknown;
}

// HELPER COMPONENTS

function ReminderTypeIcon({ type }: { type: ReminderPreview["type"] }) {
  switch (type) {
    case "UPCOMING":
      return <Clock className="h-3.5 w-3.5" />;
    case "DUE_TODAY":
      return <Bell className="h-3.5 w-3.5" />;
    case "OVERDUE":
      return <AlertCircle className="h-3.5 w-3.5" />;
    case "ESCALATION":
      return <Zap className="h-3.5 w-3.5" />;
    default:
      return <Bell className="h-3.5 w-3.5" />;
  }
}

function ChannelIcon({ channel }: { channel: "EMAIL" | "SMS" }) {
  return channel === "SMS" ? (
    <MessageSquare className="h-3.5 w-3.5" />
  ) : (
    <Mail className="h-3.5 w-3.5" />
  );
}

function getConfigSourceLabel(source: ReminderPreviewResponse["config"]["source"], label?: string) {
  if (label) return label;
  switch (source) {
    case "creator_override":
      return "Custom creator settings";
    case "urgency_rule":
      return "Agency urgency rule";
    case "default":
      return "Default settings";
    default:
      return "This request's plan";
  }
}

// MAIN COMPONENT

export function ReminderSchedulePreview({
  creatorId,
  urgency,
  dueDate,
  className,
  showDetails = true,
  templateId,
  messaging,
}: ReminderSchedulePreviewProps) {
  const planKey = messaging === undefined ? "" : JSON.stringify(messaging);
  const [isLoading, setIsLoading] = React.useState(false);
  const [preview, setPreview] = React.useState<ReminderPreviewResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  // Debounce timer ref
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  // Fetch preview when inputs change
  React.useEffect(() => {
    // Clear previous timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Reset state if missing required fields
    if (!creatorId || !dueDate) {
      setPreview(null);
      setError(null);
      return;
    }

    // Debounce the API call
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/reminder-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorId,
            urgency,
            dueDate,
            templateId,
            ...(planKey ? { messaging: JSON.parse(planKey) } : {}),
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch reminder preview");
        }

        const data = await response.json();
        setPreview(data);
      } catch (err) {
        console.error("Error fetching reminder preview:", err);
        setError("Unable to preview reminders");
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [creatorId, urgency, dueDate, templateId, planKey]);

  // Don't render if no due date or creator
  if (!creatorId || !dueDate) {
    return null;
  }

  if (isLoading && !preview) {
    return (
      <p className={cn("flex items-center gap-2 text-sm text-ink-2", className)}>
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Working out the reminder schedule
      </p>
    );
  }

  if (error && !preview) {
    return (
      <p className={cn("flex items-center gap-2 text-sm text-ink-2", className)}>
        <AlertCircle className="size-4 text-late" aria-hidden="true" />
        Couldn&apos;t load the reminder schedule. It will still follow your reminder rules.
      </p>
    );
  }

  if (!preview) return null;

  if (preview.count === 0) {
    return (
      <p className={cn("flex items-center gap-2 text-sm text-ink-2", className)}>
        <Info className="size-4 text-icon" aria-hidden="true" />
        No automatic reminders for this one ({getConfigSourceLabel(preview.config.source, preview.config.label)}).
      </p>
    );
  }

  if (!showDetails) {
    return (
      <p className={cn("flex items-center gap-2 text-sm text-ink-2", className)}>
        <Bell className="size-4 text-icon" aria-hidden="true" />
        {preview.summary}
        {isLoading && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
      </p>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn("rounded-[var(--tw-r-tile)] bg-tile", className)}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-[var(--tw-r-tile)] px-3.5 py-3 text-left transition-colors hover:bg-tile-hi focus-visible:outline-2 focus-visible:outline-acc"
          >
            <span className="flex min-w-0 items-center gap-3">
              <Bell className="size-4 shrink-0 text-icon" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{preview.summary}</span>
                <span className="block text-[13px] text-ink-2">
                  {getConfigSourceLabel(preview.config.source, preview.config.label)}
                </span>
              </span>
            </span>
            <span className="flex items-center gap-2 text-icon">
              {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              <span className="text-[13px] text-ink-2">{isOpen ? "Hide" : "Show"} schedule</span>
              {isOpen ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
            </span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <ol className="flex flex-col gap-1 px-2 pb-2">
            {preview.reminders.map((reminder, index) => (
              <li
                key={index}
                className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--tw-r-ctl)] px-2 py-2 hover:bg-tile-hi"
              >
                <span className={cn(reminder.type === "OVERDUE" || reminder.isEscalation ? "text-late" : "text-icon")}>
                  <ReminderTypeIcon type={reminder.type} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium tabular-nums">
                    {reminder.formattedDate}
                    <span className="font-normal text-ink-2"> · {reminder.formattedTime}</span>
                  </span>
                  <span className="block truncate text-[13px] text-ink-2">
                    {reminder.label}
                    {reminder.isEscalation ? " · escalation" : ""}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
                  <ChannelIcon channel={reminder.channel} />
                  {reminder.channel === "SMS" ? "Text" : "Email"}
                </span>
              </li>
            ))}
          </ol>
          <p className="px-3.5 pb-3 text-[13px] text-ink-2">
            Reminders follow the due date and never carry the request title. Change a
            creator&apos;s schedule from their profile.
          </p>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default ReminderSchedulePreview;
