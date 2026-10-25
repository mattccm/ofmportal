import { getPageAccess } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import { OversightView } from "@/components/oversight/oversight-view";

export const metadata = {
  title: "Oversight | Dashboard",
  description: "Monitor staff and creator activity across your agency",
};

// Oversight is a management feature: the "Oversight" permission
export default async function OversightPage() {
  const access = await getPageAccess();
  if (!access.has("settings.oversight")) {
    return <NoAccess what="oversight" roleName={access.role.name} />;
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      <OversightView />
    </div>
  );
}
