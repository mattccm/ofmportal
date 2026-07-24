import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { OversightView } from "@/components/oversight/oversight-view";

export const metadata = {
  title: "Oversight | Dashboard",
  description: "Monitor staff and creator activity across your agency",
};

// Oversight is a management feature - restricted to elevated roles.
const OVERSIGHT_ROLES = ["OWNER", "ADMIN", "MANAGER"];

export default async function OversightPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agencyId) {
    redirect("/login");
  }
  if (!OVERSIGHT_ROLES.includes(session.user.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      <OversightView />
    </div>
  );
}
