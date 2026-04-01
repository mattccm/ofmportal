"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { TypingIndicator as TypingIndicatorType, TypingDisplayInfo } from "@/types/read-receipts";
import { useWatchTypingIndicator, useTypingIndicator } from "@/hooks/use-typing-indicator";
import { formatTypingText } from "@/lib/realtime-simulation";

// ============================================================================
// Typing Dots Animation
// ============================================================================

interface TypingDotsProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  color?: "default" | "primary" | "muted";
}

export function TypingDots({ className, size = "md", color = "default" }: TypingDotsProps) {
  const sizeClasses = {
    sm: "h-1 w-1",
    md: "h-1.5 w-1.5",
    lg: "h-2 w-2",
  };

  const colorClasses = {
    default: "bg-foreground/60",
    primary: "bg-primary",
    muted: "bg-muted-foreground",
  };

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "rounded-full animate-bounce",
            sizeClasses[size],
            colorClasses[color]
          )}
          style={{
            animationDelay: `${i * 150}ms`,
            animationDuration: "600ms",
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Typing Bubble Component
// ============================================================================

interface TypingBubbleProps {
  className?: string;
  variant?: "default" | "minimal" | "chat";
}

export function TypingBubble({ className, variant = "default" }: TypingBubbleProps) {
  if (variant === "minimal") {
    return <TypingDots className={className} size="sm" />;
  }

  if (variant === "chat") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-muted",
          className
        )}
      >
        <TypingDots size="md" color="muted" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center px-4 py-2 rounded-full bg-muted/50 border border-border/50",
        className
      )}
    >
      <TypingDots size="md" />
    </div>
  );
}

// ============================================================================
// Tooltip Wrapper
// ============================================================================

function TypingTooltip({
  children,
  content,
  side = "top",
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={<span className="inline-flex" />}>
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={4}>
          <TooltipPrimitive.Popup
            className={cn(
              "z-50 overflow-hidden rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md border border-border/50",
              "animate-in fade-in-0 zoom-in-95"
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-popover [&>path]:stroke-border" />
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

// ============================================================================
// Main Typing Indicator Component
// ============================================================================

interface TypingIndicatorProps {
  // Conversation identification
  conversationId?: string;
  requestId?: string;

  // Override typing users (if you already have them)
  typingUsers?: TypingIndicatorType[];

  // Exclude current user from display
  excludeUserId?: string;

  // Display options
  showAvatars?: boolean;
  showNames?: boolean;
  maxAvatars?: number;
  variant?: "default" | "minimal" | "bubble" | "inline";

  // Animation options
  animationStyle?: "bounce" | "pulse" | "wave";

  className?: string;
}

export function TypingIndicator({
  conversationId,
  requestId,
  typingUsers: typingUsersOverride,
  excludeUserId,
  showAvatars = true,
  showNames = true,
  maxAvatars = 3,
  variant = "default",
  animationStyle = "bounce",
  className,
}: TypingIndicatorProps) {
  const { typingUsers: fetchedTypingUsers, typingDisplay } = useWatchTypingIndicator({
    conversationId,
    requestId,
    excludeUserId,
    enablePolling: !typingUsersOverride,
  });

  const typingUsers = typingUsersOverride
    ? typingUsersOverride.filter((u) => u.userId !== excludeUserId)
    : fetchedTypingUsers;

  // Don't render if no one is typing
  if (typingUsers.length === 0) {
    return null;
  }

  const displayText = formatTypingText(typingUsers);
  const visibleUsers = typingUsers.slice(0, maxAvatars);
  const hiddenCount = typingUsers.length - maxAvatars;

  // Tooltip content
  const tooltipContent = (
    <div className="space-y-1">
      {typingUsers.map((user) => (
        <div key={user.userId} className="flex items-center gap-2">
          <Avatar
            size="xs"
            user={{
              name: user.userName,
              image: user.userAvatar,
            }}
          />
          <span>{user.userName}</span>
        </div>
      ))}
    </div>
  );

  // Minimal variant - just dots
  if (variant === "minimal") {
    return (
      <TypingTooltip content={tooltipContent} side="top">
        <div className={cn("inline-flex items-center", className)}>
          <TypingDots size="sm" />
        </div>
      </TypingTooltip>
    );
  }

  // Bubble variant - chat bubble with dots
  if (variant === "bubble") {
    return (
      <div
        className={cn(
          "flex items-start gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
          className
        )}
      >
        {showAvatars && (
          <AvatarGroup>
            {visibleUsers.map((user) => (
              <Avatar
                key={user.userId}
                size="sm"
                user={{
                  name: user.userName,
                  image: user.userAvatar,
                }}
                ring="white"
              />
            ))}
          </AvatarGroup>
        )}
        <TypingBubble variant="chat" />
      </div>
    );
  }

  // Inline variant - text only
  if (variant === "inline") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-muted-foreground animate-in fade-in-0 duration-200",
          className
        )}
      >
        <TypingDots size="sm" color="muted" />
        <span className="truncate max-w-[200px]">{displayText}</span>
      </div>
    );
  }

  // Default variant - full display with avatars and text
  return (
    <TypingTooltip content={tooltipContent} side="top">
      <div
        className={cn(
          "flex items-center gap-2 py-1 animate-in fade-in-0 slide-in-from-bottom-1 duration-300",
          className
        )}
      >
        {showAvatars && typingUsers.length > 0 && (
          <AvatarGroup>
            {visibleUsers.map((user) => (
              <Avatar
                key={user.userId}
                size="xs"
                user={{
                  name: user.userName,
                  image: user.userAvatar,
                }}
                ring="white"
              />
            ))}
            {hiddenCount > 0 && (
              <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-[10px] text-muted-foreground ring-2 ring-background">
                +{hiddenCount}
              </div>
            )}
          </AvatarGroup>
        )}

        <div className="flex items-center gap-1.5">
          <TypingDots size="sm" color="muted" />
          {showNames && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {displayText}
            </span>
          )}
        </div>
      </div>
    </TypingTooltip>
  );
}

// ============================================================================
// Typing Indicator with Input Binding
// ============================================================================

interface TypingIndicatorWithInputProps {
  conversationId?: string;
  requestId?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  excludeUserId?: string;
  children: (props: {
    onInputChange: () => void;
    onInputBlur: () => void;
    isTyping: boolean;
  }) => React.ReactNode;
  className?: string;
}

export function TypingIndicatorWithInput({
  conversationId,
  requestId,
  userId,
  userName,
  userAvatar,
  excludeUserId,
  children,
  className,
}: TypingIndicatorWithInputProps) {
  const {
    typingUsers,
    typingDisplay,
    handleInputChange,
    handleInputBlur,
    isTyping,
  } = useTypingIndicator({
    conversationId,
    requestId,
    userId,
    userName,
    userAvatar,
  });

  // Filter out the current user from typing display
  const otherTypingUsers = typingUsers.filter(
    (u) => u.userId !== userId && u.userId !== excludeUserId
  );

  return (
    <div className={className}>
      {children({
        onInputChange: handleInputChange,
        onInputBlur: handleInputBlur,
        isTyping,
      })}

      {otherTypingUsers.length > 0 && (
        <TypingIndicator
          typingUsers={otherTypingUsers}
          showAvatars
          showNames
          variant="default"
          className="mt-1"
        />
      )}
    </div>
  );
}

// ============================================================================
// Typing Status Bar (for chat headers)
// ============================================================================

interface TypingStatusBarProps {
  conversationId?: string;
  requestId?: string;
  excludeUserId?: string;
  className?: string;
}

export function TypingStatusBar({
  conversationId,
  requestId,
  excludeUserId,
  className,
}: TypingStatusBarProps) {
  const { typingUsers, hasTypingUsers } = useWatchTypingIndicator({
    conversationId,
    requestId,
    excludeUserId,
  });

  if (!hasTypingUsers) {
    return null;
  }

  const displayText = formatTypingText(typingUsers);

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground",
        "animate-in fade-in-0 slide-in-from-top-1 duration-200",
        className
      )}
    >
      <TypingDots size="sm" color="muted" />
      <span className="truncate">{displayText}</span>
    </div>
  );
}

// ============================================================================
// Multiple Typing Indicators (for conversation list)
// ============================================================================

interface ConversationTypingBadgeProps {
  conversationId: string;
  excludeUserId?: string;
  className?: string;
}

export function ConversationTypingBadge({
  conversationId,
  excludeUserId,
  className,
}: ConversationTypingBadgeProps) {
  const { typingUsers, hasTypingUsers } = useWatchTypingIndicator({
    conversationId,
    excludeUserId,
  });

  if (!hasTypingUsers) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10",
        className
      )}
    >
      <TypingDots size="sm" color="primary" />
      {typingUsers.length > 1 && (
        <span className="text-[10px] text-primary font-medium">
          {typingUsers.length}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Typing Indicator Animation Variants
// ============================================================================

interface AnimatedTypingDotsProps {
  variant?: "bounce" | "pulse" | "wave" | "fade";
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function AnimatedTypingDots({
  variant = "bounce",
  className,
  size = "md",
}: AnimatedTypingDotsProps) {
  const sizeClasses = {
    sm: "h-1 w-1",
    md: "h-1.5 w-1.5",
    lg: "h-2 w-2",
  };

  const dotClass = cn("rounded-full bg-current", sizeClasses[size]);

  const animations = {
    bounce: {
      className: "animate-bounce",
      delays: [0, 150, 300],
      duration: "600ms",
    },
    pulse: {
      className: "animate-pulse",
      delays: [0, 200, 400],
      duration: "1000ms",
    },
    wave: {
      className: "",
      delays: [0, 100, 200],
      duration: "500ms",
    },
    fade: {
      className: "",
      delays: [0, 150, 300],
      duration: "1000ms",
    },
  };

  const anim = animations[variant];

  if (variant === "wave") {
    return (
      <div className={cn("flex items-end gap-0.5 h-4", className)}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(dotClass, "transition-transform")}
            style={{
              animation: `wave ${anim.duration} ease-in-out infinite`,
              animationDelay: `${anim.delays[i]}ms`,
            }}
          />
        ))}
        <style jsx>{`
          @keyframes wave {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-4px); }
          }
        `}</style>
      </div>
    );
  }

  if (variant === "fade") {
    return (
      <div className={cn("flex items-center gap-0.5", className)}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={dotClass}
            style={{
              animation: `fade ${anim.duration} ease-in-out infinite`,
              animationDelay: `${anim.delays[i]}ms`,
            }}
          />
        ))}
        <style jsx>{`
          @keyframes fade {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {anim.delays.map((delay, i) => (
        <span
          key={i}
          className={cn(dotClass, anim.className)}
          style={{
            animationDelay: `${delay}ms`,
            animationDuration: anim.duration,
          }}
        />
      ))}
    </div>
  );
}

export default TypingIndicator;
