"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Play,
  Radio,
  History,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  Plus,
  Calendar,
  BarChart3,
} from "lucide-react";
import { CreateSessionModal } from "@/components/review-sessions/CreateSessionModal";
import { ActiveSessionIndicator, CreateSessionRequest, CreateSessionResponse, ReviewUploadInfo } from "@/types/review-session";
import { formatDistanceToNow, format } from "date-fns";
import Link from "next/link";

// Mock data for demo
const mockUploads: ReviewUploadInfo[] = [
  {
    id: "upload_1",
    fileName: "photo_001.jpg",
    originalName: "Beach Photoshoot - Main.jpg",
    fileType: "image/jpeg",
    fileSize: 2500000,
    storageUrl: null,
    thumbnailUrl: null,
    metadata: {},
    creatorId: "creator_1",
    creatorName: "Sarah M.",
    requestId: "req_1",
    requestTitle: "Summer Beach Content",
    uploadedAt: new Date("2024-03-25"),
  },
  {
    id: "upload_2",
    fileName: "video_001.mp4",
    originalName: "Workout Routine.mp4",
    fileType: "video/mp4",
    fileSize: 45000000,
    storageUrl: null,
    thumbnailUrl: null,
    metadata: { duration: 120 },
    creatorId: "creator_2",
    creatorName: "Mike T.",
    requestId: "req_2",
    requestTitle: "Fitness Content March",
    uploadedAt: new Date("2024-03-24"),
  },
  {
    id: "upload_3",
    fileName: "photo_002.jpg",
    originalName: "Lifestyle Shot.jpg",
    fileType: "image/jpeg",
    fileSize: 3200000,
    storageUrl: null,
    thumbnailUrl: null,
    metadata: {},
    creatorId: "creator_1",
    creatorName: "Sarah M.",
    requestId: "req_1",
    requestTitle: "Summer Beach Content",
    uploadedAt: new Date("2024-03-25"),
  },
];

const mockTeamMembers = [
  { id: "user_1", name: "John Smith", email: "john@agency.com", avatar: null },
  { id: "user_2", name: "Jane Doe", email: "jane@agency.com", avatar: null },
  { id: "user_3", name: "Bob Wilson", email: "bob@agency.com", avatar: null },
];

interface SessionHistoryItem {
  id: string;
  name: string;
  status: "COMPLETED" | "CANCELLED";
  participantCount: number;
  totalItems: number;
  reviewedItems: number;
  approvedCount: number;
  rejectedCount: number;
  startedAt: Date;
  endedAt: Date;
  hostName: string;
}

export default function ReviewSessionsPage() {
  const [activeSessions, setActiveSessions] = useState<ActiveSessionIndicator[]>([]);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState("active");

  // Demo user
  const userId = "user_demo";
  const agencyId = "agency_demo";

  // Fetch sessions
  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoading(true);
      try {
        // Fetch active sessions
        const activeResponse = await fetch("/api/review-sessions?status=ACTIVE", {
          headers: {
            "x-user-id": userId,
            "x-agency-id": agencyId,
          },
        });
        if (activeResponse.ok) {
          const data = await activeResponse.json();
          setActiveSessions(data.sessions || []);
        }

        // Fetch completed sessions
        const historyResponse = await fetch("/api/review-sessions?status=COMPLETED&limit=20", {
          headers: {
            "x-user-id": userId,
            "x-agency-id": agencyId,
          },
        });
        if (historyResponse.ok) {
          const data = await historyResponse.json();
          // Mock history data for demo
          setSessionHistory([
            {
              id: "session_hist_1",
              name: "Weekly Content Review",
              status: "COMPLETED",
              participantCount: 4,
              totalItems: 25,
              reviewedItems: 25,
              approvedCount: 18,
              rejectedCount: 5,
              startedAt: new Date("2024-03-20T14:00:00"),
              endedAt: new Date("2024-03-20T15:30:00"),
              hostName: "John Smith",
            },
            {
              id: "session_hist_2",
              name: "March Batch Review",
              status: "COMPLETED",
              participantCount: 3,
              totalItems: 42,
              reviewedItems: 42,
              approvedCount: 35,
              rejectedCount: 4,
              startedAt: new Date("2024-03-18T10:00:00"),
              endedAt: new Date("2024-03-18T12:15:00"),
              hostName: "Jane Doe",
            },
          ]);
        }
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, []);

  const handleCreateSession = async (request: CreateSessionRequest): Promise<CreateSessionResponse> => {
    const response = await fetch("/api/review-sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        "x-agency-id": agencyId,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create session");
    }

    const data = await response.json();

    // Redirect to the new session
    window.location.href = `/review-sessions/${data.session.id}`;

    return data;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Live Review Sessions</h1>
          <p className="text-muted-foreground mt-1">
            Collaborate with your team to review content in real-time
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Start New Session
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {activeSessions.length}
              {activeSessions.length > 0 && (
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sessions This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessionHistory.length + activeSessions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Items Reviewed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sessionHistory.reduce((sum, s) => sum + s.reviewedItems, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approval Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sessionHistory.length > 0
                ? Math.round(
                    (sessionHistory.reduce((sum, s) => sum + s.approvedCount, 0) /
                      sessionHistory.reduce((sum, s) => sum + s.reviewedItems, 0)) *
                      100
                  )
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Radio className="h-4 w-4" />
            Active Sessions
            {activeSessions.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {activeSessions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Session History
          </TabsTrigger>
        </TabsList>

        {/* Active Sessions Tab */}
        <TabsContent value="active" className="mt-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-9 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : activeSessions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Radio className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Active Sessions</h3>
                <p className="text-muted-foreground mb-4">
                  Start a new review session to collaborate with your team in real-time.
                </p>
                <Button onClick={() => setShowCreateModal(true)} className="gap-2">
                  <Play className="h-4 w-4" />
                  Start New Session
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeSessions.map((session) => (
                <Card key={session.sessionId} className="hover:border-primary/50 transition-colors">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <Radio className="h-6 w-6 text-red-500 animate-pulse" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{session.sessionName}</h3>
                          <Badge variant="destructive" className="gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                            LIVE
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {session.participantCount} participants
                          </span>
                          <span>
                            Progress: {session.currentItemIndex + 1}/{session.totalItems}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            Started {formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Host: {session.hostName}
                        </p>
                      </div>
                      <Link href={`/review-sessions/${session.sessionId}`}>
                        <Button className="gap-2">
                          Join Session
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Session History Tab */}
        <TabsContent value="history" className="mt-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-64" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : sessionHistory.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Session History</h3>
                <p className="text-muted-foreground">
                  Completed review sessions will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sessionHistory.map((session) => (
                <Card key={session.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                          session.status === "COMPLETED"
                            ? "bg-green-100"
                            : "bg-gray-100"
                        }`}
                      >
                        {session.status === "COMPLETED" ? (
                          <CheckCircle className="h-6 w-6 text-green-500" />
                        ) : (
                          <XCircle className="h-6 w-6 text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{session.name}</h3>
                          <Badge variant={session.status === "COMPLETED" ? "default" : "secondary"}>
                            {session.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {session.participantCount}
                          </span>
                          <span>
                            {session.reviewedItems}/{session.totalItems} reviewed
                          </span>
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-3.5 w-3.5" />
                            {session.approvedCount}
                          </span>
                          <span className="flex items-center gap-1 text-red-600">
                            <XCircle className="h-3.5 w-3.5" />
                            {session.rejectedCount}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(session.startedAt), "MMM d, yyyy 'at' h:mm a")}
                          <span className="text-muted-foreground">
                            ({formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })})
                          </span>
                        </div>
                      </div>
                      <Button variant="outline" className="gap-2">
                        <BarChart3 className="h-4 w-4" />
                        View Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Session Modal */}
      <CreateSessionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateSession={handleCreateSession}
        availableUploads={mockUploads}
        teamMembers={mockTeamMembers}
      />
    </div>
  );
}
