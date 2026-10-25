import { getPageAccess, toClientAccess } from "@/lib/access/server";
import { AccessProvider } from "@/lib/access/client";
import { NoAccess } from "@/components/access/no-access";

/**
 * Review sessions sit outside the dashboard layout, so they gate here:
 * signed-out people go to /login, roles without review sessions see the
 * calm no-access page, and everyone else gets their access for the controls.
 */
export default async function ReviewSessionsLayout({ children }: { children: React.ReactNode }) {
  const access = await getPageAccess();
  if (!access.has("settings.reviewSessions")) {
    return (
      <main className="min-h-dvh bg-ground px-4 py-8 sm:px-6">
        <NoAccess what="review sessions" roleName={access.role.name} />
      </main>
    );
  }
  return <AccessProvider value={toClientAccess(access)}>{children}</AccessProvider>;
}
