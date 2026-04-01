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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

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
    source: "creator_override" | "urgency_rule" | "default";
    ruleId?: string;
    overrideId?: string;
  };
  summary: string;
}

interface ReminderSchedulePreviewProps {
  creatorId: string | null;
  urgency: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueDate: string | null;
  className?: string;
  showDetails?: boolean;
}

// ============================================
// HELPER COMPONENTS
// ============================================

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

function getTypeColor(type: ReminderPreview["type"]) {
  switch (type) {
    case "UPCOMING":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "DUE_TODAY":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "OVERDUE":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "ESCALATION":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function getConfigSourceLabel(source: ReminderPreviewResponse["config"]["source"]) {
  switch (source) {
    case "creator_override":
      return "Custom creator settings";
    case "urgency_rule":
      return "Agency urgency rule";
    case "default":
      return "Default settings";
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ReminderSchedulePreview({
  creatorId,
  urgency,
  dueDate,
  className,
  showDetails = true,
}: ReminderSchedulePreviewProps) {
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
  }, [creatorId, urgency, dueDate]);

  // Don't render if no due date or creator
  if (!creatorId || !dueDate) {
    return null;
  }

  // Loading state
  if (isLoading && !preview) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading reminder schedule...</span>
      </div>
    );
  }

  // Error state
  if (error && !preview) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-red-600 dark:text-red-400", className)}>
        <AlertCircle className="h-4 w-4" />
        <span>{error}</span>
      </div>
    );
  }

  // No preview available
  if (!preview) {
    return null;
  }

  // No reminders scheduled
  if (preview.count === 0) {
    return (
      <div className={cn("flex items-center gap-2 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30", className)}>
        <Info className="h-4 w-4 text-amber-500" />
        <span className="text-sm text-amber-700 dark:text-amber-400">
          No automatic reminders will be scheduled for this request
        </span>
      </div>
    );
  }

  // Compact view
  if (!showDetails) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Bell className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {preview.summary}
        </span>
        {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
    );
  }

  // Full view with details
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn("rounded-lg border bg-card", className)}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">{preview.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {getConfigSourceLabel(preview.config.source)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t p-3 space-y-2">
            {preview.reminders.map((reminder, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 rounded-md bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={cn("h-6 w-6 rounded-full flex items-center justify-center", getTypeColor(reminder.type))}>
                          <ReminderTypeIcon type={reminder.type} />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{reminder.type.replace("_", " ")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div>
                    <p className="text-sm font-medium">{reminder.formattedDate}</p>
                    <p className="text-xs text-muted-foreground">{reminder.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="gap-1">
                          <ChannelIcon channel={reminder.channel} />
                          {reminder.channel}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {reminder.channel === "SMS"
                            ? "SMS notification"
                            : "Email notification"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {reminder.isEscalation && (
                    <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                      <Zap className="h-3 w-3 mr-1" />
                      Escalation
                    </Badge>
                  )}
                </div>
              </div>
            ))}

            <div className="pt-2 flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <p>
                Reminders are sent automatically based on the due date. You can modify
                the schedule after the request is created or customize settings for
                specific creators.
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default ReminderSchedulePreview;
