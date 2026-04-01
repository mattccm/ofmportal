"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences-form";
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "@/types/notification-preferences";

export default function NotificationSettingsPage() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [preferences, setPreferences] =
    React.useState<NotificationPreferences | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch notification preferences on mount
  React.useEffect(() => {
    async function fetchPreferences() {
      try {
        const response = await fetch("/api/notifications/preferences");

        if (!response.ok) {
          throw new Error("Failed to fetch notification preferences");
        }

        const data = await response.json();
        setPreferences(data.preferences || DEFAULT_NOTIFICATION_PREFERENCES);
      } catch (err) {
        console.error("Error fetching notification preferences:", err);
        setError("Failed to load notification preferences. Please try again.");
        // Use defaults on error
        setPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPreferences();
  }, []);

  // Save preferences handler
  const handleSavePreferences = async (
    newPreferences: NotificationPreferences
  ) => {
    const response = await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPreferences),
    });

    if (!response.ok) {
      throw new Error("Failed to save preferences");
    }

    setPreferences(newPreferences);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Loading notification settings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
            <Bell className="h-6 w-6 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Notification Settings
            </h1>
            <p className="text-muted-foreground">
              Control how and when you receive notifications
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30">
          <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <Bell className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-red-600 hover:underline mt-1"
            >
              Click to retry
            </button>
          </div>
        </div>
      )}

      {/* Notification Preferences Form */}
      {preferences && (
        <NotificationPreferencesForm
          initialPreferences={preferences}
          onSave={handleSavePreferences}
        />
      )}
    </div>
  );
}
