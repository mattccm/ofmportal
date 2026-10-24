"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { BRAND } from "@/lib/brand";

// Support address for error pages; nothing renders when it is unset
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null;

// The root layout (and globals.css) is gone when this renders, so the page
// carries its own <html>/<body> and plain inline styles that mirror the
// design tokens, with a dark-mode override via prefers-color-scheme.
const css = `
  .ge-root{--ge-bg:#f7f8f7;--ge-card:#ffffff;--ge-fg:#1a1d1b;--ge-muted:#5f6862;--ge-border:#e2e6e3;--ge-primary:${BRAND.primaryColor};--ge-primary-fg:#ffffff;--ge-tint:rgba(47,106,74,.1)}
  @media (prefers-color-scheme: dark){.ge-root{--ge-bg:#121513;--ge-card:#1a1e1c;--ge-fg:#eef1ef;--ge-muted:#a2aba5;--ge-border:#2c322e;--ge-primary:${BRAND.accentColor};--ge-primary-fg:#0f1a14;--ge-tint:rgba(106,168,132,.15)}.ge-logo{filter:invert(1)}}
  .ge-root{margin:0;min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:32px 16px;box-sizing:border-box;background:var(--ge-bg);color:var(--ge-fg);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  .ge-card{width:100%;max-width:420px;background:var(--ge-card);border:1px solid var(--ge-border);border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.08);text-align:center}
  .ge-bar{height:6px;background:var(--ge-primary)}
  .ge-body{padding:28px 24px 24px}
  .ge-mark{width:64px;height:64px;margin:0 auto 16px;border-radius:16px;background:var(--ge-tint);display:flex;align-items:center;justify-content:center}
  .ge-title{margin:0 0 8px;font-size:20px;font-weight:600}
  .ge-text{margin:0;color:var(--ge-muted);font-size:15px;line-height:1.5}
  .ge-id{margin:10px 0 0;color:var(--ge-muted);font:12px ui-monospace,monospace;word-break:break-all}
  .ge-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
  .ge-btn{flex:1 1 140px;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;text-decoration:none;box-sizing:border-box;border:1px solid var(--ge-border);background:transparent;color:var(--ge-fg)}
  .ge-btn-primary{background:var(--ge-primary);border-color:var(--ge-primary);color:var(--ge-primary-fg)}
  .ge-btn:focus-visible{outline:2px solid var(--ge-primary);outline-offset:2px}
  .ge-support{margin:20px 0 0;color:var(--ge-muted);font-size:12px}
  .ge-support a{color:var(--ge-primary)}
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
      <body className="ge-root">
        <main className="ge-card">
          <div className="ge-bar" aria-hidden="true" />
          <div className="ge-body">
            <div className="ge-mark">
              {/* Plain <img>: next/image and the app shell may be what failed */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ge-logo" src={BRAND.logoPath} alt={BRAND.name} width={40} height={40} />
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
