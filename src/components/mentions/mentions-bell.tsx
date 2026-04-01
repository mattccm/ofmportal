"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AtSign } from "lucide-react";
import { useUnreadMentions } from "@/hooks/use-mentions";
import { MentionsDropdown } from "./mentions-panel";

// ============================================
// MENTIONS BELL COMPONENT
// ============================================

interface MentionsBellProps {
  className?: string;
}

export function MentionsBell({ className }: MentionsBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { count: unreadCount, refresh } = useUnreadMentions();

  // Refresh count when dropdown opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      refresh();
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-9 w-9 rounded-lg",
            "hover:bg-accent/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "transition-all duration-200",
            className
          )}
          aria-label={`Mentions${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <AtSign className="h-5 w-5 text-muted-foreground" />

          {/* Unread badge */}
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5",
                "min-w-[18px] h-[18px] px-1",
                "flex items-center justify-center",
                "text-[10px] font-semibold text-white",
                "bg-gradient-to-r from-blue-500 to-cyan-500",
                "rounded-full shadow-sm",
                "animate-in zoom-in-50 duration-200"
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}

          {/* Pulse animation for new mentions */}
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5",
                "w-[18px] h-[18px]",
                "bg-gradient-to-r from-blue-500 to-cyan-500",
                "rounded-full",
                "animate-ping opacity-75"
              )}
            />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className={cn(
          "p-0",
          "bg-popover/95 backdrop-blur-xl",
          "border border-border/50 shadow-xl rounded-xl",
          "animate-in slide-in-from-top-2 duration-200"
        )}
      >
        <MentionsDropdown maxItems={5} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================
// INLINE MENTIONS INDICATOR
// ============================================

interface MentionsIndicatorProps {
  className?: string;
  showText?: boolean;
}

export function MentionsIndicator({
  className,
  showText = true,
}: MentionsIndicatorProps) {
  const { count: unreadCount } = useUnreadMentions();

  if (unreadCount === 0) {
    return null;
  }

  return (
    <Link
      href="/dashboard/mentions"
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full",
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
        "hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors",
        "text-xs font-medium",
        className
      )}
    >
      <AtSign className="h-3 w-3" />
      {showText && <span>{unreadCount} mention{unreadCount !== 1 ? "s" : ""}</span>}
      {!showText && <span>{unreadCount}</span>}
    </Link>
  );
}

export default MentionsBell;
