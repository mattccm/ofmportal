"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SmilePlus } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

interface CommentReactionsProps {
  reactions: Record<string, string[]>; // emoji -> userIds
  currentUserId: string;
  onReact: (emoji: string) => void;
  teamMembers: TeamMember[];
}

// ============================================
// CONSTANTS
// ============================================

// Common emoji reactions organized by category
const REACTION_CATEGORIES = [
  {
    name: "Frequently Used",
    emojis: ["👍", "❤️", "😄", "🎉", "👀", "🚀"],
  },
  {
    name: "Expressions",
    emojis: ["😊", "😂", "🤔", "😮", "😢", "😡"],
  },
  {
    name: "Gestures",
    emojis: ["👏", "🙌", "💪", "🤝", "👋", "✌️"],
  },
  {
    name: "Symbols",
    emojis: ["✅", "❌", "⭐", "💯", "🔥", "💡"],
  },
];

// Quick access emojis for the compact picker
const QUICK_REACTIONS = ["👍", "❤️", "😄", "🎉", "👀", "🚀"];

// ============================================
// EMOJI PICKER COMPONENT
// ============================================

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    onClose();
  };

  return (
    <div className="p-2">
      {REACTION_CATEGORIES.map((category) => (
        <div key={category.name} className="mb-2">
          <div className="text-xs font-medium text-muted-foreground mb-1 px-1">
            {category.name}
          </div>
          <div className="grid grid-cols-6 gap-1">
            {category.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="h-8 w-8 flex items-center justify-center text-lg hover:bg-accent rounded transition-colors"
                onClick={() => handleSelect(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// REACTION BADGE COMPONENT
// ============================================

interface ReactionBadgeProps {
  emoji: string;
  userIds: string[];
  currentUserId: string;
  teamMembers: TeamMember[];
  onClick: () => void;
}

function ReactionBadge({
  emoji,
  userIds,
  currentUserId,
  teamMembers,
  onClick,
}: ReactionBadgeProps) {
  const hasReacted = userIds.includes(currentUserId);
  const count = userIds.length;

  // Get names of users who reacted
  const reactedUsers = userIds
    .map((id) => {
      if (id === currentUserId) return "You";
      const member = teamMembers.find((m) => m.id === id);
      return member?.name || "Unknown";
    })
    .slice(0, 10); // Limit to first 10 for tooltip

  const remainingCount = userIds.length - reactedUsers.length;
  const tooltipText =
    remainingCount > 0
      ? `${reactedUsers.join(", ")} and ${remainingCount} more`
      : reactedUsers.join(", ");

  return (
    <Tooltip>
      <TooltipTrigger
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm transition-colors cursor-pointer",
          hasReacted
            ? "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        )}
      >
        <span>{emoji}</span>
        <span className="text-xs font-medium">{count}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px]">
        <p className="text-xs">{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================
// MAIN COMMENT REACTIONS COMPONENT
// ============================================

export function CommentReactions({
  reactions,
  currentUserId,
  onReact,
  teamMembers,
}: CommentReactionsProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Get sorted reactions (by count, descending)
  const sortedReactions = Object.entries(reactions)
    .filter(([, userIds]) => userIds.length > 0)
    .sort((a, b) => b[1].length - a[1].length);

  const hasAnyReactions = sortedReactions.length > 0;

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      {/* Existing Reactions */}
      {sortedReactions.map(([emoji, userIds]) => (
        <ReactionBadge
          key={emoji}
          emoji={emoji}
          userIds={userIds}
          currentUserId={currentUserId}
          teamMembers={teamMembers}
          onClick={() => onReact(emoji)}
        />
      ))}

      {/* Add Reaction Button */}
      <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300",
              !hasAnyReactions && "opacity-0 group-hover:opacity-100 transition-opacity"
            )}
          >
            <SmilePlus className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          {/* Quick Reactions Bar */}
          <div className="flex items-center gap-1 p-2 border-b">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="h-8 w-8 flex items-center justify-center text-lg hover:bg-accent rounded transition-colors"
                onClick={() => {
                  onReact(emoji);
                  setIsPickerOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Full Emoji Picker */}
          <EmojiPicker
            onSelect={onReact}
            onClose={() => setIsPickerOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ============================================
// STANDALONE REACTION PICKER (for use outside comments)
// ============================================

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  trigger?: React.ReactNode;
}

export function ReactionPicker({ onSelect, trigger }: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <SmilePlus className="h-4 w-4 mr-1" />
            React
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <EmojiPicker
          onSelect={(emoji) => {
            onSelect(emoji);
            setIsOpen(false);
          }}
          onClose={() => setIsOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// REACTION SUMMARY (for displaying reaction counts)
// ============================================

interface ReactionSummaryProps {
  reactions: Record<string, string[]>;
  teamMembers: TeamMember[];
  maxDisplay?: number;
}

export function ReactionSummary({
  reactions,
  teamMembers,
  maxDisplay = 3,
}: ReactionSummaryProps) {
  const sortedReactions = Object.entries(reactions)
    .filter(([, userIds]) => userIds.length > 0)
    .sort((a, b) => b[1].length - a[1].length);

  if (sortedReactions.length === 0) {
    return null;
  }

  const displayedReactions = sortedReactions.slice(0, maxDisplay);
  const remainingCount = sortedReactions.length - maxDisplay;
  const totalReactions = sortedReactions.reduce(
    (sum, [, userIds]) => sum + userIds.length,
    0
  );

  // Build tooltip with all reactions
  const tooltipContent = sortedReactions
    .map(([emoji, userIds]) => {
      const names = userIds
        .map((id) => teamMembers.find((m) => m.id === id)?.name || "Unknown")
        .slice(0, 3);
      const remaining = userIds.length - names.length;
      const nameStr =
        remaining > 0
          ? `${names.join(", ")} +${remaining}`
          : names.join(", ");
      return `${emoji} ${nameStr}`;
    })
    .join("\n");

  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex items-center gap-0.5 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full cursor-default">
        {displayedReactions.map(([emoji]) => (
          <span key={emoji} className="text-sm">
            {emoji}
          </span>
        ))}
        {remainingCount > 0 && (
          <span className="text-xs text-muted-foreground ml-0.5">
            +{remainingCount}
          </span>
        )}
        <span className="text-xs font-medium text-muted-foreground ml-1">
          {totalReactions}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="whitespace-pre-line">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}
