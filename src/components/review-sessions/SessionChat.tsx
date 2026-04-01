"use client";

import React, { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, MessageSquare, Mic, Play, Pause } from "lucide-react";
import { SessionChatProps } from "@/types/review-session";
import { formatDistanceToNow } from "date-fns";

// Voice Note Player Component
function VoiceNotePlayer({
  audioUrl,
  duration,
  isOwnMessage,
}: {
  audioUrl: string;
  duration: number;
  isOwnMessage: boolean;
}) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s.toString().padStart(2, "0")}`;
  };

  const handlePlayPause = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
      audioRef.current.ontimeupdate = () => {
        setCurrentTime(audioRef.current?.currentTime || 0);
      };
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  React.useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className={`mt-0.5 inline-flex items-center gap-2 px-3 py-2 rounded-lg ${
        isOwnMessage
          ? "bg-primary text-primary-foreground"
          : "bg-muted"
      }`}
    >
      <button
        onClick={handlePlayPause}
        className="h-8 w-8 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" />
        )}
      </button>
      <div className="flex items-center gap-2">
        <Mic className="h-3 w-3 opacity-70" />
        <div className="w-20 h-1 rounded-full bg-white/30 overflow-hidden">
          <div
            className="h-full bg-white/70 transition-all"
            style={{
              width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%",
            }}
          />
        </div>
        <span className="text-xs opacity-80 font-mono">
          {isPlaying ? formatDuration(currentTime) : formatDuration(duration)}
        </span>
      </div>
    </div>
  );
}

export function SessionChat({
  sessionId,
  messages,
  currentUserId,
  onSendMessage,
  disabled = false,
}: SessionChatProps) {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || disabled || isSending) return;

    const message = input.trim();
    setInput("");
    setIsSending(true);

    try {
      await onSendMessage(message);
    } catch (error) {
      console.error("Failed to send message:", error);
      // Restore input on error
      setInput(message);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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

  const formatTime = (date: Date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">Session Chat</span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No messages yet. Start the conversation!
            </div>
          )}

          {messages.map((message) => {
            const isOwnMessage = message.userId === currentUserId;
            const isSystemMessage = message.type === "SYSTEM";
            const isVoiceNote = message.type === "VOICE_NOTE";

            if (isSystemMessage) {
              return (
                <div
                  key={message.id}
                  className="flex justify-center"
                >
                  <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    {message.message}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={message.id}
                className={`flex gap-2 ${
                  isOwnMessage ? "flex-row-reverse" : ""
                }`}
              >
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarImage src={message.user.avatar || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(message.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`max-w-[70%] ${
                    isOwnMessage ? "text-right" : ""
                  }`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium">
                      {isOwnMessage ? "You" : message.user.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(message.createdAt)}
                    </span>
                  </div>
                  {isVoiceNote && message.voiceNoteUrl ? (
                    <VoiceNotePlayer
                      audioUrl={message.voiceNoteUrl}
                      duration={message.voiceNoteDuration || 0}
                      isOwnMessage={isOwnMessage}
                    />
                  ) : (
                    <div
                      className={`mt-0.5 inline-block px-3 py-1.5 rounded-lg text-sm ${
                        isOwnMessage
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {message.message}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder={disabled ? "Chat is disabled" : "Type a message..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isSending}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={disabled || isSending || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SessionChat;
