import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Staff identity for the review-session API, taken from the signed-in session.
 * Returns null when there is no staff session; callers respond 401.
 */
export async function getReviewSessionUser(): Promise<{ userId: string; agencyId: string } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.agencyId) return null;
  return { userId: session.user.id, agencyId: session.user.agencyId };
}
