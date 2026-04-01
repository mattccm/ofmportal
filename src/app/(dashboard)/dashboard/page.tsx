import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { DashboardClient } from "./dashboard-client";
import type { WidgetConfig } from "@/components/dashboard/widget-grid";

// Default widget layout
const DEFAULT_LAYOUT: WidgetConfig[] = [
  { id: "quick-stats-1", type: "quick-stats", title: "Quick Stats", size: "large", order: 0, visible: true },
  { id: "activity-feed-1", type: "activity-feed", title: "Activity Feed", size: "medium", order: 1, visible: true },
  { id: "upcoming-deadlines-1", type: "upcoming-deadlines", title: "Upcoming Deadlines", size: "small", order: 2, visible: true },
  { id: "pending-requests-1", type: "pending-requests", title: "Pending Requests", size: "medium", order: 3, visible: true },
  { id: "top-creators-1", type: "top-creators", title: "Top Performers", size: "small", order: 4, visible: true },
  { id: "recent-uploads-1", type: "recent-uploads", title: "Recent Uploads", size: "medium", order: 5, visible: true },
  { id: "reminder-summary-1", type: "reminder-summary", title: "Reminders", size: "medium", order: 6, visible: true },
];

async function getUserLayout(userId: string): Promise<WidgetConfig[]> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const preferences = (user?.preferences as Record<string, unknown>) || {};
    const savedLayout = preferences.dashboardLayout as WidgetConfig[] | undefined;

    if (savedLayout && Array.isArray(savedLayout) && savedLayout.length > 0) {
      return savedLayout;
    }
  } catch (error) {
    console.error("Error fetching user layout:", error);
  }

  return DEFAULT_LAYOUT;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const userId = session.user.id;
  const userName = session.user.name?.split(" ")[0] || "there";
  const layout = await getUserLayout(userId);

  return <DashboardClient userName={userName} initialLayout={layout} />;
}
