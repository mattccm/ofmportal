import { BRAND } from "./brand";

/**
 * The email world: the portal's Title Wall carried into the inbox. A night
 * ground, a cover tile with the heading set in Onest 800, one yellow button,
 * state chips with their glyph and word. Table-based and inline-styled for
 * mail clients (Outlook keeps the bgcolor attributes; clients that support
 * <style> get the phone layout).
 *
 * Pure (no database, no Resend): the Reminders > Wording preview renders
 * these same functions in the browser, so what staff see is what is sent.
 *
 * Dark mode: the email declares itself dark only, so Apple Mail, Outlook and
 * Gmail on the web leave it alone. Gmail's iOS app inverts every email in
 * dark mode; inverted, this one reads as a light email, which stays legible
 * because text and grounds flip together.
 */

export interface EmailBranding {
  agencyName: string;
  /** Display name used for the email "From" header */
  fromName: string;
  /** Kept for callers that pass it; the header is always the typeset wordmark */
  logoUrl: string | null;
  /** The button fill: the one yellow */
  primaryColor: string;
  /** Ink on the button */
  buttonTextColor: string;
  signature: string | null;
  supportEmail: string | null;
  replyTo: string | null;
}

/** DESIGN.md tokens, as hex for mail clients */
export const EMAIL_COLORS = {
  ground: "#0e0f12",
  tile: "#1b1d22",
  tileHi: "#23262c",
  well: "#15161a",
  line: "#2a2d34",
  ctl: "#3c4049",
  ink: "#eceef2",
  ink2: "#a6aab3",
  acc: BRAND.primaryColor,
  accInk: BRAND.primaryInk,
} as const;
const C = EMAIL_COLORS;

export const FONT_STACK = "Onest, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO_STACK = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Escape HTML entities to prevent injection in email templates */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Standard body paragraph (already-safe HTML) */
export function p(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;line-height:1.55;color:${C.ink};">${html}</p>`;
}

/** Small note in quiet ink */
export function note(html: string): string {
  return `<p style="margin:0 0 10px;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:${C.ink2};">${html}</p>`;
}

/**
 * The state vocabulary: a pale tint of the state on the tile (precomputed,
 * 14%), same-hue ink, the glyph before the word. Never colour alone.
 */
export const EMAIL_STATES = {
  approved: { color: "#6fd99b", background: "#273733", glyph: "✓", word: "Approved" },
  changes: { color: "#f7922f", background: "#3a2d24", glyph: "↺", word: "Needs changes" },
  overdue: { color: "#ff6461", background: "#3b272b", glyph: "!", word: "Overdue" },
  ready: { color: "#6ea8ff", background: "#273141", glyph: "◷", word: "Waiting for review" },
} as const;
export type EmailState = keyof typeof EMAIL_STATES;

/** A state chip, or a neutral chip with just a word */
export function chip(state: EmailState | { word: string }): string {
  const s = typeof state === "string" ? EMAIL_STATES[state] : null;
  const color = s ? s.color : C.ink;
  const bg = s ? s.background : C.tileHi;
  const text = s ? `<span aria-hidden="true" style="font-weight:700;">${s.glyph}</span>&nbsp;${escapeHtml(s.word)}` : escapeHtml((state as { word: string }).word);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;"><tr><td bgcolor="${bg}" style="padding:4px 9px;background-color:${bg};border-radius:6px;font-family:${FONT_STACK};font-size:12px;line-height:1.2;font-weight:600;color:${color};white-space:nowrap;">${text}</td></tr></table>`;
}

/** A tile holding a request: its title (17px 600), a meta line, an optional chip, and an optional labelled note under a hairline */
export function requestTile(opts: { title: string; meta?: string; chip?: string; note?: { label: string; html: string } }): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td bgcolor="${C.tile}" style="padding:16px 18px;background-color:${C.tile};border-radius:10px;">
<p style="margin:0;font-family:${FONT_STACK};font-size:17px;line-height:1.35;font-weight:600;letter-spacing:-0.01em;color:${C.ink};">${escapeHtml(opts.title)}</p>
${opts.meta ? `<p style="margin:4px 0 0;font-family:${FONT_STACK};font-size:14px;line-height:1.5;color:${C.ink2};">${escapeHtml(opts.meta)}</p>` : ""}
${opts.chip ? `<div style="margin:10px 0 0;">${opts.chip}</div>` : ""}
${opts.note ? `<div style="margin:14px 0 0;padding:14px 0 0;border-top:1px solid ${C.line};"><p style="margin:0 0 6px;font-family:${FONT_STACK};font-size:13px;font-weight:500;color:${C.ink2};">${escapeHtml(opts.note.label)}</p><div style="font-family:${FONT_STACK};font-size:15px;line-height:1.55;color:${C.ink};">${opts.note.html}</div></div>` : ""}
</td></tr></table>`;
}

/** A tile with free text, e.g. the team's feedback; `label` is a 13px quiet line above the text */
export function infoCard(innerHtml: string, label?: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td bgcolor="${C.tile}" style="padding:16px 18px;background-color:${C.tile};border-radius:10px;font-family:${FONT_STACK};font-size:15px;line-height:1.55;color:${C.ink};">${label ? `<p style="margin:0 0 6px;font-family:${FONT_STACK};font-size:13px;font-weight:500;color:${C.ink2};">${escapeHtml(label)}</p>` : ""}${innerHtml}</td></tr></table>`;
}

/** The one yellow action. Full width on a phone */
export function ctaButton(url: string, label: string, _branding?: Pick<EmailBranding, "primaryColor" | "buttonTextColor">): string {
  const safeUrl = escapeHtml(url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn" style="margin:8px 0 28px;"><tr><td bgcolor="${C.acc}" style="border-radius:8px;background-color:${C.acc};"><a href="${safeUrl}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:${FONT_STACK};font-size:15px;font-weight:600;line-height:1;color:${C.accInk};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a></td></tr></table>`;
}

/** Copy-and-paste fallback for the button's link */
export function linkFallback(url: string): string {
  const safeUrl = escapeHtml(url);
  return `<p style="margin:0 0 6px;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:${C.ink2};">Button not working? Paste this link into your browser:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td bgcolor="${C.well}" style="padding:10px 12px;background-color:${C.well};border:1px solid ${C.line};border-radius:8px;font-family:${MONO_STACK};font-size:12px;line-height:1.5;color:${C.ink2};word-break:break-all;">${safeUrl}</td></tr></table>`;
}

/** Cover lettering size by length, like the title cards (two lines at most) */
function coverSize(heading: string): { size: number; tracking: string } {
  const n = heading.length;
  if (n <= 18) return { size: 40, tracking: "-0.035em" };
  if (n <= 28) return { size: 34, tracking: "-0.035em" };
  return { size: 28, tracking: "-0.025em" };
}

/**
 * Wrap pre-built (already-escaped) content in the shell: wordmark, the cover
 * tile with the heading (and an optional line or chip under it), the content
 * on the ground, then the footer. `heading` is plain text.
 */
export function renderEmail(options: {
  subject: string;
  branding: EmailBranding;
  heading?: string;
  /** Under the heading inside the cover (already-safe HTML): a chip or a short line */
  coverFoot?: string;
  content: string;
}): string {
  const { subject, branding, heading, coverFoot, content } = options;
  const safeAgency = escapeHtml(branding.agencyName);
  const cover = heading ? coverSize(heading) : null;

  const signatureLine = branding.signature ? escapeHtml(branding.signature) : `Sent by ${escapeHtml(BRAND.name)}`;
  const supportLine = branding.supportEmail
    ? `<p style="margin:6px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${C.ink2};">Need a hand? Email <a href="mailto:${escapeHtml(branding.supportEmail)}" style="color:${C.ink};text-decoration:underline;">${escapeHtml(branding.supportEmail)}</a>.</p>`
    : "";
  const legal = branding.agencyName === BRAND.legalName ? "" : `<br>${escapeHtml(BRAND.legalName)}`;

  const coverHtml = heading
    ? `<tr><td class="px" style="padding:0 24px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${C.tile}" class="cover-pad" style="padding:30px 26px 26px;background-color:${C.tile};border-radius:10px;">
<h1 class="cover" style="margin:0;font-family:${FONT_STACK};font-size:${cover!.size}px;line-height:1.05;font-weight:800;letter-spacing:${cover!.tracking};color:${C.ink};">${escapeHtml(heading)}</h1>
${coverFoot ? `<div style="margin:14px 0 0;font-family:${FONT_STACK};font-size:14px;line-height:1.5;color:${C.ink2};">${coverFoot}</div>` : ""}
</td></tr></table>
</td></tr>`
    : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>${escapeHtml(subject)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;800&amp;display=swap" rel="stylesheet">
    <style>
      :root { color-scheme: dark; supported-color-schemes: dark; }
      body { margin: 0; padding: 0; background-color: ${C.ground}; }
      a { color: ${C.ink}; }
      @media (max-width: 600px) {
        .px { padding-left: 16px !important; padding-right: 16px !important; }
        .cover-pad { padding: 24px 20px 20px !important; }
        .cover { font-size: 30px !important; }
        .btn { width: 100% !important; }
        .btn a { display: block !important; text-align: center !important; }
      }
    </style>
  </head>
  <body bgcolor="${C.ground}" style="margin:0;padding:0;width:100%;background-color:${C.ground};-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(subject)}${"&#847;&zwnj;&nbsp;".repeat(60)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.ground}" style="background-color:${C.ground};">
      <tr>
        <td align="center" style="padding:28px 0 36px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
            <tr>
              <td class="px" style="padding:0 24px 22px;font-family:${FONT_STACK};font-size:22px;line-height:1;font-weight:800;letter-spacing:-0.035em;color:${C.ink};">${escapeHtml(BRAND.name)}</td>
            </tr>
            ${coverHtml}
            <tr>
              <td class="px" style="padding:0 24px;">
                ${content}
              </td>
            </tr>
            <tr>
              <td class="px" style="padding:8px 24px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:20px 0 0;border-top:1px solid ${C.line};">
                  <p style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:${C.ink2};">${signatureLine}</p>
                  ${supportLine}
                  <p style="margin:12px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${C.ink2};">You&#039;re getting this because you work with ${safeAgency}.${legal}</p>
                </td></tr></table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Plain-text version of the footer rendered by renderEmail */
export function textFooter(branding: Pick<EmailBranding, "agencyName">): string {
  const legal = branding.agencyName === BRAND.legalName ? "" : `\n${BRAND.legalName}`;
  return `\n\n--\nYou're getting this because you work with ${branding.agencyName}.${legal}`;
}

/** Plain text with blank lines between paragraphs → safe paragraph HTML (single newlines become line breaks) */
export function paragraphs(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => p(escapeHtml(para).replace(/\n/g, "<br>")))
    .join("\n");
}
