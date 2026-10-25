import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DashboardClient } from "./dashboard-client";
import { getOverviewData } from "./_overview/get-overview";

// Generic on purpose: a request title never reaches the browser tab
export const metadata = { title: "Overview" };

const CAN_REMIND = ["OWNER", "ADMIN", "MANAGER"];

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.agencyId) {
    redirect("/login");
  }

  const data = await getOverviewData(session.user.agencyId, session.user.id);

  return <DashboardClient data={data} canRemind={CAN_REMIND.includes(session.user.role)} />;
}
