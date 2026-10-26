import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardLayoutClient } from "@/components/layout/dashboard-layout-client";
import { getPageAccess, toClientAccess } from "@/lib/access/server";
import { AccessProvider } from "@/lib/access/client";
import { ViewerTimeZoneProvider } from "@/components/title-wall/viewer-time";
import { StaffTimeZoneSync } from "@/components/dates/staff-timezone-sync";
import { staffTimeZone } from "@/lib/due-server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agencyId) {
    redirect("/login");
  }

  // What this person may see and do, for the nav and every page's controls
  const access = await getPageAccess();
  // Every moment on staff screens reads in this person's own time zone; the
  // server passes it so the server render and the browser print the same text
  const viewerTz = (await staffTimeZone(access.userId)) ?? "UTC";

  return (
    <AccessProvider value={toClientAccess(access)}>
      <ViewerTimeZoneProvider value={viewerTz}>
        <StaffTimeZoneSync current={viewerTz} />
        <DashboardLayoutClient>{children}</DashboardLayoutClient>
      </ViewerTimeZoneProvider>
    </AccessProvider>
  );
}
