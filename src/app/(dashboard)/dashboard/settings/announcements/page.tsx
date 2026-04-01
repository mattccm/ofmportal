"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnnouncementManager } from "@/components/announcements";

export default function AnnouncementsSettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
            <Megaphone className="h-6 w-6 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
            <p className="text-muted-foreground">
              Create and manage banner announcements for your team
            </p>
          </div>
        </div>
      </div>

      {/* Help text */}
      <div className="p-4 bg-muted/50 rounded-xl border border-border/50">
        <h3 className="font-medium mb-2">About Announcements</h3>
        <ul className="text-sm text-muted-foreground space-y-1.5">
          <li>- Announcements appear as banners at the top of the dashboard</li>
          <li>- Users can dismiss announcements, and they will not see them again</li>
          <li>- Schedule announcements to appear at specific times</li>
          <li>- Target specific audiences: all users, admins only, or creators only</li>
          <li>- Pin important announcements to keep them at the top</li>
        </ul>
      </div>

      {/* Announcement Manager */}
      <AnnouncementManager />
    </div>
  );
}
