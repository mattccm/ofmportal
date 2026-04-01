"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Radio,
  Play,
  Users,
  Clock,
  ChevronRight,
  Plus,
} from "lucide-react";
import { ActiveSessionIndicator } from "@/types/review-session";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface ReviewSessionsWidgetProps {
  userId: string;
  agencyId?: string;
  maxSessions?: number;
}

export function ReviewSessionsWidget({
  userId,
  agencyId = "agency_demo",
  maxSessions = 3,
}: ReviewSessionsWidgetProps) {
  const [sessions, setSessions] = useState<ActiveSessionIndicator[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch(
          `/api/review-sessions?status=ACTIVE&limit=${maxSessions}`,
          {
            headers: {
              "x-user-id": userId,
              "x-agency-id": agencyId,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setSessions(data.sessions || []);
        }
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, [userId, agencyId, maxSessions]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Live Review Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              Live Review Sessions
            </CardTitle>
            {sessions.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                {sessions.length} Live
              </Badge>
            )}
          </div>
          <Link href="/review-sessions">
            <Button variant="ghost" size="sm" className="gap-1">
              View All
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <CardDescription>
          Collaborate with your team on content reviews
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-center py-6">
            <Radio className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              No active review sessions
            </p>
            <Link href="/review-sessions">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Start Session
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Link
                key={session.sessionId}
                href={`/review-sessions/${session.sessionId}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Radio className="h-5 w-5 text-red-500 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{session.sessionName}</div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {session.participantCount}
                    </span>
                    <span>
                      {session.currentItemIndex + 1}/{session.totalItems}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(session.startedAt), { addSuffix: false })}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  Join
                </Button>
              </Link>
            ))}

            <Link href="/review-sessions" className="block">
              <Button variant="outline" className="w-full gap-2 mt-2">
                <Play className="h-4 w-4" />
                Start New Session
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ReviewSessionsWidget;
