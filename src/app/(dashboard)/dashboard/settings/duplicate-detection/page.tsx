import { getPageAccess } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import DuplicateDetectionPage from "./duplicate-detection-client";

export default async function Page() {
  const access = await getPageAccess();
  if (!access.has("settings.duplicates")) return <NoAccess what="duplicate detection" roleName={access.role.name} />;
  return <DuplicateDetectionPage />;
}
