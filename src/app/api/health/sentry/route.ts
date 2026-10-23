import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

// Sends a test event so error reporting can be verified after a deploy or DSN change.
// Protected by CRON_SECRET so it can't be used to flood the Sentry quota.
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventId = Sentry.captureMessage("Sentry test event from /api/health/sentry", "info");
  const delivered = await Sentry.flush(5000);

  return NextResponse.json({ eventId, delivered, enabled: Boolean(Sentry.getClient()?.getOptions().enabled) });
}
