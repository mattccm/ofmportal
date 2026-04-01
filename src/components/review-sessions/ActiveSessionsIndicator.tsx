"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Circle, Radio, Users, Clock, ChevronRight } from "lucide-react";
import { ActiveSessionIndicator } from "@/types/review-session";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface ActiveSessionsIndicatorProps {
  userId: string;
  agencyId?: string;
  pollInterval?: number;
}

export function ActiveSessionsIndicator({
  userId,
  agencyId = "agency_demo",
  pollInterval = 30000,
}: ActiveSessionsIndicatorProps) {
  const [sessions, setSessions] = useState<ActiveSessionIndicator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch active sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch("/api/review-sessions?status=ACTIVE&limit=5", {
          headers: {
            "x-user-id": userId,
            "x-agency-id": agencyId,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setSessions(data.sessions || []);
        }
      } catch (error) {
        console.error("Failed to fetch active sessions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
    const interval = setInterval(fetchSessions, pollInterval);
    return () => clearInterval(interval);
  }, [userId, agencyId, pollInterval]);

  if (isLoading || sessions.length === 0) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
        >
          <span className="relative">
            <Radio className="h-4 w-4" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          </span>
          <span className="hidden sm:inline">Live Sessions</span>
          <Badge variant="secondary" className="h-5 text-xs">
            {sessions.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h4 className="font-semibold flex items-center gap-2">
            <Circle className="h-2 w-2 fill-red-500 text-red-500 animate-pulse" />
            Active Review Sessions
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Join an ongoing session to participate in the review
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {sessions.map((session) => (
            <Link
              key={session.sessionId}
              href={`/review-sessions/${session.sessionId}`}
              className="flex items-center gap-3 p-3 hover:bg-accent border-b last:border-b-0 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Radio className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {session.sessionName}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                <div className="text-xs text-muted-foreground">
                  Host: {session.hostName}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </Link>
          ))}
        </div>
        {sessions.length > 0 && (
          <div className="p-2 border-t bg-muted/30">
            <Link href="/review-sessions">
              <Button variant="ghost" size="sm" className="w-full text-xs">
                View All Sessions
              </Button>
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default ActiveSessionsIndicator;
