import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/access/server";
import { parseReelLinks } from "@/lib/reel-links";
import { ApifyError, apifyConfigured, fetchReels } from "@/lib/reel-links-server";

/**
 * POST { links: string[] } (up to 10 a call; the composer sends them in batches)
 * -> { results: ReelResult[] } in the same order: each reel's stored example
 * video, or why it couldn't be fetched. Used by "Add reels from links" on a new request.
 */

export const maxDuration = 300;

const BATCH = 10;
const schema = z.object({ links: z.array(z.string().max(500)).min(1).max(BATCH) });

export async function POST(req: NextRequest) {
  const gate = await requireAccess("requests.create");
  if (gate.error) return gate.error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: `Send between 1 and ${BATCH} links.` }, { status: 400 });
  const links = parseReelLinks(parsed.data.links.join("\n"));
  if (!links.length) return NextResponse.json({ error: "Those aren't Instagram post or reel links." }, { status: 400 });

  if (!apifyConfigured()) {
    return NextResponse.json(
      { error: "Fetching reels isn't set up yet: add APIFY_TOKEN to the portal's settings in Vercel.", setup: true },
      { status: 424 }
    );
  }

  try {
    const results = await fetchReels(gate.session.user.agencyId, links);
    return NextResponse.json({ results });
  } catch (e) {
    // Apify itself failed (token, credit, outage): 424 so Vercel doesn't swap the message for its own page
    const message = e instanceof ApifyError ? e.message : "Couldn't fetch the reels. Try again in a minute.";
    if (!(e instanceof ApifyError)) console.error("[reels] fetch failed:", e);
    return NextResponse.json({ error: message }, { status: 424 });
  }
}
