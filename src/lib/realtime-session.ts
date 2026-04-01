// Real-time Session Infrastructure
// Server-Sent Events (SSE) based real-time sync for live review sessions

import {
  SessionState,
  SessionEvent,
  SessionEventType,
  ReviewSession,
  ReviewSessionParticipantWithUser,
  ReviewSessionVoteWithUser,
  ReviewSessionChatWithUser,
  ReviewUploadInfo,
  VoteSummary,
  SessionProgress,
  ReviewVoteType,
  ParticipantJoinedEvent,
  ParticipantLeftEvent,
  VoteCastEvent,
  NavigationChangeEvent,
  ChatMessageEvent,
  SessionEndedEvent,
  SessionSummary,
} from "@/types/review-session";

// ============================================
// In-Memory Session Store (for real-time sync)
// In production, use Redis or similar
// ============================================

interface SessionStoreEntry {
  state: SessionState;
  lastUpdated: Date;
  subscribers: Set<(event: SessionEvent) => void>;
}

class SessionStore {
  private sessions = new Map<string, SessionStoreEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly SESSION_TTL = 1000 * 60 * 60 * 4; // 4 hours

  constructor() {
    // Start cleanup interval
    this.startCleanup();
  }

  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      this.sessions.forEach((entry, sessionId) => {
        const age = now - entry.lastUpdated.getTime();
        if (age > this.SESSION_TTL || entry.state.session.status === "COMPLETED") {
          this.sessions.delete(sessionId);
        }
      });
    }, 1000 * 60 * 15); // Clean every 15 minutes
  }

  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  getSession(sessionId: string): SessionState | null {
    return this.sessions.get(sessionId)?.state ?? null;
  }

  setSession(sessionId: string, state: SessionState): void {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      existing.state = state;
      existing.lastUpdated = new Date();
    } else {
      this.sessions.set(sessionId, {
        state,
        lastUpdated: new Date(),
        subscribers: new Set(),
      });
    }
  }

  updateSession(sessionId: string, updates: Partial<SessionState>): SessionState | null {
    const entry = this.sessions.get(sessionId);
    if (!entry) return null;

    entry.state = { ...entry.state, ...updates };
    entry.lastUpdated = new Date();
    return entry.state;
  }

  deleteSession(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      // Notify all subscribers of session end
      entry.subscribers.forEach((callback) => {
        callback({
          type: "session_ended",
          timestamp: new Date(),
          data: { status: "COMPLETED", endedAt: new Date() },
        });
      });
      this.sessions.delete(sessionId);
    }
  }

  subscribe(sessionId: string, callback: (event: SessionEvent) => void): () => void {
    let entry = this.sessions.get(sessionId);
    if (!entry) {
      // Create placeholder entry
      entry = {
        state: null as unknown as SessionState,
        lastUpdated: new Date(),
        subscribers: new Set(),
      };
      this.sessions.set(sessionId, entry);
    }

    entry.subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      entry?.subscribers.delete(callback);
    };
  }

  broadcast(sessionId: string, event: SessionEvent): void {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.subscribers.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error("Error broadcasting to subscriber:", error);
        }
      });
    }
  }

  getSubscriberCount(sessionId: string): number {
    return this.sessions.get(sessionId)?.subscribers.size ?? 0;
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys()).filter((id) => {
      const state = this.sessions.get(id)?.state;
      return state && state.session.status === "ACTIVE";
    });
  }
}

// Global session store instance
export const sessionStore = new SessionStore();

// ============================================
// Event Emitters
// ============================================

export function emitParticipantJoined(
  sessionId: string,
  participant: ReviewSessionParticipantWithUser
): void {
  const state = sessionStore.getSession(sessionId);
  if (!state) return;

  const event: SessionEvent<ParticipantJoinedEvent> = {
    type: "participant_joined",
    timestamp: new Date(),
    data: {
      participant,
      participantCount: state.participants.filter((p) => p.isActive).length,
    },
  };

  sessionStore.broadcast(sessionId, event);
}

export function emitParticipantLeft(sessionId: string, userId: string): void {
  const state = sessionStore.getSession(sessionId);
  if (!state) return;

  const event: SessionEvent<ParticipantLeftEvent> = {
    type: "participant_left",
    timestamp: new Date(),
    data: {
      userId,
      participantCount: state.participants.filter((p) => p.isActive).length,
    },
  };

  sessionStore.broadcast(sessionId, event);
}

export function emitVoteCast(
  sessionId: string,
  vote: ReviewSessionVoteWithUser,
  summary: VoteSummary
): void {
  const event: SessionEvent<VoteCastEvent> = {
    type: "vote_cast",
    timestamp: new Date(),
    data: { vote, summary },
  };

  sessionStore.broadcast(sessionId, event);
}

export function emitNavigationChange(
  sessionId: string,
  currentUploadIndex: number,
  currentUpload: ReviewUploadInfo,
  progress: SessionProgress
): void {
  const event: SessionEvent<NavigationChangeEvent> = {
    type: "navigation_change",
    timestamp: new Date(),
    data: { currentUploadIndex, currentUpload, progress },
  };

  sessionStore.broadcast(sessionId, event);
}

export function emitChatMessage(sessionId: string, message: ReviewSessionChatWithUser): void {
  const event: SessionEvent<ChatMessageEvent> = {
    type: "chat_message",
    timestamp: new Date(),
    data: { message },
  };

  sessionStore.broadcast(sessionId, event);
}

export function emitSessionEnded(
  sessionId: string,
  status: "COMPLETED" | "CANCELLED",
  summary: SessionSummary
): void {
  const event: SessionEvent<SessionEndedEvent> = {
    type: "session_ended",
    timestamp: new Date(),
    data: { status, endedAt: new Date(), summary },
  };

  sessionStore.broadcast(sessionId, event);
}

export function emitSessionUpdate(sessionId: string, state: SessionState): void {
  const event: SessionEvent<SessionState> = {
    type: "session_update",
    timestamp: new Date(),
    data: state,
  };

  sessionStore.broadcast(sessionId, event);
}

// ============================================
// Vote Summary Calculator
// ============================================

export function calculateVoteSummary(
  votes: ReviewSessionVoteWithUser[],
  uploadId: string,
  consensusThreshold: number = 0.5
): VoteSummary {
  const uploadVotes = votes.filter((v) => v.uploadId === uploadId);
  const approve = uploadVotes.filter((v) => v.vote === "APPROVE").length;
  const reject = uploadVotes.filter((v) => v.vote === "REJECT").length;
  const discuss = uploadVotes.filter((v) => v.vote === "DISCUSS").length;
  const skip = uploadVotes.filter((v) => v.vote === "SKIP").length;
  const total = uploadVotes.length;

  // Determine majority (excluding skips)
  const votingTotal = approve + reject + discuss;
  let majority: ReviewVoteType | null = null;
  let hasConsensus = false;

  if (votingTotal > 0) {
    const maxVotes = Math.max(approve, reject, discuss);
    if (approve === maxVotes) majority = "APPROVE";
    else if (reject === maxVotes) majority = "REJECT";
    else if (discuss === maxVotes) majority = "DISCUSS";

    // Check for consensus
    if (majority) {
      const majorityVotes = majority === "APPROVE" ? approve : majority === "REJECT" ? reject : discuss;
      hasConsensus = majorityVotes / votingTotal >= consensusThreshold;
    }
  }

  // Determine if there's a conflict (significant disagreement)
  const hasConflict = approve > 0 && reject > 0 && Math.abs(approve - reject) <= 1;
  let conflictType: "approve_reject" | "approve_discuss" | "reject_discuss" | "three_way" | undefined;
  let conflictSeverity: "low" | "medium" | "high" | undefined;

  if (hasConflict) {
    if (approve > 0 && reject > 0 && discuss > 0) {
      conflictType = "three_way";
      conflictSeverity = "high";
    } else if (approve > 0 && reject > 0) {
      conflictType = "approve_reject";
      conflictSeverity = Math.abs(approve - reject) === 0 ? "high" : "medium";
    } else if (approve > 0 && discuss > 0) {
      conflictType = "approve_discuss";
      conflictSeverity = "low";
    } else if (reject > 0 && discuss > 0) {
      conflictType = "reject_discuss";
      conflictSeverity = "medium";
    }
  }

  return {
    uploadId,
    approve,
    reject,
    discuss,
    skip,
    total,
    majority,
    hasConsensus,
    consensusThreshold,
    hasConflict,
    conflictType,
    conflictSeverity,
  };
}

// ============================================
// Progress Calculator
// ============================================

export function calculateSessionProgress(
  session: ReviewSession,
  votes: ReviewSessionVoteWithUser[],
  participantCount: number
): SessionProgress {
  const totalItems = session.uploadIds.length;
  const currentIndex = session.currentUploadIndex;

  // Count items with at least one vote
  const votedUploadIds = new Set(votes.map((v) => v.uploadId));
  const reviewedCount = votedUploadIds.size;

  // Count decisions
  let approvedCount = 0;
  let rejectedCount = 0;
  let discussCount = 0;

  session.uploadIds.forEach((uploadId) => {
    const summary = calculateVoteSummary(votes, uploadId);
    if (summary.hasConsensus && summary.majority) {
      if (summary.majority === "APPROVE") approvedCount++;
      else if (summary.majority === "REJECT") rejectedCount++;
      else if (summary.majority === "DISCUSS") discussCount++;
    }
  });

  const percentComplete = totalItems > 0 ? Math.round((reviewedCount / totalItems) * 100) : 0;
  const elapsedTime = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);

  return {
    currentIndex,
    totalItems,
    reviewedCount,
    approvedCount,
    rejectedCount,
    discussCount,
    percentComplete,
    elapsedTime,
  };
}

// ============================================
// Session State Builder
// ============================================

export function buildSessionState(
  session: ReviewSession,
  participants: ReviewSessionParticipantWithUser[],
  votes: ReviewSessionVoteWithUser[],
  messages: ReviewSessionChatWithUser[],
  currentUpload: ReviewUploadInfo | null
): SessionState {
  const currentUploadId = session.uploadIds[session.currentUploadIndex] || null;
  const voteSummary = currentUploadId
    ? calculateVoteSummary(votes, currentUploadId)
    : {
        uploadId: "",
        approve: 0,
        reject: 0,
        discuss: 0,
        skip: 0,
        total: 0,
        majority: null,
        hasConsensus: false,
        consensusThreshold: 0.5,
        hasConflict: false,
      };

  const activeParticipantCount = participants.filter((p) => p.isActive).length;
  const progress = calculateSessionProgress(session, votes, activeParticipantCount);

  return {
    session,
    participants,
    currentUpload,
    votes: votes.filter((v) => v.uploadId === currentUploadId),
    recentMessages: messages.slice(-50), // Last 50 messages
    voteSummary,
    progress,
  };
}

// ============================================
// SSE Stream Creator
// ============================================

export function createSSEStream(sessionId: string): ReadableStream {
  let unsubscribe: (() => void) | null = null;
  let pingInterval: NodeJS.Timeout | null = null;

  return new ReadableStream({
    start(controller) {
      // Send initial connection event
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ sessionId })}\n\n`));

      // Subscribe to session events
      unsubscribe = sessionStore.subscribe(sessionId, (event: SessionEvent) => {
        try {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${data}\n\n`));
        } catch (error) {
          console.error("Error sending SSE event:", error);
        }
      });

      // Send ping every 30 seconds to keep connection alive
      pingInterval = setInterval(() => {
        try {
          const pingEvent: SessionEvent = {
            type: "ping",
            timestamp: new Date(),
            data: { sessionId },
          };
          controller.enqueue(encoder.encode(`event: ping\ndata: ${JSON.stringify(pingEvent)}\n\n`));
        } catch {
          // Connection might be closed
        }
      }, 30000);
    },

    cancel() {
      if (unsubscribe) {
        unsubscribe();
      }
      if (pingInterval) {
        clearInterval(pingInterval);
      }
    },
  });
}

// ============================================
// Session Summary Generator
// ============================================

export function generateSessionSummary(
  session: ReviewSession,
  participants: ReviewSessionParticipantWithUser[],
  votes: ReviewSessionVoteWithUser[],
  messages: ReviewSessionChatWithUser[],
  uploads: ReviewUploadInfo[]
): SessionSummary {
  const endedAt = session.endedAt || new Date();
  const duration = Math.floor((endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000);

  // Generate decisions for each upload
  const decisions = uploads.map((upload) => {
    const summary = calculateVoteSummary(votes, upload.id);
    const uploadVotes = votes.filter((v) => v.uploadId === upload.id);
    const notes = uploadVotes.filter((v) => v.note).map((v) => v.note as string);

    return {
      uploadId: upload.id,
      uploadName: upload.originalName,
      creatorName: upload.creatorName,
      thumbnailUrl: upload.thumbnailUrl,
      decision: summary.hasConsensus && summary.majority ? summary.majority : ("PENDING" as const),
      voteBreakdown: {
        approve: summary.approve,
        reject: summary.reject,
        discuss: summary.discuss,
        skip: summary.skip,
      },
      notes,
    };
  });

  // Generate participant stats
  const participantStats = participants.map((participant) => {
    const userVotes = votes.filter((v) => v.userId === participant.userId);
    const userMessages = messages.filter((m) => m.userId === participant.userId);
    const leftAt = participant.leftAt || endedAt;
    const participationDuration = Math.floor(
      (leftAt.getTime() - new Date(participant.joinedAt).getTime()) / 1000
    );

    return {
      userId: participant.userId,
      userName: participant.user.name,
      userAvatar: participant.user.avatar,
      role: participant.role,
      joinedAt: participant.joinedAt,
      leftAt: participant.leftAt,
      totalVotes: userVotes.length,
      approveVotes: userVotes.filter((v) => v.vote === "APPROVE").length,
      rejectVotes: userVotes.filter((v) => v.vote === "REJECT").length,
      discussVotes: userVotes.filter((v) => v.vote === "DISCUSS").length,
      messagesCount: userMessages.length,
      participationDuration,
    };
  });

  return {
    sessionId: session.id,
    sessionName: session.name,
    duration,
    totalItems: session.uploadIds.length,
    reviewedItems: new Set(votes.map((v) => v.uploadId)).size,
    participantCount: participants.length,
    totalVotes: votes.length,
    decisions,
    participantStats,
  };
}

// ============================================
// Polling Fallback for SSE
// ============================================

export interface PollResponse {
  state: SessionState | null;
  lastEventTimestamp: Date;
}

export function getPollingState(
  sessionId: string,
  lastEventTimestamp?: Date
): PollResponse {
  const state = sessionStore.getSession(sessionId);

  return {
    state,
    lastEventTimestamp: new Date(),
  };
}

// ============================================
// Client-Side Hooks Types
// ============================================

export interface UseReviewSessionOptions {
  sessionId: string;
  userId: string;
  onParticipantJoined?: (event: ParticipantJoinedEvent) => void;
  onParticipantLeft?: (event: ParticipantLeftEvent) => void;
  onVoteCast?: (event: VoteCastEvent) => void;
  onNavigationChange?: (event: NavigationChangeEvent) => void;
  onChatMessage?: (event: ChatMessageEvent) => void;
  onSessionEnded?: (event: SessionEndedEvent) => void;
  onError?: (error: Error) => void;
  pollingInterval?: number; // Fallback polling interval in ms
}

export interface UseReviewSessionReturn {
  state: SessionState | null;
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
  // Actions
  castVote: (vote: ReviewVoteType, note?: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  navigateNext: () => Promise<void>;
  navigatePrevious: () => Promise<void>;
  navigateTo: (index: number) => Promise<void>;
  endSession: (status?: "COMPLETED" | "CANCELLED") => Promise<void>;
  leaveSession: () => Promise<void>;
}
