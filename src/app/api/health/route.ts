import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Liveness probe for the platform health check. Intentionally dependency-free
// so a transient database blip doesn't cause the container to be recycled.
export function GET() {
  return NextResponse.json({ status: "ok" });
}
