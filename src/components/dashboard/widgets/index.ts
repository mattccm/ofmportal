// Widget exports
export { PendingRequestsWidget } from "./pending-requests-widget";
export { RecentUploadsWidget } from "./recent-uploads-widget";
export { UpcomingDeadlinesWidget } from "./upcoming-deadlines-widget";
export { TopCreatorsWidget } from "./top-creators-widget";
export { QuickStatsWidget } from "./quick-stats-widget";
export { ReminderSummaryWidget } from "./reminder-summary-widget";

// Widget definitions for the grid
import {
  Clock,
  Upload,
  Calendar,
  Trophy,
  BarChart3,
  Bell,
} from "lucide-react";
import { PendingRequestsWidget } from "./pending-requests-widget";
import { RecentUploadsWidget } from "./recent-uploads-widget";
import { UpcomingDeadlinesWidget } from "./upcoming-deadlines-widget";
import { TopCreatorsWidget } from "./top-creators-widget";
import { QuickStatsWidget } from "./quick-stats-widget";
import { ReminderSummaryWidget } from "./reminder-summary-widget";
import type { WidgetDefinition } from "../widget-grid";
import React from "react";

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    type: "quick-stats",
    title: "Quick Stats",
    description: "Key metrics at a glance with trends",
    icon: React.createElement(BarChart3, { className: "h-5 w-5" }),
    defaultSize: "large",
    supportedSizes: ["medium", "large"],
    component: QuickStatsWidget,
  },
  {
    type: "pending-requests",
    title: "Pending Requests",
    description: "List of content requests awaiting completion",
    icon: React.createElement(Clock, { className: "h-5 w-5" }),
    defaultSize: "medium",
    supportedSizes: ["small", "medium", "large"],
    component: PendingRequestsWidget,
  },
  {
    type: "recent-uploads",
    title: "Recent Uploads",
    description: "Latest uploads with thumbnails and status",
    icon: React.createElement(Upload, { className: "h-5 w-5" }),
    defaultSize: "medium",
    supportedSizes: ["small", "medium", "large"],
    component: RecentUploadsWidget,
  },
  {
    type: "upcoming-deadlines",
    title: "Upcoming Deadlines",
    description: "Calendar-style view of approaching due dates",
    icon: React.createElement(Calendar, { className: "h-5 w-5" }),
    defaultSize: "small",
    supportedSizes: ["small", "medium", "large"],
    component: UpcomingDeadlinesWidget,
  },
  {
    type: "top-creators",
    title: "Top Performers",
    description: "Leaderboard of your best creators",
    icon: React.createElement(Trophy, { className: "h-5 w-5" }),
    defaultSize: "small",
    supportedSizes: ["small", "medium", "large"],
    component: TopCreatorsWidget,
  },
  {
    type: "reminder-summary",
    title: "Reminders",
    description: "Summary of due and upcoming reminders",
    icon: React.createElement(Bell, { className: "h-5 w-5" }),
    defaultSize: "medium",
    supportedSizes: ["small", "medium", "large"],
    component: ReminderSummaryWidget,
  },
];
