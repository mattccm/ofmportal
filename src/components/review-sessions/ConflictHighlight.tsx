"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Users,
  Scale,
  Swords,
} from "lucide-react";
import { VoteSummary, ReviewSessionVoteWithUser } from "@/types/review-session";

interface ConflictHighlightProps {
  voteSummary: VoteSummary | null;
  votes: ReviewSessionVoteWithUser[];
  showDetails?: boolean;
  onRequestDiscussion?: () => void;
}

export function ConflictHighlight({
  voteSummary,
  votes,
  showDetails = true,
  onRequestDiscussion,
}: ConflictHighlightProps) {
  if (!voteSummary || !voteSummary.hasConflict) {
    return null;
  }

  const getConflictIcon = () => {
    switch (voteSummary.conflictType) {
      case "approve_reject":
        return <Swords className="h-4 w-4" />;
      case "three_way":
        return <Scale className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getConflictTitle = () => {
    switch (voteSummary.conflictType) {
      case "approve_reject":
        return "Approve vs Reject Conflict";
      case "approve_discuss":
        return "Approve vs Discuss Conflict";
      case "reject_discuss":
        return "Reject vs Discuss Conflict";
      case "three_way":
        return "Three-Way Conflict";
      default:
        return "Voting Conflict";
    }
  };

  const getConflictDescription = () => {
    switch (voteSummary.conflictType) {
      case "approve_reject":
        return "Team members disagree on whether to approve or reject this content.";
      case "approve_discuss":
        return "Some want to approve while others want to discuss further.";
      case "reject_discuss":
        return "Split between rejecting and needing more discussion.";
      case "three_way":
        return "Votes are split across approve, reject, and discuss options.";
      default:
        return "There is disagreement among team members.";
    }
  };

  const getSeverityColor = () => {
    switch (voteSummary.conflictSeverity) {
      case "high":
        return "border-red-500 bg-red-50 text-red-700";
      case "medium":
        return "border-amber-500 bg-amber-50 text-amber-700";
      case "low":
        return "border-yellow-500 bg-yellow-50 text-yellow-700";
      default:
        return "border-amber-500 bg-amber-50 text-amber-700";
    }
  };

  const getSeverityBadge = () => {
    switch (voteSummary.conflictSeverity) {
      case "high":
        return (
          <Badge variant="destructive" className="text-xs">
            High
          </Badge>
        );
      case "medium":
        return (
          <Badge className="bg-amber-500 text-xs">
            Medium
          </Badge>
        );
      case "low":
        return (
          <Badge className="bg-yellow-500 text-xs">
            Low
          </Badge>
        );
      default:
        return null;
    }
  };

  // Group votes by type
  const approveVoters = votes.filter((v) => v.vote === "APPROVE");
  const rejectVoters = votes.filter((v) => v.vote === "REJECT");
  const discussVoters = votes.filter((v) => v.vote === "DISCUSS");

  return (
    <div className={`rounded-lg border-2 p-3 space-y-3 ${getSeverityColor()}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getConflictIcon()}
          <span className="font-medium">{getConflictTitle()}</span>
          {getSeverityBadge()}
        </div>
        {onRequestDiscussion && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRequestDiscussion}
                  className="gap-1 bg-white/50"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Discuss
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Start a discussion about this item</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Description */}
      <p className="text-sm">{getConflictDescription()}</p>

      {/* Vote Breakdown */}
      {showDetails && (
        <div className="grid grid-cols-3 gap-2">
          {/* Approve */}
          {approveVoters.length > 0 && (
            <div className="bg-white/50 rounded p-2">
              <div className="flex items-center gap-1 text-green-600 mb-1">
                <ThumbsUp className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Approve ({approveVoters.length})</span>
              </div>
              <div className="space-y-0.5">
                {approveVoters.map((v) => (
                  <div key={v.id} className="text-xs truncate" title={v.user.name}>
                    {v.user.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reject */}
          {rejectVoters.length > 0 && (
            <div className="bg-white/50 rounded p-2">
              <div className="flex items-center gap-1 text-red-600 mb-1">
                <ThumbsDown className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Reject ({rejectVoters.length})</span>
              </div>
              <div className="space-y-0.5">
                {rejectVoters.map((v) => (
                  <div key={v.id} className="text-xs truncate" title={v.user.name}>
                    {v.user.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discuss */}
          {discussVoters.length > 0 && (
            <div className="bg-white/50 rounded p-2">
              <div className="flex items-center gap-1 text-amber-600 mb-1">
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Discuss ({discussVoters.length})</span>
              </div>
              <div className="space-y-0.5">
                {discussVoters.map((v) => (
                  <div key={v.id} className="text-xs truncate" title={v.user.name}>
                    {v.user.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Suggestion */}
      <div className="text-xs opacity-75 flex items-center gap-1">
        <Users className="h-3 w-3" />
        Discussion recommended before proceeding
      </div>
    </div>
  );
}

// Compact inline conflict indicator for the voting panel
interface ConflictIndicatorProps {
  hasConflict: boolean;
  conflictType?: VoteSummary["conflictType"];
  conflictSeverity?: VoteSummary["conflictSeverity"];
}

export function ConflictIndicator({
  hasConflict,
  conflictType,
  conflictSeverity,
}: ConflictIndicatorProps) {
  if (!hasConflict) {
    return null;
  }

  const getColor = () => {
    switch (conflictSeverity) {
      case "high":
        return "text-red-500";
      case "medium":
        return "text-amber-500";
      case "low":
        return "text-yellow-500";
      default:
        return "text-amber-500";
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 ${getColor()}`}>
            <AlertTriangle className="h-4 w-4 animate-pulse" />
            <span className="text-xs font-medium">Conflict</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Votes are conflicting - discussion needed</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ConflictHighlight;
