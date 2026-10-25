import { getPageAccess } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import { DashboardClient } from "./dashboard-client";
import { getOverviewData } from "./_overview/get-overview";

// Generic on purpose: a request title never reaches the browser tab
export const metadata = { title: "Overview" };

export default async function DashboardPage() {
  const access = await getPageAccess();
  if (!access.has("overview.view")) return <NoAccess what="the overview" roleName={access.role.name} />;

  // Only creators inside the role's scope, and only the parts it may see
  const data = await getOverviewData(access);

  // Sending reminders by hand stays a manager-and-up action, as before
  return <DashboardClient data={data} canRemind={access.has("reminders.send")} />;
}
