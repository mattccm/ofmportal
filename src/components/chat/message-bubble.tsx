"use client";

import * as React from "react";
import { format } from "date-fns";
import { Check, CheckCheck, Paperclip, Download, FileText, Image as ImageIcon, Video, Music } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { MessageWithSender, Attachment } from "@/lib/chat-types";

interface MessageBubbleProps {
  message: MessageWithSender;
  isOwn: boolean;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  isRead?: boolean;
  isGrouped?: boolean;
}

export function MessageBubble({
  message,
  isOwn,
  showAvatar = true,
  showTimestamp = false,
  isRead = false,
  isGrouped = false,
}: MessageBubbleProps) {
  const [showTime, setShowTime] = React.useState(showTimestamp);
  const hasAttachments = message.attachments && message.attachments.length > 0;

  return (
    <div
      className={cn(
        "group flex gap-2 px-4 py-0.5",
        isOwn ? "flex-row-reverse" : "flex-row",
        !isGrouped && "mt-2"
      )}
      onMouseEnter={() => setShowTime(true)}
      onMouseLeave={() => setShowTime(showTimestamp)}
    >
      {/* Avatar */}
      {!isOwn && showAvatar && !isGrouped ? (
        <Avatar
          size="sm"
          user={{
            name: message.sender?.name || "Unknown",
            email: message.sender?.email || "",
            image: message.sender?.avatar,
          }}
          className="flex-shrink-0 mt-0.5"
        />
      ) : (
        <div className="w-8 flex-shrink-0" />
      )}

      {/* Message content */}
      <div
        className={cn(
          "flex flex-col max-w-[70%] min-w-[80px]",
          isOwn ? "items-end" : "items-start"
        )}
      >
        {/* Sender name for received messages (first in group) */}
        {!isOwn && !isGrouped && (
          <span className="text-xs font-medium text-muted-foreground mb-1 px-1">
            {message.sender?.name || "Unknown"}
          </span>
        )}

        {/* Bubble */}
        <div
          className={cn(
            "relative rounded-2xl px-4 py-2 shadow-sm",
            isOwn
              ? "bg-gradient-to-r from-primary to-violet-500 text-white rounded-br-md"
              : "bg-muted/80 text-foreground rounded-bl-md",
            hasAttachments && "pb-3"
          )}
        >
          {/* Text content */}
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {message.content}
            </p>
          )}

          {/* Attachments */}
          {hasAttachments && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((attachment) => (
                <AttachmentPreview
                  key={attachment.id}
                  attachment={attachment}
                  isOwn={isOwn}
                />
              ))}
            </div>
          )}

          {/* Read receipt for own messages - animated indicator */}
          {isOwn && (
            <div className="absolute -bottom-0.5 -right-0.5 flex items-center transition-all duration-300 ease-out">
              {isRead ? (
                <CheckCheck className="h-3.5 w-3.5 text-primary-foreground/70 animate-in fade-in zoom-in-50 duration-300" />
              ) : (
                <Check className="h-3.5 w-3.5 text-primary-foreground/50" />
              )}
            </div>
          )}
        </div>

        {/* Timestamp - shown on hover */}
        <div
          className={cn(
            "flex items-center gap-1 px-1 mt-0.5 transition-opacity duration-200",
            showTime ? "opacity-100" : "opacity-0"
          )}
        >
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(message.createdAt), "h:mm a")}
          </span>
        </div>
      </div>
    </div>
  );
}

interface AttachmentPreviewProps {
  attachment: Attachment;
  isOwn: boolean;
}

function AttachmentPreview({ attachment, isOwn }: AttachmentPreviewProps) {
  const isImage = attachment.type.startsWith("image/");
  const isVideo = attachment.type.startsWith("video/");
  const isAudio = attachment.type.startsWith("audio/");

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = () => {
    if (isImage) return ImageIcon;
    if (isVideo) return Video;
    if (isAudio) return Music;
    return FileText;
  };

  const FileIcon = getFileIcon();

  // Image preview
  if (isImage) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <div className="relative rounded-lg overflow-hidden max-w-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-h-48 w-auto rounded-lg object-cover"
          />
          <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors" />
        </div>
      </a>
    );
  }

  // Video preview placeholder
  if (isVideo) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex items-center gap-3 rounded-lg p-3 transition-colors",
          isOwn
            ? "bg-white/10 hover:bg-white/20"
            : "bg-background/50 hover:bg-background/80"
        )}
      >
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            isOwn ? "bg-white/20" : "bg-primary/10"
          )}
        >
          <Video
            className={cn("h-5 w-5", isOwn ? "text-white" : "text-primary")}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium truncate",
              isOwn ? "text-white" : "text-foreground"
            )}
          >
            {attachment.name}
          </p>
          <p
            className={cn(
              "text-xs",
              isOwn ? "text-white/70" : "text-muted-foreground"
            )}
          >
            {formatFileSize(attachment.size)}
          </p>
        </div>
      </a>
    );
  }

  // Generic file attachment
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.name}
      className={cn(
        "flex items-center gap-3 rounded-lg p-3 transition-colors",
        isOwn
          ? "bg-white/10 hover:bg-white/20"
          : "bg-background/50 hover:bg-background/80"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          isOwn ? "bg-white/20" : "bg-primary/10"
        )}
      >
        <FileIcon
          className={cn("h-5 w-5", isOwn ? "text-white" : "text-primary")}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium truncate",
            isOwn ? "text-white" : "text-foreground"
          )}
        >
          {attachment.name}
        </p>
        <p
          className={cn(
            "text-xs",
            isOwn ? "text-white/70" : "text-muted-foreground"
          )}
        >
          {formatFileSize(attachment.size)}
        </p>
      </div>
      <Download
        className={cn(
          "h-4 w-4 flex-shrink-0",
          isOwn ? "text-white/70" : "text-muted-foreground"
        )}
      />
    </a>
  );
}

interface MessageGroupProps {
  messages: MessageWithSender[];
  currentUserId: string;
}

export function MessageGroup({ messages, currentUserId }: MessageGroupProps) {
  return (
    <div className="space-y-0.5">
      {messages.map((message, index) => {
        const isOwn = message.senderId === currentUserId;
        const isFirst = index === 0;
        const isRead =
          isOwn &&
          message.readBy.some((readerId) => readerId !== currentUserId);

        return (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={isOwn}
            showAvatar={!isOwn && isFirst}
            isRead={isRead}
            isGrouped={!isFirst}
          />
        );
      })}
    </div>
  );
}

interface DateSeparatorProps {
  date: Date;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let dateText: string;
  if (date.toDateString() === today.toDateString()) {
    dateText = "Today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    dateText = "Yesterday";
  } else {
    dateText = format(date, "MMMM d, yyyy");
  }

  return (
    <div className="flex items-center justify-center py-4">
      <div className="flex-1 border-t border-border/50" />
      <span className="px-4 text-xs font-medium text-muted-foreground bg-background">
        {dateText}
      </span>
      <div className="flex-1 border-t border-border/50" />
    </div>
  );
}

export function TypingIndicator({
  user,
}: {
  user: { name: string; avatar?: string | null; email?: string };
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <Avatar
        size="sm"
        user={{
          name: user.name,
          email: user.email || "",
          image: user.avatar,
        }}
      />
      <div className="flex items-center gap-1 bg-muted/80 rounded-2xl rounded-bl-md px-4 py-3">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
      </div>
    </div>
  );
}

export default MessageBubble;
