"use client";

import * as React from "react";
import { format, isValid, parse, setHours, setMinutes } from "date-fns";
import { Calendar as CalendarIcon, Clock, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  getDeadlinePresets,
  getDeadlineInfo,
  type Priority,
} from "@/lib/deadline-utils";

interface DeadlinePickerProps {
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  priority?: Priority;
  disabled?: boolean;
  placeholder?: string;
  showPresets?: boolean;
  showTimePicker?: boolean;
  minDate?: Date;
  className?: string;
}

/**
 * Deadline picker with calendar, time picker, and quick presets
 */
export function DeadlinePicker({
  value,
  onChange,
  priority = "NORMAL",
  disabled = false,
  placeholder = "Select deadline",
  showPresets = true,
  showTimePicker = true,
  minDate,
  className,
}: DeadlinePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    value ? new Date(value) : undefined
  );
  const [timeValue, setTimeValue] = React.useState<string>(
    value ? format(new Date(value), "HH:mm") : "17:00"
  );

  const presets = React.useMemo(() => getDeadlinePresets(), []);

  // Update local state when value changes externally
  React.useEffect(() => {
    if (value) {
      const date = new Date(value);
      setSelectedDate(date);
      setTimeValue(format(date, "HH:mm"));
    } else {
      setSelectedDate(undefined);
      setTimeValue("17:00");
    }
  }, [value]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      setSelectedDate(undefined);
      return;
    }

    // Apply current time to the selected date
    const [hours, minutes] = timeValue.split(":").map(Number);
    const dateWithTime = setMinutes(setHours(date, hours || 17), minutes || 0);
    setSelectedDate(dateWithTime);
    onChange?.(dateWithTime);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTimeValue(newTime);

    if (selectedDate && newTime) {
      const [hours, minutes] = newTime.split(":").map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        const dateWithTime = setMinutes(setHours(selectedDate, hours), minutes);
        setSelectedDate(dateWithTime);
        onChange?.(dateWithTime);
      }
    }
  };

  const handlePresetClick = (presetDate: Date) => {
    // Apply current time to preset
    const [hours, minutes] = timeValue.split(":").map(Number);
    const dateWithTime = setMinutes(setHours(presetDate, hours || 17), minutes || 0);
    setSelectedDate(dateWithTime);
    onChange?.(dateWithTime);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDate(undefined);
    onChange?.(null);
  };

  const deadlineInfo = selectedDate
    ? getDeadlineInfo(selectedDate, priority)
    : null;

  const displayText = React.useMemo(() => {
    if (!selectedDate) return placeholder;
    return format(selectedDate, "MMM d, yyyy 'at' h:mm a");
  }, [selectedDate, placeholder]);

  const relativeText = deadlineInfo?.relativeText;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !selectedDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className="flex-1 truncate">{displayText}</span>
          {relativeText && (
            <span className="ml-2 text-xs text-muted-foreground">
              ({relativeText})
            </span>
          )}
          {selectedDate && !disabled && (
            <X
              className="ml-2 h-4 w-4 opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          {/* Quick Presets */}
          {showPresets && (
            <div className="border-b sm:border-b-0 sm:border-r p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                <Zap className="h-3 w-3" />
                Quick Select
              </div>
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-left h-auto py-2"
                  onClick={() => handlePresetClick(preset.value)}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{preset.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {preset.description}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          )}

          {/* Calendar and Time Picker */}
          <div className="p-0">
            <Calendar
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) => {
                if (minDate && date < minDate) return true;
                return false;
              }}
              initialFocus
            />

            {/* Time Picker */}
            {showTimePicker && (
              <div className="border-t p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="time" className="text-sm font-medium">
                    Time
                  </Label>
                  <Input
                    id="time"
                    type="time"
                    value={timeValue}
                    onChange={handleTimeChange}
                    className="w-auto"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer with selected info */}
        {selectedDate && (
          <div className="border-t p-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">Selected: </span>
                <span>{format(selectedDate, "EEEE, MMMM d, yyyy 'at' h:mm a")}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface DeadlineQuickPickerProps {
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  className?: string;
}

/**
 * Compact deadline picker with only quick presets
 */
export function DeadlineQuickPicker({
  value,
  onChange,
  className,
}: DeadlineQuickPickerProps) {
  const presets = React.useMemo(() => getDeadlinePresets(), []);

  const handlePresetClick = (presetDate: Date) => {
    // Default to 5 PM for quick picker
    const dateWithTime = setMinutes(setHours(presetDate, 17), 0);
    onChange?.(dateWithTime);
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {presets.slice(0, 3).map((preset) => (
        <Button
          key={preset.label}
          variant="outline"
          size="sm"
          onClick={() => handlePresetClick(preset.value)}
          className="h-8"
        >
          {preset.label}
        </Button>
      ))}
      {value && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange?.(null)}
          className="h-8 text-muted-foreground"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}

interface RelativeDateDisplayProps {
  date: Date | string | null;
  priority?: Priority;
  showAbsolute?: boolean;
  className?: string;
}

/**
 * Display a date with relative formatting
 */
export function RelativeDateDisplay({
  date,
  priority = "NORMAL",
  showAbsolute = true,
  className,
}: RelativeDateDisplayProps) {
  const deadlineInfo = date ? getDeadlineInfo(date, priority) : null;

  if (!deadlineInfo) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        No deadline set
      </span>
    );
  }

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div
        className={cn(
          "flex items-center gap-1.5 text-sm font-medium",
          deadlineInfo.isOverdue
            ? "text-red-600 dark:text-red-400"
            : deadlineInfo.isDueSoon
            ? "text-amber-600 dark:text-amber-400"
            : "text-foreground"
        )}
      >
        <Clock className="h-3.5 w-3.5" />
        <span>{deadlineInfo.relativeText}</span>
        {deadlineInfo.isOverdue && (
          <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded">
            Overdue
          </span>
        )}
      </div>
      {showAbsolute && (
        <span className="text-xs text-muted-foreground">
          {deadlineInfo.displayText}
        </span>
      )}
    </div>
  );
}

interface DateTimeInputProps {
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Simple date and time input fields
 */
export function DateTimeInput({
  value,
  onChange,
  label,
  disabled = false,
  className,
}: DateTimeInputProps) {
  const [dateStr, setDateStr] = React.useState(
    value ? format(new Date(value), "yyyy-MM-dd") : ""
  );
  const [timeStr, setTimeStr] = React.useState(
    value ? format(new Date(value), "HH:mm") : "17:00"
  );

  React.useEffect(() => {
    if (value) {
      const date = new Date(value);
      setDateStr(format(date, "yyyy-MM-dd"));
      setTimeStr(format(date, "HH:mm"));
    } else {
      setDateStr("");
      setTimeStr("17:00");
    }
  }, [value]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setDateStr(newDate);

    if (newDate) {
      const parsed = parse(newDate, "yyyy-MM-dd", new Date());
      if (isValid(parsed)) {
        const [hours, minutes] = timeStr.split(":").map(Number);
        const dateWithTime = setMinutes(setHours(parsed, hours || 17), minutes || 0);
        onChange?.(dateWithTime);
      }
    } else {
      onChange?.(null);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTimeStr(newTime);

    if (dateStr && newTime) {
      const parsed = parse(dateStr, "yyyy-MM-dd", new Date());
      if (isValid(parsed)) {
        const [hours, minutes] = newTime.split(":").map(Number);
        const dateWithTime = setMinutes(setHours(parsed, hours), minutes);
        onChange?.(dateWithTime);
      }
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-sm font-medium">{label}</Label>
      )}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="date"
            value={dateStr}
            onChange={handleDateChange}
            disabled={disabled}
            className="w-full"
          />
        </div>
        <div className="w-28">
          <Input
            type="time"
            value={timeStr}
            onChange={handleTimeChange}
            disabled={disabled || !dateStr}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
