"use client";

import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Crown, Eye, Users, Clock } from "lucide-react";
import { ParticipantsListProps, SessionParticipantRole } from "@/types/review-session";
import { formatDistanceToNow } from "date-fns";

export function ParticipantsList({
  participants,
  hostUserId,
  currentUserId,
}: ParticipantsListProps) {
  const activeParticipants = participants.filter((p) => p.isActive);
  const inactiveParticipants = participants.filter((p) => !p.isActive);

  const getRoleBadge = (role: SessionParticipantRole, userId: string) => {
    if (userId === hostUserId) {
      return (
        <Badge variant="default" className="gap-1 h-5 text-xs">
          <Crown className="h-3 w-3" />
          Host
        </Badge>
      );
    }
    if (role === "OBSERVER") {
      return (
        <Badge variant="secondary" className="gap-1 h-5 text-xs">
          <Eye className="h-3 w-3" />
          Observer
        </Badge>
      );
    }
    return null;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">Participants</span>
        <Badge variant="secondary" className="h-5 text-xs ml-auto">
          {activeParticipants.length} online
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Active participants */}
          {activeParticipants.map((participant) => (
            <TooltipProvider key={participant.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`flex items-center gap-2 p-2 rounded-md hover:bg-accent ${
                      participant.userId === currentUserId ? "bg-accent/50" : ""
                    }`}
                  >
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={participant.user.avatar || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(participant.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium truncate">
                          {participant.user.name}
                          {participant.userId === currentUserId && (
                            <span className="text-muted-foreground"> (you)</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{participant.votesCount} votes</span>
                      </div>
                    </div>
                    {getRoleBadge(participant.role, participant.userId)}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <div className="space-y-1">
                    <p className="font-medium">{participant.user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {participant.user.email}
                    </p>
                    <div className="flex items-center gap-2 text-xs">
                      <span>Votes: {participant.votesCount}</span>
                      <span>Messages: {participant.messagesCount}</span>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Joined {formatDistanceToNow(new Date(participant.joinedAt), { addSuffix: true })}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}

          {/* Inactive participants */}
          {inactiveParticipants.length > 0 && (
            <>
              <div className="text-xs text-muted-foreground px-2 pt-2">
                Left the session
              </div>
              {inactiveParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center gap-2 p-2 rounded-md opacity-50"
                >
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={participant.user.avatar || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(participant.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate">{participant.user.name}</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {participants.length === 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No participants yet
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default ParticipantsList;
