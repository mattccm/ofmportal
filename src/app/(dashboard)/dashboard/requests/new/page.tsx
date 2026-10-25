import { Suspense } from "react";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPageAccess } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import { getComposeData } from "./data";
import { Composer } from "./composer";

export const metadata: Metadata = { title: "New request" };

export default async function NewRequestPage() {
  const access = await getPageAccess();
  if (!access.has("requests.create")) return <NoAccess what="creating requests" roleName={access.role.name} />;
  const session = await getServerSession(authOptions);

  const agencyName = session?.user?.agencyName || "CCM";
  const data = await getComposeData(access, agencyName);

  return (
    <Suspense>
      <Composer data={data} agencyName={agencyName} />
    </Suspense>
  );
}
