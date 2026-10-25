import { Suspense } from "react";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getComposeData } from "./data";
import { Composer } from "./composer";

export const metadata: Metadata = { title: "New request" };

export default async function NewRequestPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.agencyId) redirect("/login");

  const agencyName = session.user.agencyName || "CCM";
  const data = await getComposeData(session.user.agencyId, session.user.id, agencyName);

  return (
    <Suspense>
      <Composer data={data} agencyName={agencyName} />
    </Suspense>
  );
}
