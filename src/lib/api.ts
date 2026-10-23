import { NextResponse } from "next/server";
import type { RateLimitResult } from "./rate-limit";

export type ParseJsonBodyResult<T = Record<string, unknown>> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

function invalidBody(): NextResponse {
  return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
}

/**
 * Parse a request's JSON body without throwing. Malformed or empty bodies,
 * and bodies that aren't a JSON object (null, arrays, primitives), return a
 * ready-made 400 response instead of bubbling up as a 500.
 * Callers should still validate the fields of `data` (e.g. with zod).
 */
export async function parseJsonBody<T = Record<string, unknown>>(
  req: Request
): Promise<ParseJsonBodyResult<T>> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    return { ok: false, response: invalidBody() };
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, response: invalidBody() };
  }
  return { ok: true, data: data as T };
}

/**
 * Standard 429 response for a failed rate limit check.
 */
export function rateLimitResponse(
  result: RateLimitResult,
  message = "Too many attempts. Please try again later."
): NextResponse {
  const retryAfter = result.retryAfter ?? Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return NextResponse.json(
    { error: message, retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(result.reset),
      },
    }
  );
}
