"use client";

import * as React from "react";
import { format, addDays, addWeeks } from "date-fns";
import {
  Pause,
  Play,
  Calendar as CalendarIcon,
  Clock,
  AlertCircle,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

export interface PauseStatus {
  isPaused: boolean;
  pausedAt?: Date | null;
  pauseResumeAt?: Date | null;
  pauseReason?: string | null;
}

export interface CreatorReminderPauseProps {
  creatorId: string;
  creatorName: string;
  pauseStatus: PauseStatus;
  onPause: (creatorId: string, options: { reason?: string; resumeAt?: Date }) => Promise<void>;
  onResume: (creatorId: string) => Promise<void>;
  className?: string;
  compact?: boolean;
}

// Quick pause options
const PAUSE_PRESETS = [
  { label: "1 day", days: 1 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
  { label: "Custom...", days: -1 },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function CreatorReminderPause({
  creatorId,
  creatorName,
  pauseStatus,
  onPause,
  onResume,
  className,
  compact = false,
}: CreatorReminderPauseProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPauseDialog, setShowPauseDialog] = React.useState(false);
  const [pauseReason, setPauseReason] = React.useState("");
  const [selectedPreset, setSelectedPreset] = React.useState<string>("");
  const [customDate, setCustomDate] = React.useState<Date | undefined>();

  const handlePause = async () => {
    setIsLoading(true);
    try {
      let resumeAt: Date | undefined;

      if (selectedPreset === "custom") {
        resumeAt = customDate;
      } else if (selectedPreset && selectedPreset !== "indefinite") {
        const days = parseInt(selectedPreset);
        if (!isNaN(days)) {
          resumeAt = addDays(new Date(), days);
        }
      }

      await onPause(creatorId, {
        reason: pauseReason || undefined,
        resumeAt,
      });

      toast.success(
        resumeAt
          ? `Reminders paused for ${creatorName} until ${format(resumeAt, "MMM d, yyyy")}`
          : `Reminders paused for ${creatorName} indefinitely`
      );

      setShowPauseDialog(false);
      setPauseReason("");
      setSelectedPreset("");
      setCustomDate(undefined);
    } catch (error) {
      console.error("Error pausing reminders:", error);
      toast.error("Failed to pause reminders");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    setIsLoading(true);
    try {
      await onResume(creatorId);
      toast.success(`Reminders resumed for ${creatorName}`);
    } catch (error) {
      console.error("Error resuming reminders:", error);
      toast.error("Failed to resume reminders");
    } finally {
      setIsLoading(false);
    }
  };

  // Compact badge view
  if (compact) {
    return (
      <div className={cn("inline-flex items-center gap-2", className)}>
        {pauseStatus.isPaused ? (
          <>
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700"
            >
              <Pause className="h-3 w-3 mr-1" />
              Paused
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResume}
              disabled={isLoading}
              className="h-7 text-xs"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3 mr-1" />
              )}
              Resume
            </Button>
          </>
        ) : (
          <Popover open={showPauseDialog} onOpenChange={setShowPauseDialog}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                <Pause className="h-3 w-3 mr-1" />
                Pause
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <PauseDialogContent
                creatorName={creatorName}
                pauseReason={pauseReason}
                setPauseReason={setPauseReason}
                selectedPreset={selectedPreset}
                setSelectedPreset={setSelectedPreset}
                customDate={customDate}
                setCustomDate={setCustomDate}
                onPause={handlePause}
                onCancel={() => setShowPauseDialog(false)}
                isLoading={isLoading}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  }

  // Full card view
  return (
    <Card className={cn("card-elevated", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center",
                pauseStatus.isPaused
                  ? "bg-amber-100 dark:bg-amber-900/20"
                  : "bg-green-100 dark:bg-green-900/20"
              )}
            >
              {pauseStatus.isPaused ? (
                <Pause className="h-5 w-5 text-amber-500" />
              ) : (
                <Play className="h-5 w-5 text-green-500" />
              )}
            </div>
            <div>
              <CardTitle className="text-base">Reminder Status</CardTitle>
              <CardDescription>
                {pauseStatus.isPaused ? "Reminders are paused" : "Reminders are active"}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={pauseStatus.isPaused ? "outline" : "default"}
            className={cn(
              pauseStatus.isPaused
                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700"
                : "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700"
            )}
          >
            {pauseStatus.isPaused ? "Paused" : "Active"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {pauseStatus.isPaused && (
          <div className="space-y-2 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-700/30">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-muted-foreground">Paused since:</span>
              <span className="font-medium">
                {pauseStatus.pausedAt
                  ? format(new Date(pauseStatus.pausedAt), "MMM d, yyyy 'at' h:mm a")
                  : "Unknown"}
              </span>
            </div>
            {pauseStatus.pauseResumeAt && (
              <div className="flex items-center gap-2 text-sm">
                <CalendarIcon className="h-4 w-4 text-amber-500" />
                <span className="text-muted-foreground">Auto-resumes:</span>
                <span className="font-medium">
                  {format(new Date(pauseStatus.pauseResumeAt), "MMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
            )}
            {pauseStatus.pauseReason && (
              <div className="flex items-start gap-2 text-sm pt-1">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                <div>
                  <span className="text-muted-foreground">Reason:</span>
                  <p className="text-foreground">{pauseStatus.pauseReason}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {pauseStatus.isPaused ? (
            <Button
              onClick={handleResume}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Resume Reminders
            </Button>
          ) : (
            <Popover open={showPauseDialog} onOpenChange={setShowPauseDialog}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1">
                  <Pause className="h-4 w-4 mr-2" />
                  Pause Reminders
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="start">
                <PauseDialogContent
                  creatorName={creatorName}
                  pauseReason={pauseReason}
                  setPauseReason={setPauseReason}
                  selectedPreset={selectedPreset}
                  setSelectedPreset={setSelectedPreset}
                  customDate={customDate}
                  setCustomDate={setCustomDate}
                  onPause={handlePause}
                  onCancel={() => setShowPauseDialog(false)}
                  isLoading={isLoading}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// PAUSE DIALOG CONTENT
// ============================================

function PauseDialogContent({
  creatorName,
  pauseReason,
  setPauseReason,
  selectedPreset,
  setSelectedPreset,
  customDate,
  setCustomDate,
  onPause,
  onCancel,
  isLoading,
}: {
  creatorName: string;
  pauseReason: string;
  setPauseReason: (reason: string) => void;
  selectedPreset: string;
  setSelectedPreset: (preset: string) => void;
  customDate: Date | undefined;
  setCustomDate: (date: Date | undefined) => void;
  onPause: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [showCalendar, setShowCalendar] = React.useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium">Pause Reminders</h4>
        <p className="text-sm text-muted-foreground">
          for {creatorName}
        </p>
      </div>

      <div className="space-y-2">
        <Label>Duration</Label>
        <Select
          value={selectedPreset}
          onValueChange={(value) => {
            setSelectedPreset(value);
            if (value === "custom") {
              setShowCalendar(true);
            } else {
              setShowCalendar(false);
              setCustomDate(undefined);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select duration..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="indefinite">Until manually resumed</SelectItem>
            {PAUSE_PRESETS.map((preset) => (
              <SelectItem
                key={preset.days}
                value={preset.days === -1 ? "custom" : String(preset.days)}
              >
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showCalendar && (
        <div className="space-y-2">
          <Label>Resume Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !customDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {customDate
                  ? format(customDate, "MMM d, yyyy")
                  : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                selected={customDate}
                onSelect={setCustomDate}
                disabled={(date) => date < new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      <div className="space-y-2">
        <Label>Reason (optional)</Label>
        <Textarea
          placeholder="e.g., Creator on vacation, busy with other project..."
          value={pauseReason}
          onChange={(e) => setPauseReason(e.target.value)}
          rows={2}
        />
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1"
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          onClick={onPause}
          className="flex-1"
          disabled={isLoading || (!selectedPreset && !customDate)}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Pause
        </Button>
      </div>
    </div>
  );
}

export default CreatorReminderPause;
