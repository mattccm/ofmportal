"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  Clock,
  Users,
  FileText,
  Download,
  ThumbsUp,
  ThumbsDown,
  SkipForward,
  Trophy,
  BarChart3,
} from "lucide-react";
import { SessionSummaryProps, ReviewVoteType } from "@/types/review-session";

export function SessionSummary({
  summary,
  onClose,
  onExport,
}: SessionSummaryProps) {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getDecisionIcon = (decision: ReviewVoteType | "PENDING") => {
    switch (decision) {
      case "APPROVE":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "REJECT":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "DISCUSS":
        return <MessageSquare className="h-4 w-4 text-amber-500" />;
      case "SKIP":
        return <SkipForward className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getDecisionBadge = (decision: ReviewVoteType | "PENDING") => {
    switch (decision) {
      case "APPROVE":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "REJECT":
        return <Badge className="bg-red-500">Rejected</Badge>;
      case "DISCUSS":
        return <Badge className="bg-amber-500">Needs Discussion</Badge>;
      case "SKIP":
        return <Badge variant="secondary">Skipped</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const approvedCount = summary.decisions.filter((d) => d.decision === "APPROVE").length;
  const rejectedCount = summary.decisions.filter((d) => d.decision === "REJECT").length;
  const discussCount = summary.decisions.filter((d) => d.decision === "DISCUSS").length;
  const pendingCount = summary.decisions.filter((d) => d.decision === "PENDING").length;

  // Find top contributor
  const topContributor = [...summary.participantStats].sort(
    (a, b) => b.totalVotes - a.totalVotes
  )[0];

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Session Summary: {summary.sessionName}
          </DialogTitle>
          <DialogDescription>
            Review completed. Here's a summary of the decisions made during the session.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-1">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Clock className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <div className="text-2xl font-bold">
                  {formatDuration(summary.duration)}
                </div>
                <div className="text-xs text-muted-foreground">Duration</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <FileText className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <div className="text-2xl font-bold">
                  {summary.reviewedItems}/{summary.totalItems}
                </div>
                <div className="text-xs text-muted-foreground">Items Reviewed</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Users className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <div className="text-2xl font-bold">{summary.participantCount}</div>
                <div className="text-xs text-muted-foreground">Participants</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <ThumbsUp className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <div className="text-2xl font-bold">{summary.totalVotes}</div>
                <div className="text-xs text-muted-foreground">Total Votes</div>
              </div>
            </div>

            {/* Decision Breakdown */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                Decision Breakdown
              </h3>
              <div className="flex gap-3 flex-wrap">
                <Badge variant="outline" className="gap-1 py-1 px-3">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {approvedCount} Approved
                </Badge>
                <Badge variant="outline" className="gap-1 py-1 px-3">
                  <XCircle className="h-3 w-3 text-red-500" />
                  {rejectedCount} Rejected
                </Badge>
                <Badge variant="outline" className="gap-1 py-1 px-3">
                  <MessageSquare className="h-3 w-3 text-amber-500" />
                  {discussCount} Discussion
                </Badge>
                {pendingCount > 0 && (
                  <Badge variant="outline" className="gap-1 py-1 px-3">
                    <Clock className="h-3 w-3 text-gray-400" />
                    {pendingCount} Pending
                  </Badge>
                )}
              </div>
            </div>

            <Separator />

            {/* Content Decisions */}
            <div>
              <h3 className="font-semibold mb-3">Content Decisions</h3>
              <div className="space-y-2">
                {summary.decisions.map((decision, index) => (
                  <div
                    key={decision.uploadId}
                    className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="text-sm text-muted-foreground w-6">
                      #{index + 1}
                    </div>
                    {decision.thumbnailUrl ? (
                      <img
                        src={decision.thumbnailUrl}
                        alt=""
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {decision.uploadName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        by {decision.creatorName}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3 text-green-500" />
                        {decision.voteBreakdown.approve}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsDown className="h-3 w-3 text-red-500" />
                        {decision.voteBreakdown.reject}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3 text-amber-500" />
                        {decision.voteBreakdown.discuss}
                      </span>
                    </div>
                    {getDecisionBadge(decision.decision)}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Participant Stats */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                Participant Stats
                {topContributor && (
                  <Badge variant="secondary" className="gap-1">
                    <Trophy className="h-3 w-3" />
                    Top: {topContributor.userName}
                  </Badge>
                )}
              </h3>
              <div className="space-y-2">
                {summary.participantStats.map((participant) => (
                  <div
                    key={participant.userId}
                    className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={participant.userAvatar || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(participant.userName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm flex items-center gap-2">
                        {participant.userName}
                        {participant.role === "HOST" && (
                          <Badge variant="outline" className="text-xs">
                            Host
                          </Badge>
                        )}
                        {topContributor?.userId === participant.userId && (
                          <Trophy className="h-3 w-3 text-amber-500" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Participated for {formatDuration(participant.participationDuration)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-medium">{participant.totalVotes}</div>
                        <div className="text-[10px] text-muted-foreground">Votes</div>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-green-500">{participant.approveVotes}</span>
                        /
                        <span className="text-red-500">{participant.rejectVotes}</span>
                        /
                        <span className="text-amber-500">{participant.discussVotes}</span>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">{participant.messagesCount}</div>
                        <div className="text-[10px] text-muted-foreground">Messages</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4">
          {onExport && (
            <Button variant="outline" onClick={onExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SessionSummary;
