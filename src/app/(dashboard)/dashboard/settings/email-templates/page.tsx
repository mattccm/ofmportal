import { getPageAccess } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import EmailTemplatesPage from "./email-templates-client";

export default async function Page() {
  const access = await getPageAccess();
  if (!access.has("settings.emailTemplates")) return <NoAccess what="email templates" roleName={access.role.name} />;
  return <EmailTemplatesPage />;
}
