import { getPageAccess } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import DataManagementPage from "./data-client";

export default async function Page() {
  const access = await getPageAccess();
  if (!access.has("settings.data")) return <NoAccess what="data and storage" roleName={access.role.name} />;
  return <DataManagementPage />;
}
