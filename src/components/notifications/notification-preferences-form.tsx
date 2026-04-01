"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Clock,
  Users,
  Settings,
  Bell,
  Mail,
  Smartphone,
  MonitorSpeaker,
  Save,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Play,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatusBar } from "@/components/forms/autosave-indicator";
import { RecoveryDialog } from "@/components/forms/recovery-dialog";
import { clearFormData } from "@/lib/form-storage";
import { ContextualHelp } from "@/components/help/contextual-help";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  NotificationPreferences,
  NotificationCategory,
  NotificationChannel,
  NotificationFrequency,
  NotificationSound,
  CategorySettings,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_SOUNDS,
  FREQUENCY_OPTIONS,
  CHANNEL_LABELS,
} from "@/types/notification-preferences";

// Icon mapping for categories
const CATEGORY_ICONS: Record<NotificationCategory, React.ElementType> = {
  uploads: Upload,
  requests: FileText,
  reminders: Clock,
  team: Users,
  system: Settings,
};

// Channel icons
const CHANNEL_ICONS: Record<NotificationChannel, React.ElementType> = {
  inApp: Bell,
  email: Mail,
  sms: Smartphone,
  push: MonitorSpeaker,
};

interface NotificationPreferencesFormProps {
  initialPreferences?: NotificationPreferences;
  onSave?: (preferences: NotificationPreferences) => Promise<void>;
  className?: string;
}

const FORM_ID = "notification-preferences-form";

interface NotificationPreviewProps {
  category: NotificationCategory;
  settings: CategorySettings;
}

// Notification preview component
function NotificationPreview({ category, settings }: NotificationPreviewProps) {
  const categoryInfo = NOTIFICATION_CATEGORIES.find((c) => c.key === category);
  const Icon = CATEGORY_ICONS[category];

  const enabledChannels = Object.entries(settings.channels)
    .filter(([, enabled]) => enabled)
    .map(([channel]) => channel as NotificationChannel);

  if (!settings.enabled || enabledChannels.length === 0) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/20">
        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">
            {settings.enabled
              ? "No channels enabled"
              : "Notifications disabled for this category"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Preview
      </p>
      <div
        className={`flex items-start gap-3 p-3 rounded-lg border ${categoryInfo?.iconBg} border-opacity-50`}
      >
        <div
          className={`h-10 w-10 rounded-lg ${categoryInfo?.iconBg} flex items-center justify-center shrink-0`}
        >
          <Icon className={`h-5 w-5 ${categoryInfo?.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium truncate">
              Sample {categoryInfo?.title}
            </p>
            <Badge variant="secondary" className="text-xs">
              {settings.frequency === "instant"
                ? "Now"
                : settings.frequency === "daily"
                ? "Daily"
                : "Weekly"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            This is a preview of how your notifications will appear.
          </p>
          <div className="flex items-center gap-2 mt-2">
            {enabledChannels.map((channel) => {
              const ChannelIcon = CHANNEL_ICONS[channel];
              return (
                <div
                  key={channel}
                  className="flex items-center gap-1 text-xs text-muted-foreground"
                >
                  <ChannelIcon className="h-3 w-3" />
                  <span>{CHANNEL_LABELS[channel]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationPreferencesForm({
  initialPreferences,
  onSave,
  className,
}: NotificationPreferencesFormProps) {
  const [preferences, setPreferences] = React.useState<NotificationPreferences>(
    initialPreferences || DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [originalPreferences, setOriginalPreferences] =
    React.useState<NotificationPreferences>(
      initialPreferences || DEFAULT_NOTIFICATION_PREFERENCES
    );
  const [isSaving, setIsSaving] = React.useState(false);
  const [isTestingSend, setIsTestingSend] = React.useState(false);
  const [expandedCategory, setExpandedCategory] =
    React.useState<NotificationCategory | null>("uploads");
  const [showRecoveryDialog, setShowRecoveryDialog] = React.useState(false);

  // Autosave hook
  const {
    status: autosaveStatus,
    lastSavedAt,
    hasRecoverableData,
    recoverableData,
    clearSaved,
    recover,
    dismissRecovery,
  } = useAutosave({
    formId: FORM_ID,
    data: preferences,
    enabled: true,
    debounceMs: 1500,
  });

  // Show recovery dialog when recoverable data exists
  React.useEffect(() => {
    if (hasRecoverableData && recoverableData) {
      setShowRecoveryDialog(true);
    }
  }, [hasRecoverableData, recoverableData]);

  // Handle recovery restore
  const handleRestore = () => {
    const restored = recover();
    if (restored) {
      setPreferences(restored as NotificationPreferences);
      toast.success("Previous preferences restored");
    }
    setShowRecoveryDialog(false);
  };

  // Handle recovery discard
  const handleDiscard = () => {
    dismissRecovery();
    setShowRecoveryDialog(false);
    toast.info("Discarded saved preferences");
  };

  // Track if there are unsaved changes
  const hasChanges = React.useMemo(() => {
    return JSON.stringify(preferences) !== JSON.stringify(originalPreferences);
  }, [preferences, originalPreferences]);

  // Update a category's enabled status
  const updateCategoryEnabled = (
    category: NotificationCategory,
    enabled: boolean
  ) => {
    setPreferences((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: {
          ...prev.categories[category],
          enabled,
        },
      },
    }));
  };

  // Update a category's channel setting
  const updateCategoryChannel = (
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean
  ) => {
    setPreferences((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: {
          ...prev.categories[category],
          channels: {
            ...prev.categories[category].channels,
            [channel]: enabled,
          },
        },
      },
    }));
  };

  // Update a category's frequency
  const updateCategoryFrequency = (
    category: NotificationCategory,
    frequency: NotificationFrequency
  ) => {
    setPreferences((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: {
          ...prev.categories[category],
          frequency,
        },
      },
    }));
  };

  // Update global settings
  const updateDoNotDisturb = (enabled: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      doNotDisturb: enabled,
    }));
  };

  const updateQuietHours = (
    field: "enabled" | "startTime" | "endTime",
    value: boolean | string
  ) => {
    setPreferences((prev) => ({
      ...prev,
      quietHours: {
        ...prev.quietHours,
        [field]: value,
      },
    }));
  };

  const updateNotificationSound = (sound: NotificationSound) => {
    setPreferences((prev) => ({
      ...prev,
      notificationSound: sound,
    }));
  };

  // Reset to original preferences
  const handleReset = () => {
    setPreferences(originalPreferences);
    toast.info("Preferences reset to last saved state");
  };

  // Save preferences
  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (onSave) {
        await onSave(preferences);
      } else {
        // Default save behavior - call API
        const response = await fetch("/api/notifications/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(preferences),
        });

        if (!response.ok) {
          throw new Error("Failed to save preferences");
        }
      }

      setOriginalPreferences(preferences);
      clearFormData(FORM_ID); // Clear autosaved data on successful submit
      toast.success("Notification preferences saved successfully");
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save notification preferences");
    } finally {
      setIsSaving(false);
    }
  };

  // Test notification
  const handleTestNotification = async () => {
    setIsTestingSend(true);
    try {
      const response = await fetch("/api/notifications/preferences/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });

      if (!response.ok) {
        throw new Error("Failed to send test notification");
      }

      toast.success("Test notification sent! Check your enabled channels.");
    } catch (error) {
      console.error("Error sending test notification:", error);
      toast.error("Failed to send test notification");
    } finally {
      setIsTestingSend(false);
    }
  };

  // Generate time options for quiet hours
  const timeOptions = React.useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const hour = i.toString().padStart(2, "0");
      return { value: `${hour}:00`, label: `${hour}:00` };
    });
  }, []);

  return (
    <div className={className}>
      {/* Recovery Dialog */}
      <RecoveryDialog
        open={showRecoveryDialog}
        onOpenChange={setShowRecoveryDialog}
        formName="Notification Preferences"
        data={recoverableData}
        onRestore={handleRestore}
        onDiscard={handleDiscard}
        fieldLabels={{
          doNotDisturb: "Do Not Disturb",
          quietHours: "Quiet Hours",
          notificationSound: "Notification Sound",
        }}
        excludeFields={["categories", "updatedAt"]}
      />

      {/* Unsaved Changes Indicator */}
      {hasChanges && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              You have unsaved changes
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Save your preferences to apply the changes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isSaving}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-600 hover:to-violet-600"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Do Not Disturb Toggle */}
      <Card className="mb-6 border-2 border-red-200/50 dark:border-red-800/30 bg-gradient-to-br from-red-50/50 to-orange-50/50 dark:from-red-950/20 dark:to-orange-950/20">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-base">Do Not Disturb</CardTitle>
                <CardDescription>
                  Pause all notifications temporarily
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={preferences.doNotDisturb}
              onCheckedChange={updateDoNotDisturb}
            />
          </div>
        </CardHeader>
        {preferences.doNotDisturb && (
          <CardContent className="pt-0">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-100/50 dark:bg-red-900/20">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">
                All notifications are currently paused. You will not receive any
                notifications until you turn this off.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Category-specific Settings */}
      <div className="space-y-4 mb-6">
        <h3 className="text-lg font-semibold">Notification Categories</h3>
        <p className="text-sm text-muted-foreground">
          Configure notification settings for each category. Click a category to
          expand and customize channels and frequency.
        </p>

        {NOTIFICATION_CATEGORIES.map((categoryInfo) => {
          const category = categoryInfo.key;
          const settings = preferences.categories[category];
          const Icon = CATEGORY_ICONS[category];
          const isExpanded = expandedCategory === category;

          return (
            <Card
              key={category}
              className={`transition-all duration-200 ${
                settings.enabled
                  ? "border-primary/20"
                  : "border-muted opacity-75"
              } ${isExpanded ? "ring-2 ring-primary/20" : ""}`}
            >
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() =>
                  setExpandedCategory(isExpanded ? null : category)
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-xl ${categoryInfo.iconBg} flex items-center justify-center`}
                    >
                      <Icon className={`h-5 w-5 ${categoryInfo.iconColor}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">
                          {categoryInfo.title}
                        </CardTitle>
                        {settings.enabled && (
                          <Badge variant="secondary" className="text-xs">
                            {settings.frequency === "instant"
                              ? "Instant"
                              : settings.frequency === "daily"
                              ? "Daily"
                              : "Weekly"}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-sm">
                        {categoryInfo.description}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {settings.enabled && (
                      <div className="hidden md:flex items-center gap-1">
                        {(
                          Object.entries(settings.channels) as [
                            NotificationChannel,
                            boolean
                          ][]
                        ).map(([channel, enabled]) => {
                          const ChannelIcon = CHANNEL_ICONS[channel];
                          return (
                            <div
                              key={channel}
                              className={`h-6 w-6 rounded flex items-center justify-center ${
                                enabled
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }`}
                              title={CHANNEL_LABELS[channel]}
                            >
                              <ChannelIcon className="h-3.5 w-3.5" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <Switch
                      checked={settings.enabled}
                      onCheckedChange={(checked) => {
                        updateCategoryEnabled(category, checked);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </CardHeader>

              {isExpanded && settings.enabled && (
                <CardContent className="pt-0 space-y-6">
                  <Separator />

                  {/* Channel Toggles */}
                  <div className="space-y-4">
                    <Label className="text-sm font-medium">
                      Notification Channels
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {(
                        Object.entries(settings.channels) as [
                          NotificationChannel,
                          boolean
                        ][]
                      ).map(([channel, enabled]) => {
                        const ChannelIcon = CHANNEL_ICONS[channel];
                        return (
                          <button
                            key={channel}
                            type="button"
                            onClick={() =>
                              updateCategoryChannel(category, channel, !enabled)
                            }
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                              enabled
                                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                : "border-muted hover:border-muted-foreground/30"
                            }`}
                          >
                            <div
                              className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                                enabled
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              <ChannelIcon className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-medium">
                                {CHANNEL_LABELS[channel]}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {enabled ? "Enabled" : "Disabled"}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Frequency Selection */}
                  <div className="space-y-4">
                    <Label className="text-sm font-medium">
                      Delivery Frequency
                    </Label>
                    <div className="grid grid-cols-3 gap-3">
                      {FREQUENCY_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            updateCategoryFrequency(category, option.value)
                          }
                          className={`p-3 rounded-lg border text-left transition-all ${
                            settings.frequency === option.value
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-muted hover:border-muted-foreground/30"
                          }`}
                        >
                          <p className="text-sm font-medium">{option.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {option.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  <NotificationPreview category={category} settings={settings} />
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Quiet Hours Settings */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Quiet Hours</CardTitle>
                  <ContextualHelp helpKey="settings.quiet-hours" size="sm" />
                </div>
                <CardDescription>
                  Pause notifications during specific hours
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={preferences.quietHours.enabled}
              onCheckedChange={(checked) =>
                updateQuietHours("enabled", checked)
              }
            />
          </div>
        </CardHeader>
        {preferences.quietHours.enabled && (
          <CardContent className="pt-0 space-y-6">
            <Separator />
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="quiet-start">Start Time</Label>
                <Select
                  value={preferences.quietHours.startTime}
                  onValueChange={(value) =>
                    updateQuietHours("startTime", value)
                  }
                >
                  <SelectTrigger id="quiet-start">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((time) => (
                      <SelectItem key={time.value} value={time.value}>
                        {time.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiet-end">End Time</Label>
                <Select
                  value={preferences.quietHours.endTime}
                  onValueChange={(value) => updateQuietHours("endTime", value)}
                >
                  <SelectTrigger id="quiet-end">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((time) => (
                      <SelectItem key={time.value} value={time.value}>
                        {time.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/30">
              <Clock className="h-8 w-8 text-indigo-500" />
              <div>
                <p className="font-medium text-indigo-700 dark:text-indigo-400">
                  Quiet Hours: {preferences.quietHours.startTime} -{" "}
                  {preferences.quietHours.endTime}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  You will not receive push or SMS notifications during this
                  time. Notifications will be queued and delivered when quiet
                  hours end.
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Notification Sound */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Volume2 className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <CardTitle className="text-base">Notification Sound</CardTitle>
              <CardDescription>
                Choose the sound for push notifications
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Select
            value={preferences.notificationSound}
            onValueChange={(value) =>
              updateNotificationSound(value as NotificationSound)
            }
          >
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="Select sound" />
            </SelectTrigger>
            <SelectContent>
              {NOTIFICATION_SOUNDS.map((sound) => (
                <SelectItem key={sound.value} value={sound.value}>
                  {sound.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Test Notification */}
      <Card className="mb-6 border-dashed">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Play className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-base">Test Notification</CardTitle>
                <CardDescription>
                  Send a test notification to verify your settings
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleTestNotification}
              disabled={isTestingSend || preferences.doNotDisturb}
            >
              {isTestingSend ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4 mr-2" />
                  Send Test
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Save Status Bar (sticky footer) */}
      <SaveStatusBar
        status={isSaving ? "saving" : autosaveStatus}
        lastSavedText={lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString() : undefined}
        hasChanges={hasChanges}
      >
        {hasChanges && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={isSaving}>
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}
      </SaveStatusBar>
    </div>
  );
}

export default NotificationPreferencesForm;
