import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardLayoutClient } from "@/components/layout/dashboard-layout-client";
import { getPageAccess, toClientAccess } from "@/lib/access/server";
import { AccessProvider } from "@/lib/access/client";

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

  return (
    <AccessProvider value={toClientAccess(access)}>
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </AccessProvider>
  );
}
