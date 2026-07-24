// Agency Oversight data layer
// All functions are agency-scoped and use bounded queries.
// Backed entirely by real Prisma data (ActivityLog, Conversation, Message, etc.).

import { db } from "@/lib/db";
import { ConversationType, RequestStatus } from "@prisma/client";
import type {
  ActivityLog as OversightActivityLog,
  StaffActivityMetrics,
  CreatorCommunicationSummary,
  MessageOversight,
  ConversationThread,
  ConversationParticipant,
  KeywordAlert,
  OversightStats,
  ThreadMessage,
} from "@/types/oversight";

// ----------------------------------------------------------------------------
// Bounds (keep queries cheap)
// ----------------------------------------------------------------------------
const ACTIVITY_LIMIT = 30;
const STAFF_LIMIT = 50;
const CONVERSATION_LIMIT = 60;
const CREATOR_LIMIT = 40;
const MESSAGE_SCAN_LIMIT = 400;
const KEYWORD_ALERT_LIMIT = 50;

// Statuses considered "open / pending" for a content request.
const PENDING_REQUEST_STATUSES: RequestStatus[] = [
  RequestStatus.PENDING,
  RequestStatus.IN_PROGRESS,
  RequestStatus.SUBMITTED,
  RequestStatus.UNDER_REVIEW,
  RequestStatus.NEEDS_REVISION,
];

// ----------------------------------------------------------------------------
// Keyword configuration (config-driven, stored in Agency.settings.oversight)
// Chosen over a new Prisma model as the lighter option per the task.
// ----------------------------------------------------------------------------
export interface OversightKeyword {
  keyword: string;
  category: string;
  priority: "low" | "medium" | "high";
}

export const DEFAULT_OVERSIGHT_KEYWORDS: OversightKeyword[] = [
  { keyword: "payment issue", category: "Financial", priority: "high" },
  { keyword: "refund", category: "Financial", priority: "high" },
  { keyword: "chargeback", category: "Financial", priority: "high" },
  { keyword: "contract", category: "Legal", priority: "medium" },
  { keyword: "lawyer", category: "Legal", priority: "high" },
  { keyword: "lawsuit", category: "Legal", priority: "high" },
  { keyword: "complaint", category: "Support", priority: "medium" },
  { keyword: "cancel", category: "Retention", priority: "medium" },
];

export async function getOversightKeywords(
  agencyId: string
): Promise<OversightKeyword[]> {
  const agency = await db.agency.findUnique({
    where: { id: agencyId },
    select: { settings: true },
  });
  const settings = (agency?.settings as Record<string, unknown>) || {};
  const oversight = (settings.oversight as Record<string, unknown>) || {};
  const keywords = oversight.keywords as OversightKeyword[] | undefined;
  if (Array.isArray(keywords) && keywords.length > 0) {
    return keywords;
  }
  return DEFAULT_OVERSIGHT_KEYWORDS;
}

export async function saveOversightKeywords(
  agencyId: string,
  keywords: OversightKeyword[]
): Promise<OversightKeyword[]> {
  // Sanitize + bound the config.
  const clean = keywords
    .filter((k) => k && typeof k.keyword === "string" && k.keyword.trim())
    .slice(0, 100)
    .map((k) => ({
      keyword: String(k.keyword).trim().slice(0, 60),
      category: String(k.category || "General").slice(0, 40),
      priority: (["low", "medium", "high"].includes(k.priority)
        ? k.priority
        : "medium") as OversightKeyword["priority"],
    }));

  const agency = await db.agency.findUnique({
    where: { id: agencyId },
    select: { settings: true },
  });
  const currentSettings = (agency?.settings as Record<string, unknown>) || {};
  const currentOversight = (currentSettings.oversight as Record<string, unknown>) || {};

  await db.agency.update({
    where: { id: agencyId },
    data: {
      settings: JSON.parse(
        JSON.stringify({
          ...currentSettings,
          oversight: { ...currentOversight, keywords: clean },
        })
      ),
    },
  });

  return clean;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function getAgencyUserIds(agencyId: string): Promise<string[]> {
  const users = await db.user.findMany({
    where: { agencyId },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

function conversationTypeToOversight(
  type: ConversationType
): MessageOversight["conversationType"] {
  return type === ConversationType.CREATOR ? "staff_creator" : "staff_staff";
}

function matchKeyword(text: string, keywords: OversightKeyword[]): string | null {
  const lower = text.toLowerCase();
  for (const k of keywords) {
    if (k.keyword && lower.includes(k.keyword.toLowerCase())) {
      return k.keyword;
    }
  }
  return null;
}

// Compute average first-response time (in minutes) from a chronological set of
// messages within a single conversation. A "response" is the first staff reply
// following a creator message. Returns null when no pairs are found.
interface SampleMessage {
  createdAt: Date;
  fromCreator: boolean;
  senderId: string | null;
}
function responseDeltas(messagesAsc: SampleMessage[]): {
  perStaff: Map<string, number[]>;
  all: number[];
} {
  const perStaff = new Map<string, number[]>();
  const all: number[] = [];
  let pendingCreatorAt: Date | null = null;

  for (const m of messagesAsc) {
    if (m.fromCreator) {
      if (pendingCreatorAt === null) pendingCreatorAt = m.createdAt;
    } else if (pendingCreatorAt !== null) {
      const minutes = (m.createdAt.getTime() - pendingCreatorAt.getTime()) / 60000;
      if (minutes >= 0 && minutes < 60 * 24 * 7) {
        all.push(minutes);
        if (m.senderId) {
          const arr = perStaff.get(m.senderId) || [];
          arr.push(minutes);
          perStaff.set(m.senderId, arr);
        }
      }
      pendingCreatorAt = null;
    }
  }
  return { perStaff, all };
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}

// Fetches a bounded, recent sample of creator-conversation messages and computes
// response-time metrics per creator and per staff member. Shared by several
// aggregations to avoid re-querying.
async function getCreatorConversationResponseMetrics(agencyId: string): Promise<{
  perCreator: Map<string, number>;
  perStaff: Map<string, number>;
}> {
  const messages = await db.message.findMany({
    where: { conversation: { agencyId, type: ConversationType.CREATOR } },
    orderBy: { createdAt: "desc" },
    take: MESSAGE_SCAN_LIMIT,
    select: {
      createdAt: true,
      senderId: true,
      creatorId: true,
      conversationId: true,
      conversation: { select: { creatorId: true } },
    },
  });

  // Group by conversation, ascending.
  const byConversation = new Map<string, typeof messages>();
  for (const m of messages) {
    const arr = byConversation.get(m.conversationId) || [];
    arr.push(m);
    byConversation.set(m.conversationId, arr);
  }

  const perCreatorDeltas = new Map<string, number[]>();
  const perStaffDeltas = new Map<string, number[]>();

  for (const [, convMessages] of byConversation) {
    const asc = [...convMessages].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    const creatorId = asc[0]?.conversation?.creatorId || null;
    const { perStaff, all } = responseDeltas(
      asc.map((m) => ({
        createdAt: m.createdAt,
        fromCreator: m.creatorId !== null,
        senderId: m.senderId,
      }))
    );
    if (creatorId) {
      const arr = perCreatorDeltas.get(creatorId) || [];
      perCreatorDeltas.set(creatorId, arr.concat(all));
    }
    for (const [staffId, deltas] of perStaff) {
      const arr = perStaffDeltas.get(staffId) || [];
      perStaffDeltas.set(staffId, arr.concat(deltas));
    }
  }

  const perCreator = new Map<string, number>();
  for (const [id, deltas] of perCreatorDeltas) perCreator.set(id, avg(deltas));
  const perStaff = new Map<string, number>();
  for (const [id, deltas] of perStaffDeltas) perStaff.set(id, avg(deltas));

  return { perCreator, perStaff };
}

// ----------------------------------------------------------------------------
// Recent activity (staff actions from ActivityLog)
// ----------------------------------------------------------------------------
export async function getRecentActivity(
  agencyId: string,
  limit = ACTIVITY_LIMIT
): Promise<OversightActivityLog[]> {
  const userIds = await getAgencyUserIds(agencyId);
  if (userIds.length === 0) return [];

  const logs = await db.activityLog.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  return logs.map((log) => ({
    id: log.id,
    userId: log.userId || "",
    userType: "staff",
    userName: log.user?.name || "Unknown",
    action: log.action,
    resourceType: log.entityType,
    resourceId: log.entityId,
    details: (log.metadata as Record<string, unknown>) || {},
    ipAddress: log.ipAddress || undefined,
    userAgent: log.userAgent || undefined,
    timestamp: log.createdAt,
  }));
}

// ----------------------------------------------------------------------------
// Staff activity metrics
// ----------------------------------------------------------------------------
export async function getStaffMetrics(
  agencyId: string
): Promise<StaffActivityMetrics[]> {
  const users = await db.user.findMany({
    where: { agencyId },
    take: STAFF_LIMIT,
    select: {
      id: true,
      name: true,
      role: true,
      avatar: true,
      lastActiveAt: true,
    },
  });
  if (users.length === 0) return [];

  const userIds = users.map((u) => u.id);
  const today = startOfToday();
  const weekAgo = daysAgo(7);
  const monthAgo = daysAgo(30);

  const [
    actionsTodayGroup,
    actionsWeekGroup,
    actionsMonthGroup,
    creatorMsgGroup,
    staffMsgGroup,
    requestsGroup,
    sessionGroup,
    responseMetrics,
  ] = await Promise.all([
    db.activityLog.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, createdAt: { gte: today } },
      _count: { _all: true },
    }),
    db.activityLog.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, createdAt: { gte: weekAgo } },
      _count: { _all: true },
    }),
    db.activityLog.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, createdAt: { gte: monthAgo } },
      _count: { _all: true },
    }),
    db.message.groupBy({
      by: ["senderId"],
      where: {
        senderId: { in: userIds },
        conversation: { agencyId, type: ConversationType.CREATOR },
      },
      _count: { _all: true },
    }),
    db.message.groupBy({
      by: ["senderId"],
      where: {
        senderId: { in: userIds },
        conversation: {
          agencyId,
          type: { in: [ConversationType.DIRECT, ConversationType.GROUP, ConversationType.REQUEST_THREAD] },
        },
      },
      _count: { _all: true },
    }),
    db.contentRequest.groupBy({
      by: ["reviewedBy"],
      where: { agencyId, reviewedBy: { in: userIds } },
      _count: { _all: true },
    }),
    db.session.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _count: { _all: true },
    }),
    getCreatorConversationResponseMetrics(agencyId),
  ]);

  const toMap = <T extends { _count: { _all: number } }>(
    rows: T[],
    key: keyof T
  ): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const id = r[key] as unknown as string | null;
      if (id) m.set(id, r._count._all);
    }
    return m;
  };

  const todayMap = toMap(actionsTodayGroup, "userId");
  const weekMap = toMap(actionsWeekGroup, "userId");
  const monthMap = toMap(actionsMonthGroup, "userId");
  const creatorMsgMap = toMap(creatorMsgGroup, "senderId");
  const staffMsgMap = toMap(staffMsgGroup, "senderId");
  const requestsMap = toMap(requestsGroup, "reviewedBy");
  const sessionMap = toMap(sessionGroup, "userId");

  return users.map((u) => ({
    userId: u.id,
    userName: u.name,
    role: u.role,
    avatar: u.avatar || undefined,
    actionsToday: todayMap.get(u.id) || 0,
    actionsThisWeek: weekMap.get(u.id) || 0,
    actionsThisMonth: monthMap.get(u.id) || 0,
    messagesToCreators: creatorMsgMap.get(u.id) || 0,
    messagesToStaff: staffMsgMap.get(u.id) || 0,
    averageResponseTime: responseMetrics.perStaff.get(u.id) || 0,
    requestsHandled: requestsMap.get(u.id) || 0,
    lastLogin: u.lastActiveAt || undefined,
    lastActivity: u.lastActiveAt || undefined,
    loginCount: sessionMap.get(u.id) || 0,
    hasUnusualActivity: false,
  }));
}

// ----------------------------------------------------------------------------
// Creator communication summaries
// ----------------------------------------------------------------------------
export type CreatorCommunicationSummaryWithThread = CreatorCommunicationSummary & {
  // Most-recent conversation id, used by the detail view to load a real thread.
  conversationId?: string;
};

export async function getCreatorCommunications(
  agencyId: string
): Promise<CreatorCommunicationSummaryWithThread[]> {
  const conversations = await db.conversation.findMany({
    where: { agencyId, type: ConversationType.CREATOR, creatorId: { not: null } },
    take: CONVERSATION_LIMIT,
    orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }],
    select: {
      id: true,
      creatorId: true,
      lastMessageAt: true,
      creator: { select: { id: true, name: true, avatar: true } },
      participants: {
        select: {
          user: { select: { id: true, name: true, role: true } },
        },
      },
      _count: { select: { messages: true } },
    },
  });
  if (conversations.length === 0) return [];

  const weekAgo = daysAgo(7);

  // Messages this week per conversation.
  const weekGroups = await db.message.groupBy({
    by: ["conversationId"],
    where: {
      createdAt: { gte: weekAgo },
      conversation: { agencyId, type: ConversationType.CREATOR },
    },
    _count: { _all: true },
  });
  const weekByConv = new Map<string, number>();
  for (const g of weekGroups) weekByConv.set(g.conversationId, g._count._all);

  // Pending requests per creator.
  const pendingGroups = await db.contentRequest.groupBy({
    by: ["creatorId"],
    where: { agencyId, status: { in: PENDING_REQUEST_STATUSES } },
    _count: { _all: true },
  });
  const pendingByCreator = new Map<string, number>();
  for (const g of pendingGroups) pendingByCreator.set(g.creatorId, g._count._all);

  const responseMetrics = await getCreatorConversationResponseMetrics(agencyId);

  // Aggregate conversations by creator (a creator may have multiple).
  // Conversations arrive ordered by lastMessageAt desc, so the first one seen
  // per creator is the most recent (used for the detail thread).
  const byCreator = new Map<string, CreatorCommunicationSummaryWithThread>();
  for (const conv of conversations) {
    const creator = conv.creator;
    if (!creator) continue;
    const existing = byCreator.get(creator.id);
    const staff = conv.participants
      .map((p) => p.user)
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .map((u) => ({ id: u.id, name: u.name, role: u.role }));

    if (existing) {
      existing.totalMessages += conv._count.messages;
      existing.messagesThisWeek += weekByConv.get(conv.id) || 0;
      if (
        conv.lastMessageAt &&
        (!existing.lastMessageAt || conv.lastMessageAt > existing.lastMessageAt)
      ) {
        existing.lastMessageAt = conv.lastMessageAt;
      }
      const seen = new Set(existing.assignedStaff.map((s) => s.id));
      for (const s of staff) if (!seen.has(s.id)) existing.assignedStaff.push(s);
    } else {
      byCreator.set(creator.id, {
        creatorId: creator.id,
        creatorName: creator.name,
        creatorAvatar: creator.avatar || undefined,
        conversationId: conv.id,
        assignedStaff: staff,
        totalMessages: conv._count.messages,
        messagesThisWeek: weekByConv.get(conv.id) || 0,
        lastMessageAt: conv.lastMessageAt || undefined,
        averageResponseTime: responseMetrics.perCreator.get(creator.id) || 0,
        pendingRequests: pendingByCreator.get(creator.id) || 0,
        flagged: false,
      });
    }
  }

  return Array.from(byCreator.values()).slice(0, CREATOR_LIMIT);
}

// ----------------------------------------------------------------------------
// Message oversight (conversation list)
// ----------------------------------------------------------------------------
export async function getMessageOversight(
  agencyId: string,
  keywords: OversightKeyword[]
): Promise<MessageOversight[]> {
  const conversations = await db.conversation.findMany({
    where: { agencyId },
    take: CONVERSATION_LIMIT,
    orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }],
    select: {
      id: true,
      type: true,
      lastMessageAt: true,
      lastMessagePreview: true,
      createdAt: true,
      creator: { select: { id: true, name: true } },
      participants: {
        select: { user: { select: { id: true, name: true, role: true } } },
      },
      _count: { select: { messages: true } },
    },
  });

  return conversations.map((conv) => {
    const participants: ConversationParticipant[] = conv.participants
      .map((p) => p.user)
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .map((u) => ({ id: u.id, name: u.name, role: u.role }));
    if (conv.creator) {
      participants.push({
        id: conv.creator.id,
        name: conv.creator.name,
        role: "Creator",
      });
    }

    const preview = conv.lastMessagePreview || undefined;
    const matched = preview ? matchKeyword(preview, keywords) : null;

    return {
      id: conv.id,
      conversationType: conversationTypeToOversight(conv.type),
      participants,
      messageCount: conv._count.messages,
      lastMessageAt: conv.lastMessageAt || conv.createdAt,
      flagged: matched !== null,
      flagReason: matched
        ? `Contains monitored keyword: '${matched}'`
        : undefined,
      preview,
    };
  });
}

// ----------------------------------------------------------------------------
// Conversation thread (for the thread viewer)
// ----------------------------------------------------------------------------
export async function getConversationThread(
  agencyId: string,
  conversationId: string
): Promise<ConversationThread | null> {
  const conv = await db.conversation.findFirst({
    where: { id: conversationId, agencyId },
    select: {
      id: true,
      type: true,
      createdAt: true,
      lastMessageAt: true,
      creator: { select: { id: true, name: true } },
      participants: {
        select: { user: { select: { id: true, name: true, role: true } } },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
        select: {
          id: true,
          content: true,
          createdAt: true,
          senderId: true,
          creatorId: true,
          sender: { select: { id: true, name: true, role: true } },
          creator: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!conv) return null;

  const participants: ConversationParticipant[] = conv.participants
    .map((p) => p.user)
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    .map((u) => ({ id: u.id, name: u.name, role: u.role }));
  if (conv.creator) {
    participants.push({ id: conv.creator.id, name: conv.creator.name, role: "Creator" });
  }

  const messages: ThreadMessage[] = conv.messages.map((m) => ({
    id: m.id,
    senderId: m.senderId || m.creatorId || "",
    senderName: m.sender?.name || m.creator?.name || "Unknown",
    senderRole: m.creatorId ? "Creator" : m.sender?.role || "Staff",
    content: m.content,
    timestamp: m.createdAt,
  }));

  return {
    id: conv.id,
    type: conversationTypeToOversight(conv.type),
    participants,
    messages,
    createdAt: conv.createdAt,
    updatedAt: conv.lastMessageAt || conv.createdAt,
  };
}

// ----------------------------------------------------------------------------
// Keyword alerts (real messages matched against configured keywords)
// ----------------------------------------------------------------------------
export async function getKeywordAlerts(
  agencyId: string,
  keywords: OversightKeyword[]
): Promise<KeywordAlert[]> {
  if (keywords.length === 0) return [];

  const messages = await db.message.findMany({
    where: {
      conversation: { agencyId },
      OR: keywords.map((k) => ({
        content: { contains: k.keyword, mode: "insensitive" as const },
      })),
    },
    orderBy: { createdAt: "desc" },
    take: MESSAGE_SCAN_LIMIT,
    select: {
      id: true,
      content: true,
      createdAt: true,
      conversationId: true,
      sender: { select: { id: true, name: true, role: true } },
      creator: { select: { id: true, name: true } },
      creatorId: true,
      conversation: { select: { type: true } },
    },
  });

  const alerts: KeywordAlert[] = [];
  for (const m of messages) {
    const matched = matchKeyword(m.content, keywords);
    if (!matched) continue;
    const isCreatorSender = m.creatorId !== null;
    alerts.push({
      id: m.id,
      keyword: matched,
      messageId: m.id,
      conversationId: m.conversationId,
      conversationType: conversationTypeToOversight(m.conversation.type),
      senderId: isCreatorSender ? m.creator?.id || "" : m.sender?.id || "",
      senderName: isCreatorSender
        ? m.creator?.name || "Creator"
        : m.sender?.name || "Unknown",
      senderRole: isCreatorSender ? "Creator" : m.sender?.role || "Staff",
      messagePreview: m.content.slice(0, 240),
      timestamp: m.createdAt,
      status: "new",
    });
    if (alerts.length >= KEYWORD_ALERT_LIMIT) break;
  }
  return alerts;
}

// ----------------------------------------------------------------------------
// Summary stats
// ----------------------------------------------------------------------------
export async function getOversightStats(
  agencyId: string,
  keywords: OversightKeyword[]
): Promise<OversightStats> {
  const userIds = await getAgencyUserIds(agencyId);
  const today = startOfToday();
  const weekAgo = daysAgo(7);
  const dayAgo = daysAgo(1);

  const hasUsers = userIds.length > 0;

  const [
    actionsToday,
    actionsWeek,
    activeStaff,
    activeCreators,
    messagesToday,
    creatorMessagesToday,
    keywordAlertCount,
    pendingRequests,
    responseMetrics,
  ] = await Promise.all([
    hasUsers
      ? db.activityLog.count({
          where: { userId: { in: userIds }, createdAt: { gte: today } },
        })
      : Promise.resolve(0),
    hasUsers
      ? db.activityLog.count({
          where: { userId: { in: userIds }, createdAt: { gte: weekAgo } },
        })
      : Promise.resolve(0),
    db.user.count({ where: { agencyId, lastActiveAt: { gte: dayAgo } } }),
    db.creator.count({ where: { agencyId, lastLoginAt: { gte: dayAgo } } }),
    db.message.count({
      where: { conversation: { agencyId }, createdAt: { gte: today } },
    }),
    db.message.count({
      where: {
        conversation: { agencyId, type: ConversationType.CREATOR },
        createdAt: { gte: today },
      },
    }),
    keywords.length > 0
      ? db.message.count({
          where: {
            conversation: { agencyId },
            createdAt: { gte: weekAgo },
            OR: keywords.map((k) => ({
              content: { contains: k.keyword, mode: "insensitive" as const },
            })),
          },
        })
      : Promise.resolve(0),
    db.contentRequest.count({
      where: { agencyId, status: { in: PENDING_REQUEST_STATUSES } },
    }),
    getCreatorConversationResponseMetrics(agencyId),
  ]);

  const staffCreatorMessages = creatorMessagesToday;
  const staffStaffMessages = Math.max(messagesToday - creatorMessagesToday, 0);

  const allResponse = Array.from(responseMetrics.perStaff.values());

  return {
    totalActionsToday: actionsToday,
    totalActionsThisWeek: actionsWeek,
    activeStaffCount: activeStaff,
    activeCreatorCount: activeCreators,
    totalMessagesToday: messagesToday,
    staffCreatorMessages,
    staffStaffMessages,
    newKeywordAlerts: keywordAlertCount,
    newActivityAlerts: 0, // No unusual-activity detection model; never fabricated.
    pendingReviewCount: keywordAlertCount,
    averageResponseTime: avg(allResponse),
    pendingRequests,
  };
}
