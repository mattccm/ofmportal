"use server";

import { getAccess } from "@/lib/access/server";
import { getUploads, type PageProps } from "./query";

/**
 * The next page of uploads for infinite scroll, with the same filters and
 * sort as the server page (the generic /api/uploads route speaks a different
 * contract: limit/offset and no template or date filters).
 */
export async function loadUploadsPage(params: Awaited<PageProps["searchParams"]>) {
  const access = await getAccess();
  if (!access) throw new Error("Unauthorized");
  if (!access.has("review.view")) throw new Error("You don't have permission to see uploads.");
  return getUploads(access, params);
}
