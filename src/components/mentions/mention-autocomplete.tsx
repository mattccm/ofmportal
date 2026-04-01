"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, User } from "lucide-react";
import type { MentionSuggestion } from "@/types/mentions";
import { highlightMatch } from "@/lib/mention-parser";

// ============================================
// TYPES
// ============================================

interface MentionAutocompleteProps {
  suggestions: MentionSuggestion[];
  selectedIndex: number;
  query: string;
  isLoading?: boolean;
  recentMentions?: string[];
  onSelect: (suggestion: MentionSuggestion) => void;
  onHover?: (index: number) => void;
  position?: { top: number; left: number };
  className?: string;
}

// ============================================
// MENTION AUTOCOMPLETE COMPONENT
// ============================================

export function MentionAutocomplete({
  suggestions,
  selectedIndex,
  query,
  isLoading = false,
  recentMentions = [],
  onSelect,
  onHover,
  position,
  className,
}: MentionAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  // Sort suggestions: recent mentions first
  const sortedSuggestions = [...suggestions].sort((a, b) => {
    const aIsRecent = recentMentions.includes(a.id);
    const bIsRecent = recentMentions.includes(b.id);

    if (aIsRecent && !bIsRecent) return -1;
    if (!aIsRecent && bIsRecent) return 1;
    return 0;
  });

  // Check if a user was recently mentioned
  const isRecentlyMentioned = (userId: string) => recentMentions.includes(userId);

  // No suggestions
  if (!isLoading && suggestions.length === 0) {
    return (
      <div
        className={cn(
          "absolute z-50 min-w-[280px] max-w-[360px] rounded-lg border bg-popover shadow-lg",
          "animate-in fade-in-0 zoom-in-95 duration-150",
          className
        )}
        style={position ? { top: position.top, left: position.left } : undefined}
      >
        <div className="flex items-center gap-2 px-4 py-6 text-muted-foreground">
          <User className="h-4 w-4" />
          <span className="text-sm">
            {query ? `No users matching "${query}"` : "No team members found"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className={cn(
        "absolute z-50 min-w-[280px] max-w-[360px] rounded-lg border bg-popover shadow-lg overflow-hidden",
        "animate-in fade-in-0 zoom-in-95 duration-150",
        className
      )}
      style={position ? { top: position.top, left: position.left } : undefined}
      role="listbox"
      aria-label="Mention suggestions"
    >
      {/* Loading indicator */}
      {isLoading && suggestions.length === 0 && (
        <div className="flex items-center justify-center gap-2 px-4 py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      )}

      {/* Suggestions list */}
      {suggestions.length > 0 && (
        <div className="max-h-[300px] overflow-y-auto py-1 scrollbar-thin">
          {sortedSuggestions.map((suggestion, index) => (
            <SuggestionItem
              key={suggestion.id}
              ref={index === selectedIndex ? selectedRef : undefined}
              suggestion={suggestion}
              query={query}
              isSelected={index === selectedIndex}
              isRecent={isRecentlyMentioned(suggestion.id)}
              onSelect={() => onSelect(suggestion)}
              onHover={() => onHover?.(index)}
            />
          ))}
        </div>
      )}

      {/* Keyboard hint */}
      <div className="border-t px-3 py-1.5 flex items-center justify-between text-xs text-muted-foreground bg-muted/30">
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] mr-1">↑</kbd>
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] mr-1">↓</kbd>
          to navigate
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] mr-1">Enter</kbd>
          to select
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Esc</kbd>
          to close
        </span>
      </div>
    </div>
  );
}

// ============================================
// SUGGESTION ITEM COMPONENT
// ============================================

interface SuggestionItemProps {
  suggestion: MentionSuggestion;
  query: string;
  isSelected: boolean;
  isRecent: boolean;
  onSelect: () => void;
  onHover: () => void;
}

import { forwardRef } from "react";

const SuggestionItem = forwardRef<HTMLButtonElement, SuggestionItemProps>(
  function SuggestionItem(
    { suggestion, query, isSelected, isRecent, onSelect, onHover },
    ref
  ) {
    // Get highlighted name segments
    const nameSegments = highlightMatch(suggestion.name, query);
    const emailSegments = highlightMatch(suggestion.email, query);

    return (
      <button
        ref={ref}
        type="button"
        role="option"
        aria-selected={isSelected}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
          isSelected
            ? "bg-accent text-accent-foreground"
            : "hover:bg-muted/50"
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect();
        }}
        onMouseEnter={onHover}
      >
        {/* Avatar with online status */}
        <div className="relative flex-shrink-0">
          <Avatar
            user={{
              name: suggestion.name,
              email: suggestion.email,
              image: suggestion.avatar,
            }}
            size="sm"
          />
          {suggestion.isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-popover" />
          )}
        </div>

        {/* User info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              <HighlightedText segments={nameSegments} />
            </span>
            {suggestion.role && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 capitalize">
                {suggestion.role.toLowerCase()}
              </Badge>
            )}
            {isRecent && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                Recent
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground truncate block">
            <HighlightedText segments={emailSegments} />
          </span>
        </div>
      </button>
    );
  }
);

// ============================================
// HIGHLIGHTED TEXT COMPONENT
// ============================================

interface HighlightedTextProps {
  segments: { text: string; highlighted: boolean }[];
}

function HighlightedText({ segments }: HighlightedTextProps) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.highlighted ? (
          <mark
            key={index}
            className="bg-yellow-200 dark:bg-yellow-800/50 text-inherit rounded-sm px-0.5"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </>
  );
}

export default MentionAutocomplete;
