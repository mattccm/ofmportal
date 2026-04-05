"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format, isSameDay } from "date-fns";
import {
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Info,
  ArrowLeft,
  Loader2,
  ImageIcon,
  Settings,
  PanelRightOpen,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BackToTop } from "@/components/ui/back-to-top";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  MessageBubble,
  DateSeparator,
  TypingIndicator,
} from "./message-bubble";
import { NoMessages } from "@/components/empty-states";
import {
  type ConversationWithDetails,
  type MessageWithSender,
  getConversationDisplayName,
  isUserOnline,
} from "@/lib/chat-types";
import {
  ReadReceiptIndicator,
  SeenByIndicator,
  LastSeenIndicator,
  useReadReceiptSettings,
  type ReadReceipt,
  type ReadStatus,
} from "@/components/messages/read-receipt";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCreatorContextPanel } from "@/components/providers/creator-context-provider";

// Extended message type with read receipt details
export interface MessageWithReadReceipts extends MessageWithSender {
  readReceipts?: ReadReceipt[];
  readAt?: Date | null;
  status?: ReadStatus;
}

interface ChatWindowProps {
  conversation: ConversationWithDetails | null;
  messages: MessageWithSender[];
  currentUserId: string;
  isLoading?: boolean;
  isSending?: boolean;
  hasMore?: boolean;
  onSendMessage: (content: string, attachments?: File[]) => void;
  onLoadMore: () => void;
  onBack?: () => void;
  onMarkAsRead?: (messageIds: string[]) => void;
  className?: string;
}

export function ChatWindow({
  conversation,
  messages,
  currentUserId,
  isLoading = false,
  isSending = false,
  hasMore = false,
  onSendMessage,
  onLoadMore,
  onBack,
  onMarkAsRead,
  className,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  // Creator context panel integration
  const { openCreatorContext } = useCreatorContextPanel();

  // Read receipt settings (privacy-respecting)
  const { settings: readReceiptSettings, updateSettings: updateReadReceiptSettings } = useReadReceiptSettings();

  // Mark messages as read when they become visible
  React.useEffect(() => {
    if (!conversation || !onMarkAsRead || !readReceiptSettings.sendReadReceipts) return;

    // Get unread messages from other users
    const unreadMessageIds = messages
      .filter(
        (msg) =>
          msg.senderId !== currentUserId &&
          !msg.readBy.includes(currentUserId)
      )
      .map((msg) => msg.id);

    if (unreadMessageIds.length > 0 && isAtBottom) {
      onMarkAsRead(unreadMessageIds);
    }
  }, [messages, currentUserId, conversation, isAtBottom, onMarkAsRead, readReceiptSettings.sendReadReceipts]);

  // Auto-scroll to bottom when new messages arrive (only if already at bottom)
  React.useEffect(() => {
    if (isAtBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAtBottom]);

  // Track scroll position
  const handleScroll = React.useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const atBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsAtBottom(atBottom);

    // Load more when scrolling to top
    if (scrollTop < 100 && hasMore && !isLoading) {
      onLoadMore();
    }
  }, [hasMore, isLoading, onLoadMore]);

  // Handle send message
  const handleSend = () => {
    const trimmedContent = inputValue.trim();
    if (!trimmedContent && attachments.length === 0) return;

    onSendMessage(trimmedContent, attachments.length > 0 ? attachments : undefined);
    setInputValue("");
    setAttachments([]);
    setIsAtBottom(true);
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachments((prev) => [...prev, ...Array.from(files)]);
    }
    e.target.value = "";
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Empty state
  if (!conversation) {
    return (
      <div className={cn("flex h-full flex-col items-center justify-center bg-muted/30", className)}>
        <NoMessages
          noConversationSelected
          withCard={false}
          size="lg"
        />
      </div>
    );
  }

  // Get conversation display info
  const displayName = getConversationDisplayName(conversation, currentUserId);
  const otherParticipant =
    conversation.type === "DIRECT"
      ? conversation.participants.find((p) => p.userId !== currentUserId)?.user
      : null;
  const isOnline = otherParticipant
    ? isUserOnline(otherParticipant.lastActiveAt)
    : false;

  // Group messages by date
  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/50 bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="md:hidden -ml-2"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}

            {conversation.type === "DIRECT" && otherParticipant ? (
              <Avatar
                size="md"
                user={{
                  name: otherParticipant.name,
                  email: otherParticipant.email,
                  image: otherParticipant.avatar,
                }}
                showStatus={true}
                status={isOnline ? "online" : "offline"}
              />
            ) : conversation.participants.length > 0 ? (
              <Avatar
                size="md"
                user={{
                  name: conversation.participants[0]?.user?.name || displayName,
                  email: conversation.participants[0]?.user?.email || "",
                  image: conversation.participants[0]?.user?.avatar,
                }}
              />
            ) : (
              <Avatar
                size="md"
                user={{
                  name: displayName,
                }}
              />
            )}

            <div>
              <h3 className="font-semibold text-sm">{displayName}</h3>
              {conversation.type === "DIRECT" && (
                <LastSeenIndicator
                  lastActiveAt={otherParticipant?.lastActiveAt || null}
                  isOnline={isOnline}
                />
              )}
              {conversation.type === "GROUP" && (
                <p className="text-xs text-muted-foreground">
                  {conversation.participants.length} members
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Creator context button - only for direct conversations */}
            {conversation.type === "DIRECT" && otherParticipant && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openCreatorContext(otherParticipant.id)}
                    className="hidden sm:flex"
                  >
                    <PanelRightOpen className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View creator context (C)</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Info className="h-4 w-4 mr-2" />
                    View details
                  </DropdownMenuItem>
                  <DropdownMenuItem>Mute notifications</DropdownMenuItem>
                  <DialogTrigger asChild>
                    <DropdownMenuItem>
                      <Settings className="h-4 w-4 mr-2" />
                      Read receipt settings
                    </DropdownMenuItem>
                  </DialogTrigger>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">
                    Delete conversation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Read Receipt Settings</DialogTitle>
                  <DialogDescription>
                    Control how read receipts work for your messages. These settings respect your privacy.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="sendReadReceipts"
                      checked={readReceiptSettings.sendReadReceipts}
                      onCheckedChange={(checked) =>
                        updateReadReceiptSettings({ sendReadReceipts: checked === true })
                      }
                    />
                    <div className="space-y-1">
                      <Label htmlFor="sendReadReceipts" className="font-medium">
                        Send read receipts
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Let others know when you have read their messages. If disabled, others will not see when you read their messages.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="showReadReceipts"
                      checked={readReceiptSettings.showReadReceipts}
                      onCheckedChange={(checked) =>
                        updateReadReceiptSettings({ showReadReceipts: checked === true })
                      }
                    />
                    <div className="space-y-1">
                      <Label htmlFor="showReadReceipts" className="font-medium">
                        Show read receipts
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        See when others have read your messages. Turn off to hide read status indicators.
                      </p>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin"
      >
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {hasMore && !isLoading && (
          <div className="flex justify-center py-4">
            <Button variant="ghost" size="sm" onClick={onLoadMore}>
              Load earlier messages
            </Button>
          </div>
        )}

        {/* Reversed order for display (oldest first) */}
        {Object.entries(groupedMessages)
          .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
          .map(([dateStr, dayMessages]) => (
            <React.Fragment key={dateStr}>
              <DateSeparator date={new Date(dateStr)} />
              {dayMessages
                .slice()
                .reverse()
                .map((message, index, arr) => {
                  const isOwn = message.senderId === currentUserId;
                  const prevMessage = arr[index - 1];
                  const nextMessage = arr[index + 1];
                  const isGrouped =
                    prevMessage &&
                    prevMessage.senderId === message.senderId &&
                    new Date(message.createdAt).getTime() -
                      new Date(prevMessage.createdAt).getTime() <
                      60000;
                  const isRead =
                    isOwn &&
                    message.readBy.some(
                      (readerId) => readerId !== currentUserId
                    );

                  // Check if this is the last message in the group from this sender
                  const isLastInGroup =
                    !nextMessage ||
                    nextMessage.senderId !== message.senderId ||
                    new Date(nextMessage.createdAt).getTime() -
                      new Date(message.createdAt).getTime() >=
                      60000;

                  // Get readers for group chat seen-by indicator
                  const messageReaders: ReadReceipt[] =
                    isOwn && conversation.type === "GROUP" && readReceiptSettings.showReadReceipts
                      ? message.readBy
                          .filter((readerId) => readerId !== currentUserId)
                          .map((readerId) => {
                            const participant = conversation.participants.find(
                              (p) => p.userId === readerId
                            );
                            return {
                              userId: readerId,
                              userName: participant?.user.name || "Unknown",
                              userAvatar: participant?.user.avatar,
                              userEmail: participant?.user.email,
                              readAt: new Date(), // Actual timestamp would come from API
                            };
                          })
                      : [];

                  return (
                    <React.Fragment key={message.id}>
                      <MessageBubble
                        message={message}
                        isOwn={isOwn}
                        showAvatar={!isOwn && !isGrouped}
                        isRead={readReceiptSettings.showReadReceipts && isRead}
                        isGrouped={isGrouped}
                      />
                      {/* Show seen-by indicator for own messages in group chats */}
                      {isOwn &&
                        isLastInGroup &&
                        conversation.type === "GROUP" &&
                        messageReaders.length > 0 &&
                        readReceiptSettings.showReadReceipts && (
                          <div className="flex justify-end px-4 -mt-1 mb-2">
                            <SeenByIndicator
                              readers={messageReaders}
                              maxAvatars={3}
                              compact={messageReaders.length > 3}
                              className="opacity-70 hover:opacity-100"
                            />
                          </div>
                        )}
                    </React.Fragment>
                  );
                })}
            </React.Fragment>
          ))}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} className="h-4" />

        {/* Back to top button - scroll to bottom for chat */}
        <BackToTop
          containerRef={messagesContainerRef}
          position="bottom-right"
          variant="ghost"
          size="sm"
          bottomOffset={80}
        />
      </div>

      {/* File previews */}
      {attachments.length > 0 && (
        <div className="flex-shrink-0 border-t border-border/50 bg-muted/30 p-3">
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="relative group flex items-center gap-2 bg-background rounded-lg border px-3 py-2"
              >
                {file.type.startsWith("image/") ? (
                  <ImageIcon className="h-4 w-4 text-primary" />
                ) : (
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm truncate max-w-[120px]">
                  {file.name}
                </span>
                <button
                  onClick={() => removeAttachment(index)}
                  className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-border/50 bg-card p-4">
        <div className="flex items-end gap-2">
          {/* Attachment button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          {/* Message input */}
          <div className="flex-1 relative">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              className="pr-12 py-5 bg-muted/50 border-0 focus-visible:ring-1 rounded-xl"
              disabled={isSending}
            />
            {/* Emoji picker placeholder button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            >
              <Smile className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={(!inputValue.trim() && attachments.length === 0) || isSending}
            className="flex-shrink-0 btn-gradient rounded-xl h-10 w-10 p-0"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helper to group messages by date
function groupMessagesByDate(
  messages: MessageWithSender[]
): Record<string, MessageWithSender[]> {
  const groups: Record<string, MessageWithSender[]> = {};

  messages.forEach((message) => {
    const dateKey = format(new Date(message.createdAt), "yyyy-MM-dd");
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
  });

  return groups;
}

export function ChatWindowSkeleton() {
  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header skeleton */}
      <div className="flex-shrink-0 border-b border-border/50 bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted animate-shimmer" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 rounded bg-muted animate-shimmer" />
            <div className="h-3 w-20 rounded bg-muted animate-shimmer" />
          </div>
        </div>
      </div>

      {/* Messages skeleton */}
      <div className="flex-1 overflow-hidden p-4 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2",
              i % 2 === 0 ? "flex-row-reverse" : "flex-row"
            )}
          >
            {i % 2 !== 0 && (
              <div className="h-8 w-8 rounded-full bg-muted animate-shimmer flex-shrink-0" />
            )}
            <div
              className={cn(
                "rounded-2xl p-3 space-y-2",
                i % 2 === 0 ? "bg-primary/20" : "bg-muted"
              )}
              style={{ width: `${Math.random() * 30 + 30}%` }}
            >
              <div className="h-4 w-full rounded bg-muted/50 animate-shimmer" />
              {i % 3 === 0 && (
                <div className="h-4 w-2/3 rounded bg-muted/50 animate-shimmer" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input skeleton */}
      <div className="flex-shrink-0 border-t border-border/50 bg-card p-4">
        <div className="flex gap-2">
          <div className="h-10 w-10 rounded-lg bg-muted animate-shimmer" />
          <div className="flex-1 h-10 rounded-xl bg-muted animate-shimmer" />
          <div className="h-10 w-10 rounded-xl bg-muted animate-shimmer" />
        </div>
      </div>
    </div>
  );
}

export default ChatWindow;
