/**
 * Database side of src/lib/message-copy.ts: the agency's wording lives in
 * Agency.settings.messageCopy ({ v: 1, messages: only what differs from the
 * defaults }). Server only.
 */
import { db } from "./db";
import { DEFAULT_COPY, LOOKED_UP_FILL_INS, readCopy, toOverrides, usesFillIn, type AgencyCopy, type CopyValues, type MessageCopy } from "./message-copy";
import { teammatesFor } from "./assignments";

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

const PRIORITY_WORD: Record<string, string> = { LOW: "Low", NORMAL: "Normal", HIGH: "High", URGENT: "Urgent" };

/** The request id inside a portal link (/portal/<creator>/requests/<id> or /creator/requests/<id>) */
export function requestIdFromLink(link: string | null | undefined): string | null {
  const m = link?.match(/\/requests\/([A-Za-z0-9_-]+)(?:[/?#]|$)/);
  return m ? m[1] : null;
}

/**
 * Fill-ins a sender doesn't carry (template, priority, number of items, who
 * looks after the creator), looked up only when the wording uses them.
 * Never throws: a lookup that fails leaves those fill-ins empty.
 */
export async function lookedUpFillIns(copy: MessageCopy, opts: { requestId?: string | null; link?: string | null }): Promise<Partial<CopyValues>> {
  if (!usesFillIn(copy, LOOKED_UP_FILL_INS)) return {};
  // Without the request, "who looks after them" still reads naturally
  const fallback: Partial<CopyValues> = usesFillIn(copy, ["teamMember"]) ? { teamMember: "the team" } : {};
  const requestId = opts.requestId ?? requestIdFromLink(opts.link);
  if (!requestId) return fallback;
  try {
    const r = await db.contentRequest.findUnique({
      where: { id: requestId },
      select: { agencyId: true, creatorId: true, urgency: true, fields: true, template: { select: { name: true } } },
    });
    if (!r) return fallback;
    const out: Partial<CopyValues> = {
      templateName: r.template?.name ?? "",
      priority: PRIORITY_WORD[r.urgency] ?? "",
      itemCount: String(Array.isArray(r.fields) ? r.fields.length : 0),
    };
    if (usesFillIn(copy, ["teamMember"])) {
      const ids = await teammatesFor(r.agencyId, r.creatorId);
      const people = ids.length ? await db.user.findMany({ where: { id: { in: ids } }, select: { name: true }, orderBy: { name: "asc" } }) : [];
      const firsts = people.map((p) => (p.name || "").trim().split(/\s+/)[0]).filter(Boolean);
      out.teamMember = firsts.length === 0 ? "the team" : firsts.length === 1 ? firsts[0] : `${firsts.slice(0, -1).join(", ")} and ${firsts[firsts.length - 1]}`;
    }
    return out;
  } catch (error) {
    console.error("Failed to look up message fill-ins:", error);
    return fallback;
  }
}
