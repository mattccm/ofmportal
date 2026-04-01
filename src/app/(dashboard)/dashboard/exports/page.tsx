import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ExportsDashboard } from "./exports-dashboard";

async function getExportOptions(agencyId: string) {
  const [creators, requests] = await Promise.all([
    db.creator.findMany({
      where: { agencyId },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    db.contentRequest.findMany({
      where: { agencyId },
      select: { id: true, title: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return { creators, requests };
}

export default async function ExportsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agencyId) {
    return null;
  }

  const { creators, requests } = await getExportOptions(session.user.agencyId);

  return (
    <div className="animate-fade-in">
      <ExportsDashboard
        creators={creators}
        requests={requests}
      />
    </div>
  );
}
