import { getPageAccess } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import EmailComposePage from "./compose-client";

export default async function Page() {
  const access = await getPageAccess();
  if (!access.has("messages.email")) return <NoAccess what="emailing creators" roleName={access.role.name} />;
  return <EmailComposePage />;
}
