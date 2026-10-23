import { NextRequest, NextResponse } from "next/server";
import { runReminderCron } from "@/lib/reminders";
import { verifyCronAuth } from "@/lib/cron-auth";
import { runCron } from "@/lib/cron";

// This endpoint should be called by a cron job service
// For Vercel, add this to vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/reminders",
//     "schedule": "0 * * * *"
//   }]
// }

export async function GET(req: NextRequest) {
  // Verify cron secret for security
  if (!verifyCronAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runCron(
    "reminders",
    async () => {
      const result = await runReminderCron();

      if (!result.success) {
        // Throw so the Sentry monitor records a failed check-in; runCron
        // turns this into the same 500 response as before
        throw result.error instanceof Error
          ? result.error
          : new Error("Reminder cron reported failure");
      }

      return NextResponse.json({ message: "Reminders processed successfully" });
    },
    {
      errorMessage: "Failed to process reminders",
      // Hourly heartbeat: Sentry alerts if a run is missed or fails
      monitor: {
        slug: "cron-reminders",
        config: {
          schedule: { type: "crontab", value: "0 * * * *" },
          checkinMargin: 10,
          maxRuntime: 10,
          timezone: "UTC",
        },
      },
    }
  );
}

// Also support POST for manual triggers
export async function POST(req: NextRequest) {
  return GET(req);
}
