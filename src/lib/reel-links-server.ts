import type { ReelLink, ReelResult } from "./reel-links";
import { TEMPLATE_ASSETS_PREFIX, saveTemplateAsset, templateAssetExists, templateAssetUrl } from "./template-assets";

/**
 * Turns Instagram links into example videos stored with the portal's own files.
 * Apify's Instagram Scraper (apify/instagram-scraper) looks the posts up and
 * gives a direct video link. When it can't (Instagram hides age-restricted
 * posts from it, say), snapinsta's downloader (snapinsta/instagram-downloader-api,
 * also on Apify) is tried for that link. The video is downloaded once and kept
 * under template-assets/<agency>/reels/<code>.mp4, so the same reel pasted
 * again (or sent to several creators) is never fetched twice. Server only.
 *
 * Needs APIFY_TOKEN (Apify > Settings > API & Integrations); both use it.
 */

const APIFY_BASE = process.env.APIFY_BASE_URL || "https://api.apify.com";
const ACTOR = "apify~instagram-scraper";
// The backup's always-on endpoint: one link per call, about US$0.0004 each
const BACKUP_URL = process.env.SNAPINSTA_URL || "https://snapinsta--instagram-downloader-api.apify.actor/api/download";
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

interface BackupAnswer {
  status?: boolean;
  media?: { url?: string | null; fileType?: string | null }[];
  error?: { code?: string; message?: string } | string;
}

type Backup = { url: string } | { problem: "hidden" | "not-video" | "no-credit" | "failed" };

/** The backup downloader for one link: a direct video link, or why not */
async function backupVideoUrl(link: ReelLink): Promise<Backup> {
  try {
    const res = await fetch(BACKUP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.APIFY_TOKEN}` },
      body: JSON.stringify({ url: link.url }),
      signal: AbortSignal.timeout(60_000),
    });
    if (res.status === 402) return { problem: "no-credit" };
    const data = await res.json().catch(() => null);
    const answer: BackupAnswer | undefined = Array.isArray(data) ? data[0] : data;
    if (!answer || answer.status !== true) {
      const code = answer && typeof answer.error === "object" ? answer.error.code : undefined;
      if (code === "MEDIA_NOT_AVAILABLE" || res.status === 404) return { problem: "hidden" };
      console.warn("[reels] backup downloader failed:", res.status, code ?? "");
      return { problem: "failed" };
    }
    const video = answer.media?.find((m) => m.url && (m.fileType?.startsWith("video/") || /\.mp4(\?|$)/i.test(m.url)));
    if (!video?.url) return { problem: answer.media?.length ? "not-video" : "hidden" };
    return { url: video.url };
  } catch {
    return { problem: "failed" };
  }
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

const BACKUP_SAYS: Record<Exclude<Backup, { url: string }>["problem"], string> = {
  hidden: "Instagram hides this post from downloaders (age-restricted, private or removed). Save it yourself and upload it to the field",
  "not-video": "This post isn't a video",
  "no-credit": "Instagram hid it from the first downloader, and the Apify account is out of credit for the second",
  failed: "Neither downloader could get this post. Try again in a minute, or upload it yourself",
};

/** One link's video: the scraper's link first, the backup when that's missing or won't download */
async function videoFor(link: ReelLink, item: ApifyItem | undefined): Promise<{ bytes: Uint8Array; duration?: number } | { error: string }> {
  // The scraper saw a photo or a carousel: the backup wouldn't make it a reel
  if (item && !item.error && !item.videoUrl && (item.type === "Image" || item.type === "Sidecar")) {
    return { error: item.type === "Sidecar" ? "This post is a carousel, not a reel" : "This post isn't a video" };
  }
  let firstProblem: string | null = null;
  if (item?.videoUrl) {
    try {
      return { bytes: await download(item.videoUrl), duration: typeof item.videoDuration === "number" ? item.videoDuration : undefined };
    } catch (e) {
      firstProblem = `Found it, but ${e instanceof Error ? e.message : "the video didn't download"}`;
    }
  }
  const backup = await backupVideoUrl(link);
  if ("problem" in backup) return { error: firstProblem && backup.problem === "failed" ? firstProblem : BACKUP_SAYS[backup.problem] };
  try {
    return { bytes: await download(backup.url) };
  } catch (e) {
    return { error: `Found it, but ${e instanceof Error ? e.message : "the video didn't download"}` };
  }
}

/** Fetch these reels (in the order given). Never throws for one bad link; throws ApifyError when Apify itself fails. */
export async function fetchReels(agencyId: string, links: ReelLink[]): Promise<ReelResult[]> {
  // Already stored from an earlier paste: no lookup, no download
  const stored = await Promise.all(links.map((l) => templateAssetExists(reelKey(agencyId, l.code)).catch(() => false)));
  const missing = links.filter((_, i) => !stored[i]);
  const items = missing.length ? await lookUp(missing) : [];

  // A few at a time
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
      const got = await videoFor(l, itemFor(items, l.code));
      if ("error" in got) {
        out[i] = { code: l.code, ok: false, error: got.error };
        continue;
      }
      try {
        await saveTemplateAsset(key, got.bytes, "video/mp4");
        out[i] = { code: l.code, ok: true, url: templateAssetUrl(key), duration: got.duration };
      } catch (e) {
        console.error("[reels] couldn't store", l.code, e);
        out[i] = { code: l.code, ok: false, error: "Got the video, but couldn't save it. Try again" };
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return out;
}

export { ApifyError };
