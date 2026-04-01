"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Circle,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  StopCircle,
  LogOut,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Video,
  Image as ImageIcon,
  FileText,
  Clock,
  Users,
  Pencil,
  Mic,
  History,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { ParticipantsList } from "./ParticipantsList";
import { VotingPanel } from "./VotingPanel";
import { SessionChat } from "./SessionChat";
import { SessionSummary } from "./SessionSummary";
import { VoiceNoteRecorder } from "./VoiceNoteRecorder";
import { AutoAdvanceTimer } from "./AutoAdvanceTimer";
import { ConflictHighlight } from "./ConflictHighlight";
import { AnnotationCanvas } from "./AnnotationCanvas";
import { SessionHistoryViewer } from "./SessionHistoryViewer";
import { SessionAnnotation } from "@/types/review-session";
import {
  ReviewSessionViewProps,
  SessionState,
  SessionEvent,
  ReviewVoteType,
  ParticipantJoinedEvent,
  ParticipantLeftEvent,
  VoteCastEvent,
  NavigationChangeEvent,
  ChatMessageEvent,
  SessionEndedEvent,
  SessionSummary as SessionSummaryType,
} from "@/types/review-session";

export function ReviewSessionView({
  sessionId,
  userId,
  isHost,
}: ReviewSessionViewProps) {
  // State
  const [state, setState] = useState<SessionState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryType | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // New feature states
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [annotations, setAnnotations] = useState<SessionAnnotation[]>([]);
  const [showHistoryViewer, setShowHistoryViewer] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(false);
  const [autoAdvanceDuration, setAutoAdvanceDuration] = useState(60);

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastKnownIndexRef = useRef<number>(0);

  // Load session state
  const loadSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/review-sessions/${sessionId}`, {
        headers: {
          "x-user-id": userId,
          "x-agency-id": "agency_demo",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load session");
      }

      const data = await response.json();
      setState(data.state);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, userId]);

  // Connect to SSE stream
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(
      `/api/review-sessions/${sessionId}/stream`
    );

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      // Retry connection after delay
      setTimeout(connectSSE, 5000);
    };

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
              votes: [], // Reset votes for new upload
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
    });

    eventSource.addEventListener("chat_message", (e) => {
      const event: SessionEvent<ChatMessageEvent> = JSON.parse(e.data);
      setState((prev) =>
        prev
          ? {
              ...prev,
              recentMessages: [...prev.recentMessages, event.data.message].slice(-50),
            }
          : prev
      );
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
    });

    eventSourceRef.current = eventSource;
  }, [sessionId]);

  // Initialize
  useEffect(() => {
    loadSession();
    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [loadSession, connectSSE]);

  // Timer for elapsed time
  useEffect(() => {
    if (state?.session.startedAt && state.session.status === "ACTIVE") {
      const updateTimer = () => {
        const elapsed = Math.floor(
          (Date.now() - new Date(state.session.startedAt).getTime()) / 1000
        );
        setElapsedTime(elapsed);
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [state?.session.startedAt, state?.session.status]);

  // Actions
  const castVote = async (vote: ReviewVoteType, note?: string) => {
    if (!state?.currentUpload) return;

    setIsVoting(true);
    try {
      const response = await fetch(`/api/review-sessions/${sessionId}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
          "x-agency-id": "agency_demo",
        },
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
      setError(err instanceof Error ? err.message : "Failed to cast vote");
    } finally {
      setIsVoting(false);
    }
  };

  const sendMessage = async (message: string) => {
    const response = await fetch(`/api/review-sessions/${sessionId}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        "x-agency-id": "agency_demo",
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error("Failed to send message");
    }
  };

  const navigate = async (action: "next" | "previous") => {
    setIsNavigating(true);
    try {
      const response = await fetch(`/api/review-sessions/${sessionId}/next`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
          "x-agency-id": "agency_demo",
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error("Failed to navigate");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to navigate");
    } finally {
      setIsNavigating(false);
    }
  };

  const endSession = async () => {
    try {
      const response = await fetch(`/api/review-sessions/${sessionId}/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
          "x-agency-id": "agency_demo",
        },
        body: JSON.stringify({ status: "COMPLETED" }),
      });

      if (!response.ok) {
        throw new Error("Failed to end session");
      }

      const data = await response.json();
      setSessionSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end session");
    }
  };

  const leaveSession = async () => {
    try {
      await fetch(`/api/review-sessions/${sessionId}/leave`, {
        method: "POST",
        headers: {
          "x-user-id": userId,
          "x-agency-id": "agency_demo",
        },
      });
      // Redirect after leaving
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave session");
    }
  };

  // Voice note handler
  const sendVoiceNote = async (audioBlob: Blob, duration: number) => {
    if (!state?.currentUpload) return;

    const formData = new FormData();
    formData.append("audio", audioBlob, "voice-note.webm");
    formData.append("duration", duration.toString());
    formData.append("uploadId", state.currentUpload.id);

    const response = await fetch(`/api/review-sessions/${sessionId}/voice-note`, {
      method: "POST",
      headers: {
        "x-user-id": userId,
        "x-agency-id": "agency_demo",
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to send voice note");
    }
  };

  // Annotation handlers
  const loadAnnotations = async () => {
    if (!state?.currentUpload) return;

    try {
      const response = await fetch(
        `/api/review-sessions/${sessionId}/annotations?uploadId=${state.currentUpload.id}`,
        {
          headers: {
            "x-user-id": userId,
            "x-agency-id": "agency_demo",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAnnotations(data.annotations || []);
      }
    } catch (err) {
      console.error("Failed to load annotations:", err);
    }
  };

  const addAnnotation = async (annotation: Omit<SessionAnnotation, "id" | "createdAt">) => {
    try {
      const response = await fetch(`/api/review-sessions/${sessionId}/annotations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
          "x-agency-id": "agency_demo",
        },
        body: JSON.stringify(annotation),
      });

      if (response.ok) {
        const data = await response.json();
        setAnnotations((prev) => [...prev, data.annotation]);
      }
    } catch (err) {
      console.error("Failed to add annotation:", err);
    }
  };

  const deleteAnnotation = async (annotationId: string) => {
    try {
      const response = await fetch(
        `/api/review-sessions/${sessionId}/annotations?annotationId=${annotationId}`,
        {
          method: "DELETE",
          headers: {
            "x-user-id": userId,
            "x-agency-id": "agency_demo",
          },
        }
      );

      if (response.ok) {
        setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
      }
    } catch (err) {
      console.error("Failed to delete annotation:", err);
    }
  };

  const clearAnnotations = async () => {
    if (!state?.currentUpload) return;

    try {
      const response = await fetch(
        `/api/review-sessions/${sessionId}/annotations?uploadId=${state.currentUpload.id}`,
        {
          method: "DELETE",
          headers: {
            "x-user-id": userId,
            "x-agency-id": "agency_demo",
          },
        }
      );

      if (response.ok) {
        setAnnotations([]);
      }
    } catch (err) {
      console.error("Failed to clear annotations:", err);
    }
  };

  // Rejoin handler
  const rejoinSession = async () => {
    try {
      const response = await fetch(`/api/review-sessions/${sessionId}/rejoin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
          "x-agency-id": "agency_demo",
        },
        body: JSON.stringify({
          lastKnownIndex: lastKnownIndexRef.current,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setState(data.state);
        setIsDisconnected(false);
        setReconnectAttempts(0);
        // Reconnect to SSE
        connectSSE();
      }
    } catch (err) {
      setReconnectAttempts((prev) => prev + 1);
      console.error("Failed to rejoin session:", err);
    }
  };

  // Auto-advance timer handler
  const handleAutoAdvance = () => {
    if (state && state.progress.currentIndex < state.progress.totalItems - 1) {
      navigate("next");
    }
  };

  // Update last known index
  useEffect(() => {
    if (state) {
      lastKnownIndexRef.current = state.progress.currentIndex;
    }
  }, [state?.progress.currentIndex]);

  // Load annotations when current upload changes
  useEffect(() => {
    if (state?.currentUpload && showAnnotations) {
      loadAnnotations();
    }
  }, [state?.currentUpload?.id, showAnnotations]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType?.startsWith("video/")) return <Video className="h-8 w-8" />;
    if (fileType?.startsWith("image/")) return <ImageIcon className="h-8 w-8" />;
    return <FileText className="h-8 w-8" />;
  };

  // Get user's vote for current upload
  const userVote = state?.votes.find((v) => v.userId === userId)?.vote || null;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !state) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={loadSession}>Retry</Button>
        </div>
      </div>
    );
  }

  // Session ended - show summary
  if (sessionSummary) {
    return (
      <SessionSummary
        summary={sessionSummary}
        onClose={() => (window.location.href = "/dashboard")}
        onExport={() => {
          // TODO: Implement export functionality
          console.log("Export summary");
        }}
      />
    );
  }

  if (!state) return null;

  const { session, participants, currentUpload, voteSummary, progress, recentMessages } = state;
  const activeParticipants = participants.filter((p) => p.isActive);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b px-4 py-2 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Badge
            variant="destructive"
            className="gap-1 animate-pulse"
          >
            <Circle className="h-2 w-2 fill-current" />
            LIVE
          </Badge>
          <h1 className="font-semibold text-lg">{session.name}</h1>
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {activeParticipants.length}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {/* Disconnection Warning */}
          {isDisconnected && (
            <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
              <WifiOff className="h-3 w-3" />
              Disconnected
              <Button
                variant="ghost"
                size="sm"
                className="h-5 ml-1 px-1"
                onClick={rejoinSession}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </Badge>
          )}

          {/* Auto-advance Timer */}
          <AutoAdvanceTimer
            enabled={autoAdvanceEnabled}
            duration={autoAdvanceDuration}
            onAdvance={handleAutoAdvance}
            onSettingsChange={({ enabled, duration }) => {
              setAutoAdvanceEnabled(enabled);
              setAutoAdvanceDuration(duration);
            }}
            isHost={isHost}
            disabled={session.status !== "ACTIVE"}
            hasConflict={voteSummary?.hasConflict}
            autoAdvanceOnMajority={session.settings.autoAdvanceOnMajority as boolean}
            hasMajority={voteSummary?.hasConsensus}
          />

          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {formatTime(elapsedTime)}
          </div>
          <Separator orientation="vertical" className="h-6" />

          {/* History Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowHistoryViewer(true)}
            title="View session history"
          >
            <History className="h-4 w-4" />
          </Button>

          {isHost ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowEndConfirm(true)}
              className="gap-1"
            >
              <StopCircle className="h-4 w-4" />
              End Session
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLeaveConfirm(true)}
              className="gap-1"
            >
              <LogOut className="h-4 w-4" />
              Leave
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Participants */}
        <div className="w-64 border-r flex-shrink-0 hidden lg:flex flex-col">
          <ParticipantsList
            participants={participants}
            hostUserId={session.hostUserId}
            currentUserId={userId}
          />
        </div>

        {/* Center - Content Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Content Info Bar */}
          <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
            <div>
              <span className="text-sm text-muted-foreground">
                Reviewing: {progress.currentIndex + 1}/{progress.totalItems}
              </span>
              {currentUpload && (
                <span className="text-sm ml-2">
                  - <span className="font-medium">{currentUpload.originalName}</span>
                  <span className="text-muted-foreground ml-1">
                    by {currentUpload.creatorName}
                  </span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Annotation Toggle */}
              {currentUpload?.fileType?.startsWith("image/") && (
                <Button
                  variant={showAnnotations ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setShowAnnotations(!showAnnotations)}
                  className="gap-1"
                >
                  <Pencil className="h-4 w-4" />
                  {showAnnotations ? "Hide" : "Annotate"}
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Conflict Warning */}
          {voteSummary?.hasConflict && (
            <div className="px-4 py-2">
              <ConflictHighlight
                voteSummary={voteSummary}
                votes={state.votes}
                onRequestDiscussion={() => {
                  // Focus on chat and send a system message
                  sendMessage("[Discussion requested due to voting conflict]");
                }}
              />
            </div>
          )}

          {/* Content Preview */}
          <div className="flex-1 flex items-center justify-center p-4 bg-black/5 relative">
            {currentUpload ? (
              <div className="max-w-full max-h-full relative">
                {currentUpload.fileType?.startsWith("video/") ? (
                  <div className="relative">
                    <video
                      ref={videoRef}
                      src={currentUpload.storageUrl || undefined}
                      className="max-w-full max-h-[60vh] rounded-lg"
                      controls
                      muted={isMuted}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => setIsMuted(!isMuted)}
                    >
                      {isMuted ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ) : currentUpload.fileType?.startsWith("image/") ? (
                  showAnnotations ? (
                    <div className="relative" style={{ height: "60vh" }}>
                      <AnnotationCanvas
                        uploadId={currentUpload.id}
                        sessionId={sessionId}
                        imageUrl={currentUpload.storageUrl || currentUpload.thumbnailUrl || undefined}
                        annotations={annotations}
                        onAnnotationAdd={addAnnotation}
                        onAnnotationUpdate={() => {}}
                        onAnnotationDelete={deleteAnnotation}
                        onAnnotationClear={clearAnnotations}
                        userId={userId}
                        disabled={session.status !== "ACTIVE"}
                      />
                    </div>
                  ) : (
                    <img
                      src={currentUpload.storageUrl || currentUpload.thumbnailUrl || undefined}
                      alt={currentUpload.originalName}
                      className="max-w-full max-h-[60vh] rounded-lg object-contain"
                    />
                  )
                ) : (
                  <div className="bg-muted rounded-lg p-12 text-center">
                    {getFileIcon(currentUpload.fileType)}
                    <p className="mt-2 font-medium">{currentUpload.originalName}</p>
                    <p className="text-sm text-muted-foreground">
                      Preview not available
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                No content to review
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => navigate("previous")}
              disabled={
                isNavigating ||
                progress.currentIndex === 0 ||
                (!isHost && session.settings.onlyHostCanNavigate)
              }
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="flex-1 mx-8">
              <Progress value={progress.percentComplete} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>
                  {progress.approvedCount} approved, {progress.rejectedCount} rejected
                </span>
                <span>{progress.percentComplete}% complete</span>
              </div>
            </div>

            <Button
              onClick={() => navigate("next")}
              disabled={
                isNavigating ||
                progress.currentIndex === progress.totalItems - 1 ||
                (!isHost && session.settings.onlyHostCanNavigate)
              }
              className="gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Right Sidebar - Voting & Chat */}
        <div className="w-80 border-l flex-shrink-0 flex flex-col">
          {/* Voting Panel */}
          <div className="p-4 border-b">
            <VotingPanel
              currentUploadId={currentUpload?.id || null}
              userVote={userVote}
              voteSummary={voteSummary}
              isVoting={isVoting}
              onVote={castVote}
              disabled={session.status !== "ACTIVE"}
            />
          </div>

          {/* Chat */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <SessionChat
              sessionId={sessionId}
              messages={recentMessages}
              currentUserId={userId}
              onSendMessage={sendMessage}
              disabled={!session.settings.allowChat}
            />
            {/* Voice Note Recorder */}
            {session.settings.allowVoiceNotes && currentUpload && (
              <div className="px-3 pb-2 flex justify-end">
                <VoiceNoteRecorder
                  sessionId={sessionId}
                  uploadId={currentUpload.id}
                  onSendVoiceNote={sendVoiceNote}
                  disabled={session.status !== "ACTIVE"}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* End Session Confirmation */}
      <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End Review Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will end the session for all participants. You've reviewed{" "}
              {progress.reviewedCount} of {progress.totalItems} items. A summary
              will be generated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={endSession}>
              End Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Session Confirmation */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Session?</AlertDialogTitle>
            <AlertDialogDescription>
              You can rejoin the session later if it's still active. Your votes
              will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={leaveSession}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Session History Viewer */}
      <SessionHistoryViewer
        sessionId={sessionId}
        isOpen={showHistoryViewer}
        onClose={() => setShowHistoryViewer(false)}
      />
    </div>
  );
}

export default ReviewSessionView;
