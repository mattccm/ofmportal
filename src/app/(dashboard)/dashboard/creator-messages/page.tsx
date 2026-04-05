"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle, ArrowRight, Inbox, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CreatorMessage {
  id: string;
  message: string;
  createdAt: string;
  request: {
    id: string;
    title: string;
    status: string;
  } | null;
  creator: {
    id: string;
    name: string;
    avatar: string | null;
  } | null;
}

interface MessagesResponse {
  messages: CreatorMessage[];
  total: number;
  unreadCount: number;
}

function getStatusColor(status: string) {
  switch (status) {
    case "PENDING":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "SUBMITTED":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    case "IN_REVIEW":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    case "APPROVED":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "REVISION_REQUESTED":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

export default function CreatorMessagesPage() {
  const [messages, setMessages] = useState<CreatorMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/creator-messages?limit=100");
      if (res.ok) {
        const data: MessagesResponse = await res.json();
        setMessages(data.messages);
        setTotal(data.total);

        // Mark all comments as read when viewing the page
        if (data.unreadCount > 0) {
          fetch("/api/creator-messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markAllRead: true }),
          }).catch(() => {
            // Silently fail - not critical
          });
        }
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" />
            Comments
          </h1>
          <p className="text-muted-foreground">
            Comments from creators on content requests
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMessages}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : messages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No messages yet</h3>
            <p className="text-muted-foreground mt-1">
              When creators send messages on requests, they&apos;ll appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {total} message{total !== 1 ? "s" : ""} from creators
          </p>
          {messages.map((msg) => (
            <Card key={msg.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Avatar
                    size="md"
                    user={
                      msg.creator
                        ? {
                            name: msg.creator.name,
                            image: msg.creator.avatar,
                          }
                        : undefined
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {msg.creator?.name || "Unknown Creator"}
                        </p>
                        {msg.request && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm text-muted-foreground">
                              on
                            </span>
                            <Link
                              href={`/dashboard/requests/${msg.request.id}`}
                              className="text-sm text-primary hover:underline font-medium"
                            >
                              {msg.request.title}
                            </Link>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[10px] px-1.5 py-0",
                                getStatusColor(msg.request.status)
                              )}
                            >
                              {msg.request.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(msg.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
                      {msg.message}
                    </p>
                    {msg.request && (
                      <div className="mt-3">
                        <Link href={`/dashboard/requests/${msg.request.id}`}>
                          <Button variant="outline" size="sm">
                            View Request
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
