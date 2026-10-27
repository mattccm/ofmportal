import { getPageAccess } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import { loadAgencyMessaging } from "@/lib/messaging-server";
import CreatorMessagesClient from "./creator-messages-client";

export default async function Page() {
  const access = await getPageAccess();
  if (!access.has("reminders.rules")) return <NoAccess what="creator message settings" roleName={access.role.name} />;
  const messaging = await loadAgencyMessaging(access.agencyId);
  return <CreatorMessagesClient initial={messaging} />;
}
