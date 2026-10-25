"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Onest } from "next/font/google";
import { BRAND } from "@/lib/brand";

// The root layout's font is gone here too, so load the same face for this page
const onest = Onest({ subsets: ["latin"], weight: ["400", "700"], display: "swap" });

// Support address for error pages; nothing renders when it is unset
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null;

// The root layout (and globals.css) is gone when this renders, so the page
// carries its own <html>/<body> and plain inline styles that mirror the
// Title Wall tokens (one dark theme).
const css = `
  .ge-root{--ge-bg:${BRAND.groundColor};--ge-card:#1b1d22;--ge-fg:${BRAND.inkColor};--ge-muted:#a6aab3;--ge-border:#3c4049;--ge-primary:${BRAND.primaryColor};--ge-primary-fg:${BRAND.primaryInk};color-scheme:dark}
  .ge-logo{filter:invert(1)}
  .ge-root{margin:0;min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:32px 16px;box-sizing:border-box;background:var(--ge-bg);color:var(--ge-fg);font-family:var(--ge-font),ui-sans-serif,system-ui,sans-serif}
  .ge-card{width:100%;max-width:420px;background:var(--ge-card);border-radius:10px;overflow:hidden;text-align:left}
  .ge-body{padding:28px 24px 24px}
  .ge-mark{width:40px;height:40px;margin:0 0 20px;border-radius:8px;border:1.5px solid var(--ge-fg);display:flex;align-items:center;justify-content:center}
  .ge-title{margin:0 0 8px;font-size:22px;line-height:1.25;font-weight:700;letter-spacing:-.01em}
  .ge-text{margin:0;color:var(--ge-muted);font-size:15px;line-height:1.5}
  .ge-id{margin:10px 0 0;color:var(--ge-muted);font:12px ui-monospace,monospace;word-break:break-all}
  .ge-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
  .ge-btn{flex:1 1 140px;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;box-sizing:border-box;border:1px solid var(--ge-border);background:transparent;color:var(--ge-fg)}
  .ge-btn-primary{background:var(--ge-primary);border-color:var(--ge-primary);color:var(--ge-primary-fg)}
  .ge-btn:focus-visible{outline:2px solid var(--ge-primary);outline-offset:2px}
  .ge-support{margin:20px 0 0;color:var(--ge-muted);font-size:12px}
  .ge-support a{color:var(--ge-fg);text-underline-offset:3px}
`;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>{`Something went wrong | ${BRAND.productName}`}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body className="ge-root" style={{ ["--ge-font" as string]: onest.style.fontFamily }}>
        <main className="ge-card">
          <div className="ge-body">
            <div className="ge-mark">
              {/* Plain <img>: next/image and the app shell may be what failed */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ge-logo" src={BRAND.logoPath} alt={BRAND.name} width={28} height={28} />
            </div>
            <h1 className="ge-title">Something went wrong</h1>
            <p className="ge-text">
              {BRAND.productName} hit an unexpected error. Reloading usually clears it.
            </p>
            {error.digest && <p className="ge-id">Error ID: {error.digest}</p>}
            <div className="ge-actions">
              <button type="button" className="ge-btn ge-btn-primary" onClick={reset}>
                Try again
              </button>
              <button type="button" className="ge-btn" onClick={() => window.location.assign("/")}>
                Go to home page
              </button>
            </div>
            {SUPPORT_EMAIL && (
              <p className="ge-support">
                Still stuck? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
