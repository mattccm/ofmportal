import { Metadata } from "next";
import { getPageAccess } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import { BulkOperationsCenter } from "@/components/bulk-operations";

export const metadata: Metadata = {
  title: "Bulk Operations",
  description: "Manage bulk operations for requests, reviews, status updates, and reminders",
};

export default async function BulkOperationsPage() {
  const access = await getPageAccess();
  if (!access.has("requests.bulk")) return <NoAccess what="bulk actions" roleName={access.role.name} />;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Bulk Operations Command Center
        </h1>
        <p className="mt-1 text-muted-foreground">
          Efficiently manage mass actions at scale - requests, reviews, status updates, and reminders
        </p>
      </div>

      {/* Main content */}
      <BulkOperationsCenter />
    </div>
  );
}
