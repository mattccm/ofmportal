import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";

const errorLogSchema = z.object({
  message: z.string().max(2000),
  digest: z.string().optional(),
  stack: z.string().max(10000).optional(),
  componentStack: z.string().max(10000).optional(),
  timestamp: z.string(),
  url: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
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
