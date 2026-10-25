import { getPageAccess } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import AnnouncementsSettingsPage from "./announcements-client";

export default async function Page() {
  const access = await getPageAccess();
  if (!access.has("settings.announcements")) return <NoAccess what="announcements" roleName={access.role.name} />;
  return <AnnouncementsSettingsPage />;
}
