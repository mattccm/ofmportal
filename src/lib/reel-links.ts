/**
 * Instagram links pasted into "Add reels from links" (new request). Pure, so
 * the composer can count them as they're pasted and the server reads them the
 * same way. Post, reel and IGTV links all work; tracking bits are dropped.
 */

export interface ReelLink {
  /** Instagram's short code, e.g. "Dem5O-MhpPI" */
  code: string;
  /** The tidy link, https://www.instagram.com/p/<code>/ */
  url: string;
}

/** At most this many in one go (each one is a download) */
export const MAX_REEL_LINKS = 40;

const LINK = /(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:p|reels?|tv)\/([A-Za-z0-9_-]{5,40})/gi;

/** Every Instagram post/reel link in the text, in order, each once */
export function parseReelLinks(text: string): ReelLink[] {
  const seen = new Set<string>();
  const links: ReelLink[] = [];
  for (const m of text.matchAll(LINK)) {
    const code = m[1];
    if (seen.has(code)) continue;
    seen.add(code);
    links.push({ code, url: `https://www.instagram.com/p/${code}/` });
  }
  return links;
}

/** What the server answers for each link */
export type ReelResult =
  | { code: string; ok: true; url: string; duration?: number }
  | { code: string; ok: false; error: string };
