import { db } from "@/lib/db";
import { creatorWhere, getPageAccess, redactCreator, staffWhere, type Access } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import { ReportsDashboard } from "./reports-dashboard";

async function getReportOptions(access: Access) {
  try {
    const [creators, teamMembers] = await Promise.all([
      // Only creators inside this person's creator scope
      db.creator.findMany({
        where: creatorWhere(access),
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      // Only teammates inside this person's team scope
      db.user.findMany({
        where: staffWhere(access),
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return { creators: redactCreator(access, creators), teamMembers };
  } catch (error) {
    console.error("Failed to fetch report options:", error);
    return { creators: [], teamMembers: [] };
  }
}

export default async function ReportsPage() {
  const access = await getPageAccess();
  if (!access.has("reports.view")) return <NoAccess what="reports" roleName={access.role.name} />;

  const { creators, teamMembers } = await getReportOptions(access);

  return (
    <div className="animate-fade-in">
      <ReportsDashboard
        creators={creators}
        teamMembers={teamMembers}
      />
    </div>
  );
}
