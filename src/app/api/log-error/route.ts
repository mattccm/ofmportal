import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";

// Truncate oversized fields instead of rejecting them, so long minified
// stacks still get logged.
const clip = (n: number) => z.string().transform((s) => s.slice(0, n));
const errorLogSchema = z.object({
  message: clip(2000),
  digest: clip(200).optional(),
  stack: clip(10000).optional(),
  componentStack: clip(10000).optional(),
  timestamp: clip(100),
  url: clip(2000).optional(),
  userAgent: clip(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const limit = await rateLimitAsync(`log-error:${ip}`, {
      interval: 60 * 1000,
      maxRequests: 30,
    });
    if (!limit.success) {
      return NextResponse.json({ logged: false }, { status: 429 });
    }

    const body = await req.json();
    const errorLog = errorLogSchema.parse(body);

    // Log structured error server-side (visible in Vercel logs / server logs)
    console.error("[CLIENT_ERROR]", JSON.stringify({
      message: errorLog.message,
      digest: errorLog.digest,
      url: errorLog.url,
      timestamp: errorLog.timestamp,
    }));

    return NextResponse.json({ logged: true });
  } catch {
    return NextResponse.json({ logged: false }, { status: 400 });
  }
}
