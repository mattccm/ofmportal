"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  SkipForward,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Users,
} from "lucide-react";
import { VotingPanelProps, ReviewVoteType } from "@/types/review-session";
import { ConflictIndicator } from "./ConflictHighlight";

export function VotingPanel({
  currentUploadId,
  userVote,
  voteSummary,
  isVoting,
  onVote,
  disabled = false,
}: VotingPanelProps) {
  const [notePopoverOpen, setNotePopoverOpen] = useState(false);
  const [note, setNote] = useState("");
  const [selectedVoteType, setSelectedVoteType] = useState<ReviewVoteType | null>(null);

  const handleQuickVote = (vote: ReviewVoteType) => {
    onVote(vote);
  };

  const handleVoteWithNote = () => {
    if (selectedVoteType) {
      onVote(selectedVoteType, note || undefined);
      setNote("");
      setNotePopoverOpen(false);
      setSelectedVoteType(null);
    }
  };

  const openNotePopover = (vote: ReviewVoteType) => {
    setSelectedVoteType(vote);
    setNotePopoverOpen(true);
  };

  const voteButtons = [
    {
      type: "APPROVE" as ReviewVoteType,
      label: "Approve",
      icon: ThumbsUp,
      activeColor: "bg-green-500 hover:bg-green-600 text-white",
      hoverColor: "hover:bg-green-100 hover:text-green-700 hover:border-green-300",
    },
    {
      type: "REJECT" as ReviewVoteType,
      label: "Reject",
      icon: ThumbsDown,
      activeColor: "bg-red-500 hover:bg-red-600 text-white",
      hoverColor: "hover:bg-red-100 hover:text-red-700 hover:border-red-300",
    },
    {
      type: "DISCUSS" as ReviewVoteType,
      label: "Discuss",
      icon: MessageSquare,
      activeColor: "bg-amber-500 hover:bg-amber-600 text-white",
      hoverColor: "hover:bg-amber-100 hover:text-amber-700 hover:border-amber-300",
    },
    {
      type: "SKIP" as ReviewVoteType,
      label: "Skip",
      icon: SkipForward,
      activeColor: "bg-gray-500 hover:bg-gray-600 text-white",
      hoverColor: "hover:bg-gray-100 hover:text-gray-700 hover:border-gray-300",
    },
  ];

  const getMajorityIcon = () => {
    if (!voteSummary?.majority) return null;
    switch (voteSummary.majority) {
      case "APPROVE":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "REJECT":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "DISCUSS":
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default:
        return null;
    }
  };

  if (!currentUploadId) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No content selected for review
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Your Vote Section */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">
          Your Vote
        </div>
        <div className="grid grid-cols-2 gap-2">
          {voteButtons.map((button) => {
            const Icon = button.icon;
            const isActive = userVote === button.type;
            return (
              <Popover
                key={button.type}
                open={notePopoverOpen && selectedVoteType === button.type}
                onOpenChange={(open) => {
                  if (!open) {
                    setNotePopoverOpen(false);
                    setSelectedVoteType(null);
                    setNote("");
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={disabled || isVoting}
                    className={`w-full gap-2 ${
                      isActive ? button.activeColor : button.hoverColor
                    }`}
                    onClick={() => handleQuickVote(button.type)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openNotePopover(button.type);
                    }}
                  >
                    <Icon className="h-5 w-5" />
                    {button.label}
                    {isActive && <span className="text-xs">(voted)</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" side="top">
                  <div className="space-y-2">
                    <div className="font-medium text-sm">
                      Add a note (optional)
                    </div>
                    <Textarea
                      placeholder="Add feedback for this vote..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNotePopoverOpen(false);
                          setNote("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleVoteWithNote}
                        disabled={isVoting}
                      >
                        Submit Vote
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Right-click to add a note with your vote
        </p>
      </div>

      {/* Vote Summary Section */}
      {voteSummary && voteSummary.total > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Votes
            </div>
            <div className="flex items-center gap-2">
              {voteSummary.hasConflict && (
                <ConflictIndicator
                  hasConflict={voteSummary.hasConflict}
                  conflictType={voteSummary.conflictType}
                  conflictSeverity={voteSummary.conflictSeverity}
                />
              )}
              {voteSummary.hasConsensus && (
                <Badge variant="outline" className="gap-1">
                  {getMajorityIcon()}
                  Consensus
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {/* Approve bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3 text-green-500" />
                  Approve
                </span>
                <span className="font-medium">{voteSummary.approve}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{
                    width: `${
                      voteSummary.total > 0
                        ? (voteSummary.approve / voteSummary.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Reject bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <ThumbsDown className="h-3 w-3 text-red-500" />
                  Reject
                </span>
                <span className="font-medium">{voteSummary.reject}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all"
                  style={{
                    width: `${
                      voteSummary.total > 0
                        ? (voteSummary.reject / voteSummary.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Discuss bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3 text-amber-500" />
                  Discuss
                </span>
                <span className="font-medium">{voteSummary.discuss}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{
                    width: `${
                      voteSummary.total > 0
                        ? (voteSummary.discuss / voteSummary.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {voteSummary.skip > 0 && (
              <div className="text-xs text-muted-foreground text-center">
                {voteSummary.skip} skipped
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default VotingPanel;
