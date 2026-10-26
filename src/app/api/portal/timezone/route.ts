import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api";
import { validateCreatorSession } from "@/lib/portal-auth";
import { captureCreatorTimeZone } from "@/lib/due-server";

/**
 * POST { timezone } from the creator's browser after sign-in. Saved only while
 * the creator is still on the default time zone; answers the time zone their
 * dates now read in.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await validateCreatorSession(req);
    if (!authResult.success) return authResult.error;

    const bodyResult = await parseJsonBody(req);
    if (!bodyResult.ok) return bodyResult.response;
    const body = (bodyResult.data ?? {}) as { timezone?: unknown };

    const timezone = await captureCreatorTimeZone(authResult.creator.id, body.timezone);
    if (!timezone) return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    return NextResponse.json({ timezone });
  } catch (error) {
    console.error("Error saving creator time zone:", error);
    return NextResponse.json({ error: "Failed to save time zone" }, { status: 500 });
  }
}
