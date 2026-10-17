import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Keeps the proxy details on the server. They are only returned after the
// correct access password is posted, so the credentials never appear in the
// page source. All values come from environment variables, so they can be
// updated in Railway without a code change.
export const dynamic = "force-dynamic";

type Config = {
  gate: string;
  host: string;
  port: string;
  username: string;
  proxyPassword: string;
  app: string;
  expectIp: string;
};

function getConfig(): Config {
  return {
    gate: process.env.CREATORVERIFY_PASSWORD ?? "",
    host: process.env.CV_PROXY_HOST ?? "",
    port: process.env.CV_PROXY_PORT ?? "",
    username: process.env.CV_PROXY_USER ?? "",
    proxyPassword: process.env.CV_PROXY_PASS ?? "",
    app: process.env.CV_PROXY_APP ?? "Potatso",
    expectIp: process.env.CV_EXPECT_IP ?? "",
  };
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Lets the page tell "not set up yet" from "wrong password" without leaking anything.
export function GET() {
  const c = getConfig();
  return NextResponse.json({ configured: Boolean(c.gate && c.host) });
}

export async function POST(req: NextRequest) {
  const c = getConfig();

  let given = "";
  try {
    const body: unknown = await req.json();
    if (body && typeof body === "object" && "password" in body) {
      const p = (body as { password?: unknown }).password;
      if (typeof p === "string") given = p;
    }
  } catch {
    // ignore malformed body
  }

  // Small constant delay to blunt brute-forcing of the gate password.
  await new Promise((resolve) => setTimeout(resolve, 400));

  if (!c.gate || !safeEqual(given, c.gate)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    proxy: {
      host: c.host,
      port: c.port,
      username: c.username,
      password: c.proxyPassword,
      app: c.app,
      expectIp: c.expectIp,
    },
  });
}
