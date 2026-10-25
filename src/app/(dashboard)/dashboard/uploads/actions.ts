"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUploads, type PageProps } from "./query";

/**
 * The next page of uploads for infinite scroll, with the same filters and
 * sort as the server page (the generic /api/uploads route speaks a different
 * contract: limit/offset and no template or date filters).
 */
export async function loadUploadsPage(params: Awaited<PageProps["searchParams"]>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.agencyId) throw new Error("Unauthorized");
  return getUploads(session.user.agencyId, params);
}
