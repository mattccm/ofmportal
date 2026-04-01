"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import {
  Mail,
  MessageSquare,
  MessageCircle,
  Send,
  Hash,
  Bell,
  Phone,
  Plus,
  Trash2,
  CalendarIcon,
  Clock,
  Globe,
  Languages,
  Save,
  Loader2,
  Check,
  Info,
} from "lucide-react";
import {
  type CommunicationPreferences,
  type ContactMethod,
  type DayOfWeek,
  type QuietPeriod,
  type ResponseExpectation,
  CONTACT_METHODS,
  RESPONSE_EXPECTATIONS,
  DAYS_OF_WEEK,
  COMMON_LANGUAGES,
  DEFAULT_COMMUNICATION_PREFERENCES,
} from "@/types/communication-preferences";
import { COMMON_TIMEZONES } from "@/types/timezone";
import {
  detectLocalTimezone,
  getCurrentTimeInTimezone,
  formatTime,
  getTimezoneAbbreviation,
  getAllTimezones,
} from "@/lib/timezone-utils";

// ============================================
// ICON MAP
// ============================================

const ICON_MAP: Record<string, React.ReactNode> = {
  Mail: <Mail className="h-4 w-4" />,
  MessageSquare: <MessageSquare className="h-4 w-4" />,
  MessageCircle: <MessageCircle className="h-4 w-4" />,
  Send: <Send className="h-4 w-4" />,
  Hash: <Hash className="h-4 w-4" />,
  Bell: <Bell className="h-4 w-4" />,
  Phone: <Phone className="h-4 w-4" />,
};

// ============================================
// TYPES
// ============================================

interface CommunicationPreferencesFormProps {
  creatorId: string;
  initialPreferences?: CommunicationPreferences;
  onSave?: (preferences: CommunicationPreferences) => void;
  onCancel?: () => void;
  compact?: boolean;
}

interface QuietPeriodFormData {
  startDate: Date | undefined;
  endDate: Date | undefined;
  reason: string;
  autoReply: string;
}

// ============================================
// COMPONENT
// ============================================

export function CommunicationPreferencesForm({
  creatorId,
  initialPreferences,
  onSave,
  onCancel,
  compact = false,
}: CommunicationPreferencesFormProps) {
  // State
  const [preferences, setPreferences] = useState<CommunicationPreferences>(
    initialPreferences || DEFAULT_COMMUNICATION_PREFERENCES
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [currentTimezoneTime, setCurrentTimezoneTime] = useState<string>("");
  const [showQuietPeriodDialog, setShowQuietPeriodDialog] = useState(false);
  const [quietPeriodForm, setQuietPeriodForm] = useState<QuietPeriodFormData>({
    startDate: undefined,
    endDate: undefined,
    reason: "",
    autoReply: "",
  });
  const [timezoneSearch, setTimezoneSearch] = useState("");
  const [languageSearch, setLanguageSearch] = useState("");
  const [availableTimezones, setAvailableTimezones] = useState<{ id: string; label: string }[]>([]);

  // Load timezones on mount
  useEffect(() => {
    try {
      const timezones = getAllTimezones();
      setAvailableTimezones(
        timezones.map((tz) => ({
          id: tz.id,
          label: `${tz.city || tz.id} (${tz.abbreviation || tz.offset})`,
        }))
      );
    } catch {
      // Fallback to common timezones
      setAvailableTimezones(
        COMMON_TIMEZONES.map((tz) => ({
          id: tz,
          label: tz.replace(/_/g, " "),
        }))
      );
    }
  }, []);

  // Update current time in selected timezone
  useEffect(() => {
    const updateTime = () => {
      try {
        const time = getCurrentTimeInTimezone(preferences.timezone);
        setCurrentTimezoneTime(format(time, "h:mm a"));
      } catch {
        setCurrentTimezoneTime("");
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [preferences.timezone]);

  // Track changes
  useEffect(() => {
    if (initialPreferences) {
      const hasChanged = JSON.stringify(preferences) !== JSON.stringify(initialPreferences);
      setHasChanges(hasChanged);
    } else {
      setHasChanges(true);
    }
  }, [preferences, initialPreferences]);

  // Handlers
  const updatePreferences = useCallback(
    <K extends keyof CommunicationPreferences>(key: K, value: CommunicationPreferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateContactDetails = useCallback(
    (key: keyof typeof preferences.contactDetails, value: string) => {
      setPreferences((prev) => ({
        ...prev,
        contactDetails: { ...prev.contactDetails, [key]: value },
      }));
    },
    []
  );

  const toggleDay = useCallback((day: DayOfWeek) => {
    setPreferences((prev) => {
      const days = prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day];
      return { ...prev, availableDays: days };
    });
  }, []);

  const addQuietPeriod = useCallback(() => {
    if (!quietPeriodForm.startDate || !quietPeriodForm.endDate) {
      toast.error("Please select both start and end dates");
      return;
    }

    const newPeriod: QuietPeriod = {
      id: `qp-${Date.now()}`,
      startDate: quietPeriodForm.startDate,
      endDate: quietPeriodForm.endDate,
      reason: quietPeriodForm.reason || undefined,
      autoReply: quietPeriodForm.autoReply || undefined,
    };

    setPreferences((prev) => ({
      ...prev,
      quietPeriods: [...prev.quietPeriods, newPeriod],
    }));

    setQuietPeriodForm({
      startDate: undefined,
      endDate: undefined,
      reason: "",
      autoReply: "",
    });
    setShowQuietPeriodDialog(false);
    toast.success("Quiet period added");
  }, [quietPeriodForm]);

  const removeQuietPeriod = useCallback((id: string) => {
    setPreferences((prev) => ({
      ...prev,
      quietPeriods: prev.quietPeriods.filter((p) => p.id !== id),
    }));
  }, []);

  const addSecondaryLanguage = useCallback((language: string) => {
    if (!preferences.secondaryLanguages?.includes(language)) {
      setPreferences((prev) => ({
        ...prev,
        secondaryLanguages: [...(prev.secondaryLanguages || []), language],
      }));
    }
    setLanguageSearch("");
  }, [preferences.secondaryLanguages]);

  const removeSecondaryLanguage = useCallback((language: string) => {
    setPreferences((prev) => ({
      ...prev,
      secondaryLanguages: prev.secondaryLanguages?.filter((l) => l !== language),
    }));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/creators/${creatorId}/communication-preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        throw new Error("Failed to save preferences");
      }

      toast.success("Communication preferences saved");
      onSave?.(preferences);
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  const detectTimezone = useCallback(() => {
    const detected = detectLocalTimezone();
    updatePreferences("timezone", detected);
    toast.success(`Timezone set to ${detected}`);
  }, [updatePreferences]);

  // Filtered options
  const filteredTimezones = availableTimezones.filter((tz) =>
    tz.label.toLowerCase().includes(timezoneSearch.toLowerCase())
  );

  const filteredLanguages = COMMON_LANGUAGES.filter((lang) =>
    lang.toLowerCase().includes(languageSearch.toLowerCase())
  );

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={cn("space-y-6", compact && "space-y-4")}>
      {/* Contact Method Selection */}
      <Card>
        <CardHeader className={compact ? "pb-3" : undefined}>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Preferred Contact Methods
          </CardTitle>
          <CardDescription>
            Select how you prefer to be contacted for content requests and updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Primary Method */}
          <div className="space-y-2">
            <Label>Primary Contact Method</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CONTACT_METHODS.map((method) => (
                <button
                  key={method.key}
                  type="button"
                  onClick={() => updatePreferences("primaryMethod", method.key)}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border-2 transition-all",
                    preferences.primaryMethod === method.key
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className={cn("p-1.5 rounded-md", method.bgColor)}>
                    <span className={method.color}>{ICON_MAP[method.icon]}</span>
                  </div>
                  <span className="text-sm font-medium">{method.label}</span>
                  {preferences.primaryMethod === method.key && (
                    <Check className="h-4 w-4 text-primary ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Method */}
          <div className="space-y-2">
            <Label>Secondary Contact Method (Optional)</Label>
            <Select
              value={preferences.secondaryMethod || "none"}
              onValueChange={(value) =>
                updatePreferences("secondaryMethod", value === "none" ? undefined : (value as ContactMethod))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select secondary method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {CONTACT_METHODS.filter((m) => m.key !== preferences.primaryMethod).map((method) => (
                  <SelectItem key={method.key} value={method.key}>
                    <span className="flex items-center gap-2">
                      <span className={method.color}>{ICON_MAP[method.icon]}</span>
                      {method.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contact Details */}
          <div className="space-y-3 pt-2 border-t">
            <Label>Contact Details</Label>
            <div className="grid sm:grid-cols-2 gap-3">
              {/* Email */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </div>
                <Input
                  type="email"
                  placeholder="creator@example.com"
                  value={preferences.contactDetails.email || ""}
                  onChange={(e) => updateContactDetails("email", e.target.value)}
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  Phone / SMS
                </div>
                <Input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={preferences.contactDetails.phone || ""}
                  onChange={(e) => updateContactDetails("phone", e.target.value)}
                />
              </div>

              {/* WhatsApp */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </div>
                <Input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={preferences.contactDetails.whatsapp || ""}
                  onChange={(e) => updateContactDetails("whatsapp", e.target.value)}
                />
              </div>

              {/* Telegram */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Send className="h-3.5 w-3.5" />
                  Telegram
                </div>
                <Input
                  placeholder="@username"
                  value={preferences.contactDetails.telegram || ""}
                  onChange={(e) => updateContactDetails("telegram", e.target.value)}
                />
              </div>

              {/* Discord */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Hash className="h-3.5 w-3.5" />
                  Discord
                </div>
                <Input
                  placeholder="username#1234"
                  value={preferences.contactDetails.discord || ""}
                  onChange={(e) => updateContactDetails("discord", e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Availability */}
      <Card>
        <CardHeader className={compact ? "pb-3" : undefined}>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Availability & Timezone
          </CardTitle>
          <CardDescription>Set your working hours and available days</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Timezone */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Timezone</Label>
              <Button variant="ghost" size="sm" onClick={detectTimezone} className="text-xs">
                <Globe className="h-3 w-3 mr-1" />
                Detect
              </Button>
            </div>
            <div className="flex gap-2">
              <Select
                value={preferences.timezone}
                onValueChange={(value) => updatePreferences("timezone", value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-2">
                    <Input
                      placeholder="Search timezones..."
                      value={timezoneSearch}
                      onChange={(e) => setTimezoneSearch(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  {filteredTimezones.slice(0, 50).map((tz) => (
                    <SelectItem key={tz.id} value={tz.id}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {currentTimezoneTime && (
              <p className="text-sm text-muted-foreground">
                Current time: <span className="font-medium">{currentTimezoneTime}</span>{" "}
                ({getTimezoneAbbreviation(preferences.timezone)})
              </p>
            )}
          </div>

          {/* Working Hours */}
          <div className="space-y-2">
            <Label>Preferred Working Hours</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input
                  type="time"
                  value={preferences.preferredHours.start}
                  onChange={(e) =>
                    updatePreferences("preferredHours", {
                      ...preferences.preferredHours,
                      start: e.target.value,
                    })
                  }
                />
              </div>
              <span className="text-muted-foreground">to</span>
              <div className="flex-1">
                <Input
                  type="time"
                  value={preferences.preferredHours.end}
                  onChange={(e) =>
                    updatePreferences("preferredHours", {
                      ...preferences.preferredHours,
                      end: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* Available Days */}
          <div className="space-y-2">
            <Label>Available Days</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => toggleDay(day.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                    preferences.availableDays.includes(day.key)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {day.shortLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Response Time */}
          <div className="space-y-2">
            <Label>Expected Response Time</Label>
            <Select
              value={preferences.expectedResponseTime}
              onValueChange={(value) => updatePreferences("expectedResponseTime", value as ResponseExpectation)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESPONSE_EXPECTATIONS.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    <span className="flex flex-col">
                      <span className={cn("font-medium", option.color)}>{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quiet Periods */}
      <Card>
        <CardHeader className={compact ? "pb-3" : undefined}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                Quiet Periods
              </CardTitle>
              <CardDescription>
                Mark times when you are unavailable (vacations, breaks, etc.)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQuietPeriodDialog(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Period
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {preferences.quietPeriods.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No quiet periods scheduled
            </p>
          ) : (
            <div className="space-y-2">
              {preferences.quietPeriods.map((period) => (
                <div
                  key={period.id}
                  className="flex items-start justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {format(new Date(period.startDate), "MMM d, yyyy")} -{" "}
                      {format(new Date(period.endDate), "MMM d, yyyy")}
                    </div>
                    {period.reason && (
                      <p className="text-sm text-muted-foreground">{period.reason}</p>
                    )}
                    {period.autoReply && (
                      <p className="text-xs text-muted-foreground italic">
                        Auto-reply: "{period.autoReply}"
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeQuietPeriod(period.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Language Preferences */}
      <Card>
        <CardHeader className={compact ? "pb-3" : undefined}>
          <CardTitle className="text-base flex items-center gap-2">
            <Languages className="h-4 w-4 text-primary" />
            Language Preferences
          </CardTitle>
          <CardDescription>
            Set your preferred languages for communication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Primary Language */}
          <div className="space-y-2">
            <Label>Primary Language</Label>
            <Select
              value={preferences.primaryLanguage}
              onValueChange={(value) => updatePreferences("primaryLanguage", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_LANGUAGES.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Secondary Languages */}
          <div className="space-y-2">
            <Label>Additional Languages</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {preferences.secondaryLanguages?.map((lang) => (
                <Badge key={lang} variant="secondary" className="gap-1">
                  {lang}
                  <button
                    type="button"
                    onClick={() => removeSecondaryLanguage(lang)}
                    className="ml-1 hover:text-destructive"
                  >
                    &times;
                  </button>
                </Badge>
              ))}
            </div>
            <Select value="" onValueChange={addSecondaryLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Add a language..." />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 pb-2">
                  <Input
                    placeholder="Search languages..."
                    value={languageSearch}
                    onChange={(e) => setLanguageSearch(e.target.value)}
                    className="h-8"
                  />
                </div>
                {filteredLanguages
                  .filter(
                    (lang) =>
                      lang !== preferences.primaryLanguage &&
                      !preferences.secondaryLanguages?.includes(lang)
                  )
                  .map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader className={compact ? "pb-3" : undefined}>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose which notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {/* New Request */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">New Content Requests</Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when a new request is assigned to you
                </p>
              </div>
              <Switch
                checked={preferences.notifyOnNewRequest}
                onCheckedChange={(checked) => updatePreferences("notifyOnNewRequest", checked)}
              />
            </div>

            {/* Deadline Reminder */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Deadline Reminders</Label>
                <p className="text-xs text-muted-foreground">
                  Receive reminders before deadlines
                </p>
              </div>
              <Switch
                checked={preferences.notifyOnDeadlineReminder}
                onCheckedChange={(checked) => updatePreferences("notifyOnDeadlineReminder", checked)}
              />
            </div>

            {/* Feedback */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Feedback Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when feedback is left on your uploads
                </p>
              </div>
              <Switch
                checked={preferences.notifyOnFeedback}
                onCheckedChange={(checked) => updatePreferences("notifyOnFeedback", checked)}
              />
            </div>

            {/* Approval */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Approval Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when your content is approved or rejected
                </p>
              </div>
              <Switch
                checked={preferences.notifyOnApproval}
                onCheckedChange={(checked) => updatePreferences("notifyOnApproval", checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Communication Notes */}
      <Card>
        <CardHeader className={compact ? "pb-3" : undefined}>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            Additional Notes
          </CardTitle>
          <CardDescription>
            Any special instructions or preferences for communication
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="e.g., 'Prefers voice messages', 'Responds faster on weekends', 'Please use formal language'"
            value={preferences.communicationNotes || ""}
            onChange={(e) => updatePreferences("communicationNotes", e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Preferences
            </>
          )}
        </Button>
      </div>

      {/* Quiet Period Dialog */}
      <Dialog open={showQuietPeriodDialog} onOpenChange={setShowQuietPeriodDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Quiet Period</DialogTitle>
            <DialogDescription>
              Schedule a time when you will be unavailable
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !quietPeriodForm.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {quietPeriodForm.startDate
                        ? format(quietPeriodForm.startDate, "MMM d, yyyy")
                        : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      selected={quietPeriodForm.startDate}
                      onSelect={(date) =>
                        setQuietPeriodForm((prev) => ({ ...prev, startDate: date }))
                      }
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !quietPeriodForm.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {quietPeriodForm.endDate
                        ? format(quietPeriodForm.endDate, "MMM d, yyyy")
                        : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      selected={quietPeriodForm.endDate}
                      onSelect={(date) =>
                        setQuietPeriodForm((prev) => ({ ...prev, endDate: date }))
                      }
                      disabled={(date) =>
                        date < (quietPeriodForm.startDate || new Date())
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Input
                placeholder="e.g., Vacation, Personal time off"
                value={quietPeriodForm.reason}
                onChange={(e) =>
                  setQuietPeriodForm((prev) => ({ ...prev, reason: e.target.value }))
                }
              />
            </div>

            {/* Auto Reply */}
            <div className="space-y-2">
              <Label>Auto-Reply Message (Optional)</Label>
              <Textarea
                placeholder="Message to send automatically during this period"
                value={quietPeriodForm.autoReply}
                onChange={(e) =>
                  setQuietPeriodForm((prev) => ({ ...prev, autoReply: e.target.value }))
                }
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuietPeriodDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addQuietPeriod}>Add Quiet Period</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CommunicationPreferencesForm;
