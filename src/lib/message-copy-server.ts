/**
 * Database side of src/lib/message-copy.ts: the agency's wording lives in
 * Agency.settings.messageCopy ({ v: 1, messages: only what differs from the
 * defaults }). Server only.
 */
import { db } from "./db";
import { DEFAULT_COPY, readCopy, toOverrides, type AgencyCopy } from "./message-copy";

// Per-process cache: a bulk send words hundreds of messages for one agency
const cache = new Map<string, { at: number; value: AgencyCopy }>();
const TTL = 15_000;

/**
 * The wording for an agency. Without an agencyId (senders that don't carry
 * one) the sole agency is used: this is a single-agency tool.
 * Falls back to the defaults if it can't be read, so sending never fails on wording.
 */
export async function loadMessageCopy(agencyId?: string, opts: { fresh?: boolean } = {}): Promise<AgencyCopy> {
  const key = agencyId ?? "*";
  const hit = cache.get(key);
  if (!opts.fresh && hit && Date.now() - hit.at < TTL) return hit.value;
  try {
    const agency = agencyId
      ? await db.agency.findUnique({ where: { id: agencyId }, select: { settings: true } })
      : await db.agency.findFirst({ select: { settings: true } });
    const value = readCopy(agency?.settings);
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (error) {
    console.error("Failed to load message wording:", error);
    return DEFAULT_COPY;
  }
}

/** Writes Agency.settings.messageCopy without touching the other settings keys */
export async function saveMessageCopy(agencyId: string, copy: AgencyCopy): Promise<AgencyCopy> {
  const stored = { v: 1, messages: toOverrides(copy) };
  await db.$executeRaw`UPDATE "Agency" SET "settings" = jsonb_set(COALESCE("settings", '{}'::jsonb), '{messageCopy}', ${JSON.stringify(stored)}::jsonb, true), "updatedAt" = NOW() WHERE "id" = ${agencyId}`;
  cache.clear();
  return readCopy({ messageCopy: stored });
}
