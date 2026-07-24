import { NextRequest, NextResponse } from "next/server";
import { retryFailedDeliveries } from "@/lib/webhooks";
import { verifyCronAuth } from "@/lib/cron-auth";

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

  try {
    const results = await retryFailedDeliveries();

    console.log("[Webhook Retry Cron] Results:", results);

    return NextResponse.json({
      message: "Webhook retry completed",
      ...results,
    });
  } catch (error) {
    console.error("Webhook retry cron error:", error);
    return NextResponse.json(
      { error: "Failed to retry webhooks" },
      { status: 500 }
    );
  }
}
