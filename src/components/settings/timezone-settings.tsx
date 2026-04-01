"use client";

import * as React from "react";
import {
  Globe,
  Clock,
  Calendar,
  Sun,
  Moon,
  MapPin,
  Building2,
  Settings2,
  RefreshCw,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TimezonePreferences,
  BusinessHours,
  DEFAULT_TIMEZONE_PREFERENCES,
  DEFAULT_BUSINESS_HOURS,
  DATE_FORMAT_OPTIONS,
  DateFormatOption,
} from "@/types/timezone";
import {
  TimezoneSelector,
  TimezoneBadge,
} from "@/components/settings/timezone-selector";
import {
  useTimezone,
  useCurrentTime,
  useIsBusinessHours,
} from "@/components/providers/timezone-provider";
import {
  detectLocalTimezone,
  formatDate,
  formatTime,
  getTimezoneEntry,
  getTimezoneOffsetString,
} from "@/lib/timezone-utils";

// ============================================
// TYPES
// ============================================

interface TimezoneSettingsProps {
  onSave?: (preferences: TimezonePreferences) => Promise<void>;
  showBusinessHours?: boolean;
  className?: string;
}

interface TimezonePreviewProps {
  timezone: string;
  use24HourFormat: boolean;
  dateFormat: DateFormatOption;
}

// ============================================
// TIMEZONE PREVIEW COMPONENT
// ============================================

function TimezonePreview({ timezone, use24HourFormat, dateFormat }: TimezonePreviewProps) {
  const [currentTime, setCurrentTime] = React.useState<string>("");
  const [currentDate, setCurrentDate] = React.useState<string>("");
  const tzEntry = React.useMemo(() => getTimezoneEntry(timezone), [timezone]);

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(formatTime(now, timezone, { hour12: !use24HourFormat }));
      setCurrentDate(formatDate(now, timezone, dateFormat));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [timezone, use24HourFormat, dateFormat]);

  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-violet-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Live Preview</span>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Globe className="h-3 w-3" />
          {tzEntry.abbreviation}
        </Badge>
      </div>

      <div className="text-center py-4">
        <p className="text-4xl font-bold tracking-tight">{currentTime}</p>
        <p className="text-lg text-muted-foreground mt-1">{currentDate}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {tzEntry.city} ({getTimezoneOffsetString(timezone)})
        </p>
      </div>
    </div>
  );
}

// ============================================
// BUSINESS HOURS EDITOR COMPONENT
// ============================================

function BusinessHoursEditor({
  value,
  onChange,
}: {
  value: BusinessHours;
  onChange: (hours: BusinessHours) => void;
}) {
  const daysOfWeek = [
    { value: 0, label: "Sun" },
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
  ];

  const timeOptions = React.useMemo(() => {
    const options: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        options.push(
          `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
        );
      }
    }
    return options;
  }, []);

  const toggleDay = (day: number) => {
    const newDays = value.workDays.includes(day)
      ? value.workDays.filter((d) => d !== day)
      : [...value.workDays, day].sort((a, b) => a - b);
    onChange({ ...value, workDays: newDays });
  };

  return (
    <div className="space-y-4">
      {/* Work Days */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Work Days</Label>
        <div className="flex gap-1">
          {daysOfWeek.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              className={cn(
                "h-10 w-10 rounded-lg text-sm font-medium transition-colors",
                value.workDays.includes(day.value)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      {/* Work Hours */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Start Time</Label>
          <Select
            value={value.start}
            onValueChange={(start) => onChange({ ...value, start })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">End Time</Label>
          <Select
            value={value.end}
            onValueChange={(end) => onChange({ ...value, end })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN TIMEZONE SETTINGS COMPONENT
// ============================================

export function TimezoneSettings({
  onSave,
  showBusinessHours = true,
  className,
}: TimezoneSettingsProps) {
  const { timezone, preferences, businessHours, updatePreferences, updateBusinessHours } =
    useTimezone();
  const currentTime = useCurrentTime();
  const isBusinessHours = useIsBusinessHours();

  const [localPreferences, setLocalPreferences] =
    React.useState<TimezonePreferences>(preferences);
  const [localBusinessHours, setLocalBusinessHours] =
    React.useState<BusinessHours>(businessHours);
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Track changes
  React.useEffect(() => {
    const prefsChanged =
      JSON.stringify(localPreferences) !== JSON.stringify(preferences);
    const hoursChanged =
      JSON.stringify(localBusinessHours) !== JSON.stringify(businessHours);
    setHasChanges(prefsChanged || hoursChanged);
  }, [localPreferences, localBusinessHours, preferences, businessHours]);

  // Handle auto-detect
  const handleAutoDetect = () => {
    const detected = detectLocalTimezone();
    setLocalPreferences((prev) => ({
      ...prev,
      timezone: detected,
      autoDetect: true,
    }));
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePreferences(localPreferences);
      if (showBusinessHours) {
        await updateBusinessHours(localBusinessHours);
      }
      if (onSave) {
        await onSave(localPreferences);
      }
      toast.success("Timezone settings saved");
    } catch (error) {
      console.error("Error saving timezone settings:", error);
      toast.error("Failed to save timezone settings");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle reset
  const handleReset = () => {
    setLocalPreferences(DEFAULT_TIMEZONE_PREFERENCES);
    setLocalBusinessHours(DEFAULT_BUSINESS_HOURS);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Timezone Selection Card */}
      <Card className="card-elevated">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Timezone</CardTitle>
              <CardDescription>
                Set your timezone for accurate date and time display
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Timezone Selector */}
          <TimezoneSelector
            value={localPreferences.timezone}
            onChange={(tz) =>
              setLocalPreferences((prev) => ({
                ...prev,
                timezone: tz,
                autoDetect: false,
              }))
            }
            showAutoDetect
            showCurrentTime
            label="Your Timezone"
            description="All dates and times will be displayed in this timezone"
          />

          {/* Auto-detect Option */}
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <p className="font-medium">Auto-detect timezone</p>
                <p className="text-sm text-muted-foreground">
                  Automatically use your browser's timezone
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="autoDetect"
                checked={localPreferences.autoDetect}
                onCheckedChange={(checked) => {
                  setLocalPreferences((prev) => ({
                    ...prev,
                    autoDetect: checked === true,
                  }));
                  if (checked) {
                    handleAutoDetect();
                  }
                }}
              />
            </div>
          </div>

          {/* Live Preview */}
          <TimezonePreview
            timezone={localPreferences.timezone}
            use24HourFormat={localPreferences.use24HourFormat}
            dateFormat={localPreferences.dateFormat}
          />
        </CardContent>
      </Card>

      {/* Date & Time Format Card */}
      <Card className="card-elevated">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <CardTitle>Date & Time Format</CardTitle>
              <CardDescription>
                Choose how dates and times are displayed
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Format */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Date Format</Label>
            <Select
              value={localPreferences.dateFormat}
              onValueChange={(value: DateFormatOption) =>
                setLocalPreferences((prev) => ({ ...prev, dateFormat: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-3">
                      <span>{option.label}</span>
                      <span className="text-muted-foreground">
                        ({option.example})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time Format */}
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="font-medium">24-hour format</p>
                <p className="text-sm text-muted-foreground">
                  Display time in 24-hour format (e.g., 14:30 instead of 2:30 PM)
                </p>
              </div>
            </div>
            <Checkbox
              id="use24Hour"
              checked={localPreferences.use24HourFormat}
              onCheckedChange={(checked) =>
                setLocalPreferences((prev) => ({
                  ...prev,
                  use24HourFormat: checked === true,
                }))
              }
            />
          </div>

          {/* Show Timezone Abbreviation */}
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Globe className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="font-medium">Show timezone abbreviation</p>
                <p className="text-sm text-muted-foreground">
                  Include timezone abbreviation (e.g., EST, PST) with times
                </p>
              </div>
            </div>
            <Checkbox
              id="showTzAbbr"
              checked={localPreferences.showTimezoneAbbreviation}
              onCheckedChange={(checked) =>
                setLocalPreferences((prev) => ({
                  ...prev,
                  showTimezoneAbbreviation: checked === true,
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Business Hours Card */}
      {showBusinessHours && (
        <Card className="card-elevated">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle>Business Hours</CardTitle>
                  {isBusinessHours ? (
                    <Badge
                      variant="outline"
                      className="text-emerald-600 border-emerald-600/30"
                    >
                      <Sun className="h-3 w-3 mr-1" />
                      Open
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-muted-foreground"
                    >
                      <Moon className="h-3 w-3 mr-1" />
                      Closed
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  Configure your working hours for scheduling and reminders
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <BusinessHoursEditor
              value={localBusinessHours}
              onChange={setLocalBusinessHours}
            />
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between sticky bottom-4 p-4 bg-background/80 backdrop-blur-sm border rounded-xl shadow-lg">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isSaving}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {hasChanges ? "Unsaved changes" : "All changes saved"}
          </p>
          <Button
            type="button"
            disabled={!hasChanges || isSaving}
            onClick={handleSave}
            className={hasChanges ? "btn-gradient" : ""}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPACT TIMEZONE SETTINGS (for Profile page)
// ============================================

export function CompactTimezoneSettings({
  timezone,
  onTimezoneChange,
  className,
}: {
  timezone: string;
  onTimezoneChange: (timezone: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <TimezoneSelector
        value={timezone}
        onChange={onTimezoneChange}
        showAutoDetect
        showCurrentTime
      />
    </div>
  );
}

export default TimezoneSettings;
