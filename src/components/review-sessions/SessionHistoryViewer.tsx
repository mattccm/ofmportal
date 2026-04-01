"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  History,
  Play,
  Clock,
  Users,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Mic,
  UserPlus,
  UserMinus,
  FileText,
  BarChart3,
  Download,
  ChevronRight,
  Flag,
  AlertTriangle,
} from "lucide-react";
import {
  SessionRecording,
  SessionRecordingEvent,
  SessionAnalytics,
  ReviewUploadInfo,
} from "@/types/review-session";
import { format, formatDistanceToNow } from "date-fns";

interface SessionHistoryViewerProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface SessionHistoryData {
  recording: SessionRecording;
  session: {
    id: string;
    name: string;
    description?: string;
    status: string;
    hostUserId: string;
    hostName: string;
    startedAt: Date;
    endedAt?: Date;
    settings: Record<string, unknown>;
  };
  uploads: ReviewUploadInfo[];
  analytics: SessionAnalytics | null;
}

export function SessionHistoryViewer({
  sessionId,
  isOpen,
  onClose,
}: SessionHistoryViewerProps) {
  const [data, setData] = useState<SessionHistoryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("timeline");

  // Demo user
  const userId = "user_demo";
  const agencyId = "agency_demo";

  useEffect(() => {
    if (isOpen && sessionId) {
      fetchHistory();
    }
  }, [isOpen, sessionId]);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/review-sessions/${sessionId}/history?analytics=true`,
        {
          headers: {
            "x-user-id": userId,
            "x-agency-id": agencyId,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch session history");
      }

      const historyData = await response.json();
      setData(historyData);
    } catch (err) {
      console.error("Error fetching history:", err);
      setError("Failed to load session history");
    } finally {
      setIsLoading(false);
    }
  };

  const getEventIcon = (type: SessionRecordingEvent["type"]) => {
    switch (type) {
      case "session_started":
        return <Play className="h-4 w-4 text-green-500" />;
      case "session_ended":
        return <Flag className="h-4 w-4 text-red-500" />;
      case "participant_joined":
        return <UserPlus className="h-4 w-4 text-blue-500" />;
      case "participant_left":
        return <UserMinus className="h-4 w-4 text-gray-500" />;
      case "vote_cast":
        const vote = (type as unknown as { data?: { vote?: string } })?.data?.vote;
        if (vote === "APPROVE") return <ThumbsUp className="h-4 w-4 text-green-500" />;
        if (vote === "REJECT") return <ThumbsDown className="h-4 w-4 text-red-500" />;
        return <MessageSquare className="h-4 w-4 text-amber-500" />;
      case "chat_message":
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case "voice_note":
        return <Mic className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEventDescription = (event: SessionRecordingEvent) => {
    const eventData = event.data as Record<string, unknown>;
    switch (event.type) {
      case "session_started":
        return `Session started by ${eventData.hostName}`;
      case "session_ended":
        return `Session ${eventData.status === "COMPLETED" ? "completed" : "cancelled"}`;
      case "participant_joined":
        return `${eventData.userName} joined as ${eventData.role}`;
      case "participant_left":
        return `${eventData.userName} left the session`;
      case "vote_cast":
        return `${eventData.userName} voted ${eventData.vote} on "${eventData.uploadName}"`;
      case "chat_message":
        return `${eventData.userName}: ${eventData.message}`;
      case "voice_note":
        return `${eventData.userName} sent a voice note (${eventData.voiceNoteDuration}s)`;
      default:
        return "Unknown event";
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const handleExport = () => {
    if (!data) return;

    const exportData = {
      session: data.session,
      recording: data.recording,
      analytics: data.analytics,
      uploads: data.uploads,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${sessionId}-history.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Session History
            {data && (
              <Badge variant={data.session.status === "COMPLETED" ? "default" : "secondary"}>
                {data.session.status}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {data
              ? `${data.session.name} - ${format(
                  new Date(data.session.startedAt),
                  "MMM d, yyyy 'at' h:mm a"
                )}`
              : "Loading session history..."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            {error}
            <Button variant="link" onClick={fetchHistory} className="ml-2">
              Retry
            </Button>
          </div>
        ) : data ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Stats Summary */}
            <div className="grid grid-cols-4 gap-3 p-4 bg-muted/30 rounded-lg mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {formatDuration(data.recording.metadata.totalDuration)}
                </div>
                <div className="text-xs text-muted-foreground">Duration</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{data.recording.metadata.participantCount}</div>
                <div className="text-xs text-muted-foreground">Participants</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{data.recording.metadata.totalVotes}</div>
                <div className="text-xs text-muted-foreground">Votes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{data.uploads.length}</div>
                <div className="text-xs text-muted-foreground">Items</div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="timeline" className="gap-2">
                  <History className="h-4 w-4" />
                  Timeline
                </TabsTrigger>
                <TabsTrigger value="analytics" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="items" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Items
                </TabsTrigger>
              </TabsList>

              {/* Timeline Tab */}
              <TabsContent value="timeline" className="flex-1 overflow-hidden mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {data.recording.events.map((event, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50"
                      >
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          {getEventIcon(event.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{getEventDescription(event)}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(event.timestamp), "h:mm:ss a")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Analytics Tab */}
              <TabsContent value="analytics" className="flex-1 overflow-hidden mt-4">
                {data.analytics ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-6 pr-4">
                      {/* Agreement Rate */}
                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2">
                          Agreement Rate
                          <Badge variant="outline">
                            {Math.round(data.analytics.agreementRate)}%
                          </Badge>
                        </h4>
                        <Progress value={data.analytics.agreementRate} className="h-2" />
                      </div>

                      {/* Vote Distribution */}
                      <div className="space-y-2">
                        <h4 className="font-medium">Vote Distribution</h4>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="bg-green-100 rounded p-2 text-center">
                            <div className="text-lg font-bold text-green-700">
                              {data.analytics.voteDistribution.approve}
                            </div>
                            <div className="text-xs text-green-600">Approve</div>
                          </div>
                          <div className="bg-red-100 rounded p-2 text-center">
                            <div className="text-lg font-bold text-red-700">
                              {data.analytics.voteDistribution.reject}
                            </div>
                            <div className="text-xs text-red-600">Reject</div>
                          </div>
                          <div className="bg-amber-100 rounded p-2 text-center">
                            <div className="text-lg font-bold text-amber-700">
                              {data.analytics.voteDistribution.discuss}
                            </div>
                            <div className="text-xs text-amber-600">Discuss</div>
                          </div>
                          <div className="bg-gray-100 rounded p-2 text-center">
                            <div className="text-lg font-bold text-gray-700">
                              {data.analytics.voteDistribution.skip}
                            </div>
                            <div className="text-xs text-gray-600">Skip</div>
                          </div>
                        </div>
                      </div>

                      {/* Conflicts */}
                      {data.analytics.conflictItems.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            Conflict Items ({data.analytics.conflictItems.length})
                          </h4>
                          <div className="space-y-2">
                            {data.analytics.conflictItems.map((item) => (
                              <div
                                key={item.uploadId}
                                className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200"
                              >
                                <FileText className="h-4 w-4 text-amber-600" />
                                <span className="text-sm flex-1 truncate">{item.uploadName}</span>
                                <Badge variant="outline" className="text-xs">
                                  {item.conflictType.replace("_", " vs ")}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Participant Engagement */}
                      <div className="space-y-2">
                        <h4 className="font-medium">Participant Engagement</h4>
                        <div className="space-y-2">
                          {data.analytics.participantEngagement.map((p) => (
                            <div
                              key={p.userId}
                              className="flex items-center gap-3 p-2 bg-muted/50 rounded"
                            >
                              <div className="flex-1">
                                <div className="font-medium text-sm">{p.userName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {Math.round(p.participationRate)}% participation
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-green-600">{p.votingPattern.approve}A</span>
                                <span className="text-red-600">{p.votingPattern.reject}R</span>
                                <span className="text-amber-600">{p.votingPattern.discuss}D</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Analytics not available
                  </div>
                )}
              </TabsContent>

              {/* Items Tab */}
              <TabsContent value="items" className="flex-1 overflow-hidden mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2 pr-4">
                    {data.uploads.map((upload, index) => (
                      <div
                        key={upload.id}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50"
                      >
                        <div className="text-sm text-muted-foreground w-6">#{index + 1}</div>
                        {upload.thumbnailUrl ? (
                          <img
                            src={upload.thumbnailUrl}
                            alt=""
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{upload.originalName}</div>
                          <div className="text-xs text-muted-foreground">
                            by {upload.creatorName}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {/* Export Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" onClick={handleExport} className="gap-2">
                <Download className="h-4 w-4" />
                Export History
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default SessionHistoryViewer;
