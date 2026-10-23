import { NextRequest, NextResponse } from "next/server";
import { runReminderCron } from "@/lib/reminders";
import { verifyCronAuth } from "@/lib/cron-auth";

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

  const result = await runReminderCron();

  if (result.success) {
    return NextResponse.json({ message: "Reminders processed successfully" });
  } else {
    return NextResponse.json(
      { error: "Failed to process reminders" },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(req: NextRequest) {
  return GET(req);
}
