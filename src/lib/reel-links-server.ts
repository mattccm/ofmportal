import type { ReelLink, ReelResult } from "./reel-links";
import { TEMPLATE_ASSETS_PREFIX, saveTemplateAsset, templateAssetExists, templateAssetUrl } from "./template-assets";

/**
 * Turns Instagram links into example videos stored with the portal's own files.
 * Apify's Instagram Scraper (apify/instagram-scraper) looks each post up and
 * gives a direct video link, which is downloaded once and kept under
 * template-assets/<agency>/reels/<code>.mp4, so the same reel pasted again
 * (or sent to several creators) is never fetched twice. Server only.
 *
 * Needs APIFY_TOKEN (Apify > Settings > API & Integrations).
 */

const APIFY_BASE = process.env.APIFY_BASE_URL || "https://api.apify.com";
const ACTOR = "apify~instagram-scraper";
const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

export const apifyConfigured = () => Boolean(process.env.APIFY_TOKEN);

const reelKey = (agencyId: string, code: string) => `${TEMPLATE_ASSETS_PREFIX}/${agencyId}/reels/${code}.mp4`;

interface ApifyItem {
  shortCode?: string;
  inputUrl?: string;
  url?: string;
  type?: string;
  videoUrl?: string;
  videoDuration?: number;
  error?: string;
  errorDescription?: string;
}

class ApifyError extends Error {}

/** One Apify run for these links; waits for it (a few seconds a link) */
async function lookUp(links: ReelLink[]): Promise<ApifyItem[]> {
  const res = await fetch(`${APIFY_BASE}/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=240`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.APIFY_TOKEN}` },
    body: JSON.stringify({ directUrls: links.map((l) => l.url), resultsType: "posts", resultsLimit: 1, addParentData: false }),
    signal: AbortSignal.timeout(250_000),
  });
  if (res.status === 401 || res.status === 403) throw new ApifyError("Apify didn't accept the token. Check APIFY_TOKEN.");
  if (res.status === 402) throw new ApifyError("The Apify account is out of credit.");
  if (!res.ok) throw new ApifyError(`Apify couldn't look these up (${res.status}). Try again in a minute.`);
  const items = await res.json().catch(() => null);
  return Array.isArray(items) ? items : [];
}

function itemFor(items: ApifyItem[], code: string): ApifyItem | undefined {
  return (
    items.find((i) => i.shortCode === code) ??
    items.find((i) => [i.inputUrl, i.url].some((u) => typeof u === "string" && u.includes(`/${code}`)))
  );
}

async function download(videoUrl: string): Promise<Uint8Array> {
  const res = await fetch(videoUrl, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`the video didn't download (${res.status})`);
  const size = Number(res.headers.get("content-length") || 0);
  if (size > MAX_VIDEO_BYTES) throw new Error("the video is over 150MB");
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_VIDEO_BYTES) throw new Error("the video is over 150MB");
  if (bytes.byteLength < 1024) throw new Error("the video came back empty");
  return bytes;
}

/** Fetch these reels (in the order given). Never throws for one bad link; throws ApifyError when Apify itself fails. */
export async function fetchReels(agencyId: string, links: ReelLink[]): Promise<ReelResult[]> {
  // Already stored from an earlier paste: no lookup, no download
  const stored = await Promise.all(links.map((l) => templateAssetExists(reelKey(agencyId, l.code)).catch(() => false)));
  const missing = links.filter((_, i) => !stored[i]);
  const items = missing.length ? await lookUp(missing) : [];

  // A few downloads at a time
  const queue = links.map((l, i) => ({ l, i }));
  const out: ReelResult[] = new Array(links.length);
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const { l, i } = next;
      const key = reelKey(agencyId, l.code);
      if (stored[i]) {
        out[i] = { code: l.code, ok: true, url: templateAssetUrl(key) };
        continue;
      }
      const item = itemFor(items, l.code);
      if (!item || item.error) {
        out[i] = { code: l.code, ok: false, error: item?.error ? "Instagram didn't show this post (private, removed or age-restricted?)" : "Couldn't find this post" };
        continue;
      }
      if (!item.videoUrl) {
        out[i] = { code: l.code, ok: false, error: item.type === "Sidecar" ? "This post is a carousel, not a reel" : "This post isn't a video" };
        continue;
      }
      try {
        const bytes = await download(item.videoUrl);
        await saveTemplateAsset(key, bytes, "video/mp4");
        out[i] = { code: l.code, ok: true, url: templateAssetUrl(key), duration: typeof item.videoDuration === "number" ? item.videoDuration : undefined };
      } catch (e) {
        out[i] = { code: l.code, ok: false, error: `Found it, but ${e instanceof Error ? e.message : "the video didn't download"}` };
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return out;
}

export { ApifyError };
