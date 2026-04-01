import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { BulkOperationsCenter } from "@/components/bulk-operations";

export const metadata: Metadata = {
  title: "Bulk Operations | Upload Portal",
  description: "Manage bulk operations for requests, reviews, status updates, and reminders",
};

export default async function BulkOperationsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agencyId) {
    redirect("/login");
  }

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
