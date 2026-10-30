/**
 * Database side of src/lib/messaging.ts: loads the agency defaults, the
 * request snapshot, the creator's own reminder settings and the urgency rule,
 * then asks the pure decision functions. Server only.
 */
import { Prisma } from "@prisma/client";
import type { Urgency } from "@prisma/client";
import { db } from "./db";
import { pushFor, sendPushToCreator } from "./push";
import {
  type AgencyMessaging,
  type ChannelChoice,
  type ChannelPlan,
  type CreatorContact,
  type MessageEvent,
  type MessagingPlan,
  type ResolvedSchedule,
  DEFAULT_AGENCY_MESSAGING,
  isEmptyPlan,
  planChannels,
  readAgencyMessaging,
  resolveSchedule,
  snapshotFromTemplate,
} from "./messaging";

// Small per-process cache: a bulk action plans hundreds of messages for one agency
const agencyCache = new Map<string, { at: number; value: AgencyMessaging }>();
const TTL = 15_000;

/** `fresh`: skip the cache (settings pages, which must show what was just saved) */
export async function loadAgencyMessaging(agencyId: string, opts: { fresh?: boolean } = {}): Promise<AgencyMessaging> {
  const hit = agencyCache.get(agencyId);
  if (!opts.fresh && hit && Date.now() - hit.at < TTL) return hit.value;
  const agency = await db.agency.findUnique({ where: { id: agencyId }, select: { settings: true } });
  const value = agency ? readAgencyMessaging(agency.settings) : DEFAULT_AGENCY_MESSAGING;
  agencyCache.set(agencyId, { at: Date.now(), value });
  return value;
}

/** Writes Agency.settings.messaging without touching the other settings keys */
export async function saveAgencyMessaging(agencyId: string, value: AgencyMessaging): Promise<void> {
  await db.$executeRaw`UPDATE "Agency" SET "settings" = jsonb_set(COALESCE("settings", '{}'::jsonb), '{messaging}', ${JSON.stringify(value)}::jsonb, true), "updatedAt" = NOW() WHERE "id" = ${agencyId}`;
  agencyCache.delete(agencyId);
}

/**
 * Channels for one creator-facing message about a request.
 * Pass the request (with its `messaging` snapshot) when there is one.
 */
export async function planFor(
  event: MessageEvent,
  ctx: {
    agencyId: string;
    creator: CreatorContact;
    request?: { messaging?: unknown } | null;
    template?: { messaging?: unknown; name?: string } | null;
    forced?: ChannelChoice;
  }
): Promise<ChannelPlan> {
  const agency = await loadAgencyMessaging(ctx.agencyId);
  return planChannels(event, { agency, creator: ctx.creator, request: ctx.request, template: ctx.template, forced: ctx.forced });
}

/**
 * The messaging snapshot a new request stores: an explicit plan from the
 * composer wins, otherwise the template's plan (null = agency defaults).
 */
export async function requestMessagingFor(
  templateId: string | null | undefined,
  explicit?: MessagingPlan | null
): Promise<Prisma.InputJsonValue | typeof Prisma.DbNull> {
  if (explicit !== undefined) {
    if (explicit === null || isEmptyPlan(explicit)) return Prisma.DbNull;
    return { ...explicit, origin: explicit.origin ?? { kind: "request" } } as unknown as Prisma.InputJsonValue;
  }
  if (!templateId) return Prisma.DbNull;
  const template = await db.requestTemplate.findUnique({ where: { id: templateId }, select: { id: true, name: true, messaging: true } });
  const snap = snapshotFromTemplate(template);
  return snap ? (snap as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
}

/** Everything resolveSchedule needs for a creator + urgency (+ request or template) */
export async function loadSchedule(ctx: {
  agencyId: string;
  creatorId: string;
  creator: CreatorContact;
  urgency: Urgency;
  request?: { messaging?: unknown } | null;
  template?: { messaging?: unknown; name?: string } | null;
}): Promise<{ schedule: ResolvedSchedule; agency: AgencyMessaging; ruleId?: string; overrideId?: string }> {
  const [agency, override, rule] = await Promise.all([
    loadAgencyMessaging(ctx.agencyId),
    db.creatorReminderOverride.findUnique({ where: { agencyId_creatorId: { agencyId: ctx.agencyId, creatorId: ctx.creatorId } } }),
    db.reminderRule.findFirst({ where: { agencyId: ctx.agencyId, urgency: ctx.urgency, isActive: true } }),
  ]);
  const schedule = resolveSchedule({
    agency,
    creator: ctx.creator,
    request: ctx.request,
    template: ctx.template,
    creatorOverride: override,
    rule,
  });
  return {
    schedule,
    agency,
    ruleId: schedule.source === "rule" ? rule?.id : undefined,
    overrideId: schedule.source === "creator" ? override?.id : undefined,
  };
}

/**
 * Plan and send one creator-facing message: asks planChannels, then calls
 * the email and/or text sender. Each channel fails on its own (logged), so a
 * failed text never stops the email.
 */
export async function deliver(
  event: MessageEvent,
  ctx: {
    agencyId: string;
    creator: CreatorContact & { email?: string | null; id?: string };
    request?: { messaging?: unknown; id?: string } | null;
    forced?: ChannelChoice;
  },
  send: { email?: () => Promise<unknown>; sms?: (phone: string) => Promise<unknown> }
): Promise<{ plan: ChannelPlan; email: boolean; sms: boolean; errors: string[] }> {
  const plan = await planFor(event, ctx);
  const result = { plan, email: false, sms: false, errors: [] as string[] };
  if (plan.email && send.email && ctx.creator.email) {
    try {
      await send.email();
      result.email = true;
    } catch (error) {
      console.error(`[messaging] ${event} email failed:`, error);
      result.errors.push(`Email: ${error instanceof Error ? error.message : "failed"}`);
    }
  }
  if (plan.sms && send.sms && ctx.creator.phone) {
    try {
      await send.sms(ctx.creator.phone);
      result.sms = true;
    } catch (error) {
      console.error(`[messaging] ${event} text failed:`, error);
      result.errors.push(`Text: ${error instanceof Error ? error.message : "failed"}`);
    }
  }
  // A free nudge on their phone too, for creators who turned notifications on
  // (same discreet words as a text; never a request title)
  if ((result.email || result.sms) && ctx.creator.id) {
    const message = pushFor(event, { requestId: ctx.request?.id });
    if (message) await sendPushToCreator(ctx.creator.id, message).catch(() => {});
  }
  return result;
}
