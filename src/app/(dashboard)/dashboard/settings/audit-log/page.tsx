import { getPageAccess } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import AuditLogPage from "./audit-log-client";

export default async function Page() {
  const access = await getPageAccess();
  if (!access.has("settings.auditLog")) return <NoAccess what="the audit log" roleName={access.role.name} />;
  return <AuditLogPage />;
}
