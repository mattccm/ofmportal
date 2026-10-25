import { db } from "@/lib/db";
import { creatorWhere, getPageAccess, redactCreator, requestWhere, type Access } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import { ExportsDashboard } from "./exports-dashboard";

async function getExportOptions(access: Access) {
  try {
    const [creators, requests] = await Promise.all([
      // Only creators inside this person's creator scope
      db.creator.findMany({
        where: creatorWhere(access),
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      db.contentRequest.findMany({
        where: requestWhere(access),
        select: { id: true, title: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    return { creators: redactCreator(access, creators), requests };
  } catch (error) {
    console.error("Failed to fetch export options:", error);
    return { creators: [], requests: [] };
  }
}

export default async function ExportsPage() {
  const access = await getPageAccess();
  if (!access.has("exports.data")) return <NoAccess what="exports" roleName={access.role.name} />;

  const { creators, requests } = await getExportOptions(access);

  return (
    <div className="animate-fade-in">
      <ExportsDashboard
        creators={creators}
        requests={requests}
      />
    </div>
  );
}
