import { getPageAccess } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import AutomationsPage from "./automations-client";

export default async function Page() {
  const access = await getPageAccess();
  if (!access.has("settings.automations")) return <NoAccess what="automations" roleName={access.role.name} />;
  return <AutomationsPage />;
}
