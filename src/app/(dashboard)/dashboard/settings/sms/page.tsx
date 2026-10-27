import { getPageAccess } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import SmsSettingsClient from "./sms-client";

export default async function Page() {
  const access = await getPageAccess();
  if (!access.has("settings.sms")) return <NoAccess what="text message settings" roleName={access.role.name} />;
  return <SmsSettingsClient />;
}
