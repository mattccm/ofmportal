"use client";

import * as React from "react";
import {
  LayoutDashboard,
  BarChart3,
  MessageSquare,
  Users,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OversightDashboard } from "./oversight-dashboard";
import { StaffActivityMonitor } from "./staff-activity-monitor";
import { MessageOversightPanel } from "./message-oversight-panel";
import { CreatorCommunicationLog } from "./creator-communication-log";
import { KeywordAlerts } from "./keyword-alerts";

type OversightTab = "overview" | "staff" | "messages" | "creators" | "alerts";

const TABS: { id: OversightTab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "staff", label: "Staff Activity", icon: BarChart3 },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "creators", label: "Creators", icon: Users },
  { id: "alerts", label: "Keyword Alerts", icon: Bell },
];

export function OversightView() {
  const [tab, setTab] = React.useState<OversightTab>("overview");

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <OversightDashboard
          onNavigate={(section) => {
            if (
              section === "staff" ||
              section === "messages" ||
              section === "alerts"
            ) {
              setTab(section as OversightTab);
            }
          }}
        />
      )}
      {tab === "staff" && <StaffActivityMonitor />}
      {tab === "messages" && <MessageOversightPanel />}
      {tab === "creators" && <CreatorCommunicationLog />}
      {tab === "alerts" && <KeywordAlerts />}
    </div>
  );
}
