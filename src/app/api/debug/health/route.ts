import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Debug endpoint to check system health and session state
export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  // Check database connection
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = { status: "ok" };
  } catch (error) {
    checks.database = { status: "error", message: String(error) };
  }

  // Check session
  try {
    const session = await getServerSession(authOptions);
    checks.session = session
      ? {
          status: "authenticated",
          userId: session.user?.id,
          userEmail: session.user?.email,
          agencyId: session.user?.agencyId,
          role: session.user?.role,
        }
      : { status: "not authenticated" };
  } catch (error) {
    checks.session = { status: "error", message: String(error) };
  }

  // If authenticated, check agency data
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.agencyId) {
      const agency = await db.agency.findUnique({
        where: { id: session.user.agencyId },
        select: { id: true, name: true },
      });
      checks.agency = agency
        ? { status: "found", id: agency.id, name: agency.name }
        : { status: "not found" };

      // Check creator count
      const creatorCount = await db.creator.count({
        where: { agencyId: session.user.agencyId },
      });
      checks.creatorCount = creatorCount;

      // Check request count
      const requestCount = await db.contentRequest.count({
        where: { agencyId: session.user.agencyId },
      });
      checks.requestCount = requestCount;
    }
  } catch (error) {
    checks.agencyCheck = { status: "error", message: String(error) };
  }

  return NextResponse.json(checks);
}
