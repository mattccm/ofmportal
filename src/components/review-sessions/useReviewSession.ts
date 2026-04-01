"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  SessionState,
  SessionEvent,
  ReviewVoteType,
  ParticipantJoinedEvent,
  ParticipantLeftEvent,
  VoteCastEvent,
  NavigationChangeEvent,
  ChatMessageEvent,
  SessionEndedEvent,
  SessionSummary,
} from "@/types/review-session";

export interface UseReviewSessionOptions {
  sessionId: string;
  userId: string;
  agencyId?: string;
  onParticipantJoined?: (event: ParticipantJoinedEvent) => void;
  onParticipantLeft?: (event: ParticipantLeftEvent) => void;
  onVoteCast?: (event: VoteCastEvent) => void;
  onNavigationChange?: (event: NavigationChangeEvent) => void;
  onChatMessage?: (event: ChatMessageEvent) => void;
  onSessionEnded?: (event: SessionEndedEvent) => void;
  onError?: (error: Error) => void;
  pollingInterval?: number;
}

export interface UseReviewSessionReturn {
  state: SessionState | null;
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
  sessionSummary: SessionSummary | null;
  // Actions
  joinSession: () => Promise<void>;
  castVote: (vote: ReviewVoteType, note?: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  navigateNext: () => Promise<void>;
  navigatePrevious: () => Promise<void>;
  navigateTo: (index: number) => Promise<void>;
  endSession: (status?: "COMPLETED" | "CANCELLED") => Promise<void>;
  leaveSession: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useReviewSession({
  sessionId,
  userId,
  agencyId = "agency_demo",
  onParticipantJoined,
  onParticipantLeft,
  onVoteCast,
  onNavigationChange,
  onChatMessage,
  onSessionEnded,
  onError,
  pollingInterval = 5000,
}: UseReviewSessionOptions): UseReviewSessionReturn {
  const [state, setState] = useState<SessionState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const usePolling = useRef(false);

  const headers = {
    "Content-Type": "application/json",
    "x-user-id": userId,
    "x-agency-id": agencyId,
  };

  // Fetch session state
  const fetchState = useCallback(async () => {
    try {
      const response = await fetch(`/api/review-sessions/${sessionId}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch session state");
      }

      const data = await response.json();
      setState(data.state);
      setError(null);
      return data.state;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      onError?.(error);
      throw error;
    }
  }, [sessionId, userId, agencyId, onError]);

  // Connect to SSE
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource(
        `/api/review-sessions/${sessionId}/stream`
      );

      eventSource.onopen = () => {
        setIsConnected(true);
        usePolling.current = false;
        // Stop polling if it was running
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();
        eventSourceRef.current = null;

        // Fall back to polling
        if (!usePolling.current) {
          usePolling.current = true;
          startPolling();
        }

        // Retry SSE after delay
        setTimeout(connectSSE, 10000);
      };

      // Event handlers
      eventSource.addEventListener("participant_joined", (e) => {
        const event: SessionEvent<ParticipantJoinedEvent> = JSON.parse(e.data);
        setState((prev) =>
          prev
            ? {
                ...prev,
                participants: [
                  ...prev.participants.filter(
                    (p) => p.userId !== event.data.participant.userId
                  ),
                  event.data.participant,
                ],
              }
            : prev
        );
        onParticipantJoined?.(event.data);
      });

      eventSource.addEventListener("participant_left", (e) => {
        const event: SessionEvent<ParticipantLeftEvent> = JSON.parse(e.data);
        setState((prev) =>
          prev
            ? {
                ...prev,
                participants: prev.participants.map((p) =>
                  p.userId === event.data.userId
                    ? { ...p, isActive: false, leftAt: new Date() }
                    : p
                ),
              }
            : prev
        );
        onParticipantLeft?.(event.data);
      });

      eventSource.addEventListener("vote_cast", (e) => {
        const event: SessionEvent<VoteCastEvent> = JSON.parse(e.data);
        setState((prev) => {
          if (!prev) return prev;
          const updatedVotes = [...prev.votes];
          const existingIndex = updatedVotes.findIndex(
            (v) =>
              v.uploadId === event.data.vote.uploadId &&
              v.userId === event.data.vote.userId
          );
          if (existingIndex >= 0) {
            updatedVotes[existingIndex] = event.data.vote;
          } else {
            updatedVotes.push(event.data.vote);
          }
          return {
            ...prev,
            votes: updatedVotes,
            voteSummary: event.data.summary,
          };
        });
        onVoteCast?.(event.data);
      });

      eventSource.addEventListener("navigation_change", (e) => {
        const event: SessionEvent<NavigationChangeEvent> = JSON.parse(e.data);
        setState((prev) =>
          prev
            ? {
                ...prev,
                session: {
                  ...prev.session,
                  currentUploadIndex: event.data.currentUploadIndex,
                },
                currentUpload: event.data.currentUpload,
                progress: event.data.progress,
                votes: [],
                voteSummary: {
                  uploadId: event.data.currentUpload.id,
                  approve: 0,
                  reject: 0,
                  discuss: 0,
                  skip: 0,
                  total: 0,
                  majority: null,
                  hasConsensus: false,
                  consensusThreshold: 0.5,
                  hasConflict: false,
                },
              }
            : prev
        );
        onNavigationChange?.(event.data);
      });

      eventSource.addEventListener("chat_message", (e) => {
        const event: SessionEvent<ChatMessageEvent> = JSON.parse(e.data);
        setState((prev) =>
          prev
            ? {
                ...prev,
                recentMessages: [...prev.recentMessages, event.data.message].slice(
                  -50
                ),
              }
            : prev
        );
        onChatMessage?.(event.data);
      });

      eventSource.addEventListener("session_ended", (e) => {
        const event: SessionEvent<SessionEndedEvent> = JSON.parse(e.data);
        setState((prev) =>
          prev
            ? {
                ...prev,
                session: {
                  ...prev.session,
                  status: event.data.status,
                  endedAt: event.data.endedAt,
                },
              }
            : prev
        );
        setSessionSummary(event.data.summary);
        onSessionEnded?.(event.data);
      });

      eventSourceRef.current = eventSource;
    } catch (err) {
      // SSE not supported, use polling
      usePolling.current = true;
      startPolling();
    }
  }, [
    sessionId,
    onParticipantJoined,
    onParticipantLeft,
    onVoteCast,
    onNavigationChange,
    onChatMessage,
    onSessionEnded,
  ]);

  // Polling fallback
  const startPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    pollingRef.current = setInterval(async () => {
      try {
        await fetchState();
        setIsConnected(true);
      } catch {
        setIsConnected(false);
      }
    }, pollingInterval);
  }, [fetchState, pollingInterval]);

  // Initialize
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        await fetchState();
        connectSSE();
      } finally {
        setIsLoading(false);
      }
    };

    init();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchState, connectSSE]);

  // Actions
  const joinSession = async () => {
    try {
      const response = await fetch(`/api/review-sessions/${sessionId}/join`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error("Failed to join session");
      }

      const data = await response.json();
      setState(data.state);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to join");
      setError(error);
      onError?.(error);
      throw error;
    }
  };

  const castVote = async (vote: ReviewVoteType, note?: string) => {
    if (!state?.currentUpload) {
      throw new Error("No content to vote on");
    }

    try {
      const response = await fetch(`/api/review-sessions/${sessionId}/vote`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          uploadId: state.currentUpload.id,
          vote,
          note,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to cast vote");
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to vote");
      setError(error);
      onError?.(error);
      throw error;
    }
  };

  const sendMessage = async (message: string) => {
    try {
      const response = await fetch(`/api/review-sessions/${sessionId}/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to send message");
      setError(error);
      onError?.(error);
      throw error;
    }
  };

  const navigateNext = async () => {
    try {
      const response = await fetch(`/api/review-sessions/${sessionId}/next`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "next" }),
      });

      if (!response.ok) {
        throw new Error("Failed to navigate");
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to navigate");
      setError(error);
      onError?.(error);
      throw error;
    }
  };

  const navigatePrevious = async () => {
    try {
      const response = await fetch(`/api/review-sessions/${sessionId}/next`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "previous" }),
      });

      if (!response.ok) {
        throw new Error("Failed to navigate");
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to navigate");
      setError(error);
      onError?.(error);
      throw error;
    }
  };

  const navigateTo = async (index: number) => {
    try {
      const response = await fetch(`/api/review-sessions/${sessionId}/next`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "goto", index }),
      });

      if (!response.ok) {
        throw new Error("Failed to navigate");
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to navigate");
      setError(error);
      onError?.(error);
      throw error;
    }
  };

  const endSession = async (status: "COMPLETED" | "CANCELLED" = "COMPLETED") => {
    try {
      const response = await fetch(`/api/review-sessions/${sessionId}/end`, {
        method: "POST",
        headers,
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Failed to end session");
      }

      const data = await response.json();
      setSessionSummary(data.summary);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to end session");
      setError(error);
      onError?.(error);
      throw error;
    }
  };

  const leaveSession = async () => {
    try {
      const response = await fetch(`/api/review-sessions/${sessionId}/leave`, {
        method: "POST",
        headers,
      });

      if (!response.ok) {
        throw new Error("Failed to leave session");
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to leave session");
      setError(error);
      onError?.(error);
      throw error;
    }
  };

  const refresh = async () => {
    await fetchState();
  };

  return {
    state,
    isConnected,
    isLoading,
    error,
    sessionSummary,
    joinSession,
    castVote,
    sendMessage,
    navigateNext,
    navigatePrevious,
    navigateTo,
    endSession,
    leaveSession,
    refresh,
  };
}

export default useReviewSession;
