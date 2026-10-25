import { getPageAccess } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import FeedbackHistoryPage from "./feedback-client";

export default async function Page() {
  const access = await getPageAccess();
  if (!access.has("settings.feedback")) return <NoAccess what="the feedback inbox" roleName={access.role.name} />;
  return <FeedbackHistoryPage />;
}
