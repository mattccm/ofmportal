import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ReportsDashboard } from "./reports-dashboard";

async function getReportOptions(agencyId: string) {
  try {
    const [creators, teamMembers] = await Promise.all([
      db.creator.findMany({
        where: { agencyId },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      db.user.findMany({
        where: { agencyId },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return { creators, teamMembers };
  } catch (error) {
    console.error("Failed to fetch report options:", error);
    return { creators: [], teamMembers: [] };
  }
}

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agencyId) {
    redirect("/login");
  }

  const { creators, teamMembers } = await getReportOptions(session.user.agencyId);

  return (
    <div className="animate-fade-in">
      <ReportsDashboard
        creators={creators}
        teamMembers={teamMembers}
      />
    </div>
  );
}
