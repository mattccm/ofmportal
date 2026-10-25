"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Globe, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { TimezoneSettings } from "@/components/settings/timezone-settings";

export default function TimezoneSettingsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/settings/profile" aria-label="Back to profile">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Timezone Settings
            </h1>
            <p className="text-muted-foreground">
              Configure your timezone and date formats
            </p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <Card className="card-elevated border-line bg-tile-hi dark:bg-tile-hi dark:border-line">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-tile-hi flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground dark:text-foreground">
                Why Timezone Settings Matter
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Accurate timezone settings ensure that all due dates, reminders,
                and scheduled items are displayed correctly. This helps prevent
                missed deadlines and ensures your team stays synchronized across
                different time zones.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Settings */}
      <TimezoneSettings showBusinessHours={false} />
    </div>
  );
}
