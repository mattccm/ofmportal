import { getPageAccess } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import BrandingSettingsPage from "./branding-client";

export default async function Page() {
  const access = await getPageAccess();
  if (!access.has("settings.branding")) return <NoAccess what="agency branding" roleName={access.role.name} />;
  return <BrandingSettingsPage />;
}
