import { NextRequest, NextResponse } from "next/server";
import { retryFailedDeliveries } from "@/lib/webhooks";
import { verifyCronAuth } from "@/lib/cron-auth";
import { runCron } from "@/lib/cron";

/**
 * Cron: Retry failed webhook deliveries
 *
 * Runs every 5 minutes to retry deliveries with exponential backoff.
 * Processes up to 20 retries per run.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runCron("webhook-retry", async () => {
    const results = await retryFailedDeliveries();

    console.log("[Webhook Retry Cron] Results:", results);

    return NextResponse.json({
      message: "Webhook retry completed",
      ...results,
    });
  }, { errorMessage: "Failed to retry webhooks" });
}
