"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, User, ExternalLink } from "lucide-react";

// ============================================
// TYPES
// ============================================

interface MentionChipProps {
  userId: string;
  username: string;
  isSelf?: boolean;
  showHoverCard?: boolean;
  className?: string;
  onClick?: () => void;
}

interface MentionUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  role?: string;
  isOnline?: boolean;
}

// ============================================
// MENTION CHIP COMPONENT
// ============================================

export function MentionChip({
  userId,
  username,
  isSelf = false,
  showHoverCard = true,
  className,
  onClick,
}: MentionChipProps) {
  const [user, setUser] = useState<MentionUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch user details on hover
  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);

    if (open && !user && !isLoading) {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/users/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        }
      } catch (error) {
        console.error("Failed to fetch user details:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Base chip element
  const chipElement = (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-sm font-medium cursor-pointer transition-colors",
        isSelf
          ? "bg-primary/15 text-primary hover:bg-primary/25"
          : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50",
        className
      )}
      onClick={onClick}
    >
      @{username}
    </span>
  );

  // Without hover card
  if (!showHoverCard) {
    return chipElement;
  }

  // With hover card
  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{chipElement}</PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <MentionHoverCard user={user} username={username} isLoading={isLoading} />
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// MENTION HOVER CARD
// ============================================

interface MentionHoverCardProps {
  user: MentionUser | null;
  username: string;
  isLoading: boolean;
}

function MentionHoverCard({ user, username, isLoading }: MentionHoverCardProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-3 w-32 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <User className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">{username}</p>
            <p className="text-sm text-muted-foreground">User information unavailable</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {/* User info */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="relative">
            <Avatar
              user={{ name: user.name, email: user.email, image: user.avatar }}
              size="lg"
            />
            {user.isOnline && (
              <span className="absolute bottom-0 right-0 h-3 w-3 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{user.name}</p>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            {user.role && (
              <Badge variant="secondary" className="mt-1 capitalize">
                {user.role.toLowerCase()}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-2 flex gap-1">
        <Button variant="ghost" size="sm" className="flex-1 h-8" asChild>
          <Link href={`mailto:${user.email}`}>
            <Mail className="h-4 w-4 mr-1.5" />
            Email
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="flex-1 h-8" asChild>
          <Link href={`/dashboard/team/${user.id}`}>
            <ExternalLink className="h-4 w-4 mr-1.5" />
            View Profile
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ============================================
// INLINE MENTION RENDERER
// ============================================

interface RenderMentionsProps {
  segments: Array<
    | { type: "text"; content: string }
    | { type: "mention"; userId: string; username: string }
  >;
  currentUserId?: string;
  showHoverCards?: boolean;
  className?: string;
}

export function RenderMentions({
  segments,
  currentUserId,
  showHoverCards = true,
  className,
}: RenderMentionsProps) {
  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <span key={index}>{segment.content}</span>;
        }

        return (
          <MentionChip
            key={index}
            userId={segment.userId}
            username={segment.username}
            isSelf={segment.userId === currentUserId}
            showHoverCard={showHoverCards}
          />
        );
      })}
    </span>
  );
}

export default MentionChip;
