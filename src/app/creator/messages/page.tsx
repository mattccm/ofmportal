"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useBranding } from "@/components/providers/branding-provider";
import {
  Loader2,
  Send,
  MessageSquare,
  Search,
  ArrowRight,
  FileText,
  Users,
  Paperclip,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  isAgency: boolean;
  isFromCreator?: boolean;
  user?: {
    name: string;
    image?: string;
  };
  sender?: {
    id: string;
    name: string;
    avatar?: string;
  };
  forwardedContent?: Array<{
    type: string;
    id: string;
    data?: {
      id: string;
      originalName?: string;
      title?: string;
      thumbnailUrl?: string;
      status?: string;
    };
  }>;
}

interface RequestThread {
  id: string;
  title: string;
  status: string;
  lastMessage?: Message;
  unreadCount: number;
  messages: Message[];
}

interface TeamConversation {
  id: string;
  teamName: string;
  participants: Array<{
    id: string;
    name: string;
    avatar?: string;
  }>;
}

export default function CreatorMessagesPage() {
  const router = useRouter();
  const { branding } = useBranding();
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<RequestThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<RequestThread | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [creator, setCreator] = useState<{
    id: string;
    name: string;
    email: string;
    image?: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"team" | "requests">("team");

  // Team chat state
  const [teamConversation, setTeamConversation] = useState<TeamConversation | null>(null);
  const [teamMessages, setTeamMessages] = useState<Message[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("creatorToken");
    const creatorId = localStorage.getItem("creatorId");
    const name = localStorage.getItem("creatorName");
    const email = localStorage.getItem("creatorEmail");

    if (!token || !creatorId) {
      router.push("/login");
      return;
    }

    setCreator({
      id: creatorId,
      name: name || "Creator",
      email: email || "",
    });

    fetchThreads();
    fetchTeamConversation();
  }, [router]);

  useEffect(() => {
    scrollToBottom();
  }, [selectedThread?.messages, teamMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchTeamConversation = async () => {
    try {
      setTeamLoading(true);
      const token = localStorage.getItem("creatorToken");
      const response = await fetch("/api/portal/inbox", {
        headers: {
          "x-creator-token": token || "",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.conversation) {
          setTeamConversation(data.conversation);
          setTeamMessages(data.messages || []);
        }
      }
    } catch (error) {
      console.error("Error fetching team conversation:", error);
    } finally {
      setTeamLoading(false);
    }
  };

  const fetchThreads = async () => {
    try {
      const token = localStorage.getItem("creatorToken");

      // Fetch requests to get message threads
      const response = await fetch(`/api/portal/requests`, {
        headers: {
          "x-creator-token": token || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch requests");
      }

      const requests = await response.json();

      // For each request, we'll simulate message threads
      const threadsData: RequestThread[] = requests.map((request: { id: string; title: string; status: string }) => ({
        id: request.id,
        title: request.title,
        status: request.status,
        lastMessage: undefined,
        unreadCount: 0,
        messages: [],
      }));

      // Fetch comments for each request to get messages
      const threadsWithMessages = await Promise.all(
        threadsData.map(async (thread) => {
          try {
            const commentsResponse = await fetch(`/api/portal/requests/${thread.id}`, {
              headers: {
                "x-creator-token": token || "",
              },
            });

            if (commentsResponse.ok) {
              const data = await commentsResponse.json();
              const comments = data.comments || [];

              return {
                ...thread,
                messages: comments.map((c: { id: string; content: string; createdAt: string; isAgency: boolean; user?: { name: string; image?: string } }) => ({
                  id: c.id,
                  content: c.content,
                  createdAt: c.createdAt,
                  isAgency: c.isAgency,
                  user: c.user,
                })),
                lastMessage: comments.length > 0 ? comments[comments.length - 1] : undefined,
                unreadCount: comments.filter((c: { isAgency: boolean }) => c.isAgency).length > 0 ? 0 : 0,
              };
            }
            return thread;
          } catch {
            return thread;
          }
        })
      );

      // Filter to only show threads with messages or active requests
      const activeThreads = threadsWithMessages.filter(
        (t) => t.messages.length > 0 || !["CANCELLED", "DRAFT", "ARCHIVED"].includes(t.status)
      );

      setThreads(activeThreads);
    } catch (error) {
      console.error("Error fetching threads:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTeamMessage = async () => {
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch("/api/portal/inbox", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-creator-token": token || "",
        },
        body: JSON.stringify({ content: newMessage }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();

      // Add message to local state
      setTeamMessages((prev) => [...prev, {
        id: data.message.id,
        content: data.message.content,
        createdAt: data.message.createdAt,
        isAgency: false,
        isFromCreator: true,
        forwardedContent: data.message.forwardedContent,
      }]);

      setNewMessage("");
      toast.success("Message sent");
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleSendRequestMessage = async () => {
    if (!newMessage.trim() || !selectedThread) return;

    setSending(true);
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch(`/api/portal/requests/${selectedThread.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-creator-token": token || "",
        },
        body: JSON.stringify({ content: newMessage }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const newMsg: Message = {
        id: Date.now().toString(),
        content: newMessage,
        createdAt: new Date().toISOString(),
        isAgency: false,
      };

      // Update local state
      setSelectedThread({
        ...selectedThread,
        messages: [...selectedThread.messages, newMsg],
        lastMessage: newMsg,
      });

      setThreads((prev) =>
        prev.map((t) =>
          t.id === selectedThread.id
            ? {
                ...t,
                messages: [...t.messages, newMsg],
                lastMessage: newMsg,
              }
            : t
        )
      );

      setNewMessage("");
      toast.success("Message sent");
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const filteredThreads = threads.filter((thread) =>
    thread.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "NEEDS_REVISION":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "APPROVED":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  if (loading && teamLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2
            className="h-10 w-10 animate-spin mx-auto"
            style={{ color: branding.primaryColor }}
          />
          <p className="text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-muted-foreground text-sm">
          Chat with your team or about specific requests
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "team" | "requests")}>
        <TabsList className="mb-4">
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team Chat
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <FileText className="h-4 w-4" />
            Request Comments
          </TabsTrigger>
        </TabsList>

        {/* Team Chat Tab */}
        <TabsContent value="team" className="mt-0">
          <Card className="h-[calc(100vh-16rem)]">
            {teamLoading ? (
              <CardContent className="h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            ) : !teamConversation ? (
              <CardContent className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-1">Start a conversation</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mb-4">
                    Send a message to start chatting with the team
                  </p>
                  <div className="max-w-md mx-auto">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendTeamMessage();
                      }}
                      className="flex gap-3"
                    >
                      <Input
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        style={{ backgroundColor: branding.primaryColor }}
                      >
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </form>
                  </div>
                </div>
              </CardContent>
            ) : (
              <div className="flex flex-col h-full">
                {/* Header */}
                <CardHeader className="pb-3 border-b shrink-0">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${branding.primaryColor}15` }}
                    >
                      <Users className="h-5 w-5" style={{ color: branding.primaryColor }} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{teamConversation.teamName}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {teamConversation.participants.length} team member{teamConversation.participants.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                {/* Messages */}
                <CardContent className="flex-1 overflow-y-auto py-4">
                  {teamMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                        <p className="font-medium mb-1">No messages yet</p>
                        <p className="text-sm text-muted-foreground">
                          Send a message to start the conversation
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {teamMessages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "flex gap-3",
                            message.isFromCreator && "flex-row-reverse"
                          )}
                        >
                          <Avatar
                            size="sm"
                            user={{
                              name: message.isFromCreator
                                ? creator?.name || "You"
                                : message.sender?.name || "Team",
                              image: message.isFromCreator
                                ? creator?.image
                                : message.sender?.avatar,
                            }}
                          />
                          <div
                            className={cn(
                              "flex-1 max-w-[75%]",
                              message.isFromCreator && "text-right"
                            )}
                          >
                            <div
                              className={cn(
                                "inline-block rounded-2xl px-4 py-2.5",
                                message.isFromCreator
                                  ? "rounded-tr-none text-white"
                                  : "bg-muted rounded-tl-none"
                              )}
                              style={
                                message.isFromCreator
                                  ? { backgroundColor: branding.primaryColor }
                                  : undefined
                              }
                            >
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                              {/* Forwarded content */}
                              {message.forwardedContent && message.forwardedContent.length > 0 && (
                                <div className="mt-2 space-y-2">
                                  {message.forwardedContent.map((item, idx) => (
                                    <div
                                      key={idx}
                                      className={cn(
                                        "flex items-center gap-2 p-2 rounded-lg text-sm",
                                        message.isFromCreator
                                          ? "bg-white/10"
                                          : "bg-background"
                                      )}
                                    >
                                      {item.type === "upload" && item.data && (
                                        <>
                                          {item.data.thumbnailUrl ? (
                                            <img
                                              src={item.data.thumbnailUrl}
                                              alt=""
                                              className="w-10 h-10 rounded object-cover"
                                            />
                                          ) : (
                                            <ImageIcon className="w-5 h-5" />
                                          )}
                                          <span className="truncate">{item.data.originalName}</span>
                                          <ExternalLink className="w-3 h-3 shrink-0" />
                                        </>
                                      )}
                                      {item.type === "request" && item.data && (
                                        <>
                                          <FileText className="w-5 h-5" />
                                          <span className="truncate">{item.data.title}</span>
                                          <Badge variant="secondary" className="text-[10px]">
                                            {item.data.status}
                                          </Badge>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {format(new Date(message.createdAt), "MMM d, h:mm a")}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </CardContent>

                {/* Message Input */}
                <div className="p-4 border-t shrink-0">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendTeamMessage();
                    }}
                    className="flex gap-3"
                  >
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="submit"
                      disabled={!newMessage.trim() || sending}
                      style={{ backgroundColor: branding.primaryColor }}
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Request Comments Tab */}
        <TabsContent value="requests" className="mt-0">
          <div className="grid md:grid-cols-3 gap-6 h-[calc(100vh-16rem)]">
            {/* Thread List */}
            <Card className={cn(
              "md:col-span-1 flex flex-col",
              selectedThread && "hidden md:flex"
            )}>
              <CardHeader className="pb-3 shrink-0">
                <CardTitle className="text-base hidden md:block">Request Comments</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search requests..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-0">
                {filteredThreads.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="font-medium mb-1">No conversations</p>
                    <p className="text-sm text-muted-foreground">
                      Comments from your requests will appear here
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredThreads.map((thread) => (
                      <button
                        key={thread.id}
                        onClick={() => setSelectedThread(thread)}
                        className={cn(
                          "w-full text-left p-4 hover:bg-muted/50 transition-colors",
                          selectedThread?.id === thread.id && "bg-muted"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${branding.primaryColor}15` }}
                          >
                            <FileText
                              className="h-5 w-5"
                              style={{ color: branding.primaryColor }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <p className="font-medium text-sm truncate">
                                {thread.title}
                              </p>
                              {thread.lastMessage && (
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {formatDistanceToNow(new Date(thread.lastMessage.createdAt), {
                                    addSuffix: false,
                                  })}
                                </span>
                              )}
                            </div>
                            <Badge
                              variant="secondary"
                              className={cn("text-[10px] mb-1", getStatusColor(thread.status))}
                            >
                              {thread.status.replace("_", " ")}
                            </Badge>
                            {thread.lastMessage && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {thread.lastMessage.isAgency ? "Agency: " : "You: "}
                                {thread.lastMessage.content}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chat Area */}
            <Card className={cn(
              "md:col-span-2 flex flex-col",
              !selectedThread && "hidden md:flex"
            )}>
              {selectedThread ? (
                <>
                  {/* Chat Header */}
                  <CardHeader className="pb-3 border-b shrink-0">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden h-8 w-8"
                        onClick={() => setSelectedThread(null)}
                      >
                        <ArrowRight className="h-4 w-4 rotate-180" />
                      </Button>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">
                          {selectedThread.title}
                        </CardTitle>
                        <Badge
                          variant="secondary"
                          className={cn("text-xs mt-1", getStatusColor(selectedThread.status))}
                        >
                          {selectedThread.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/creator/requests/${selectedThread.id}`}>
                          View Request
                        </Link>
                      </Button>
                    </div>
                  </CardHeader>

                  {/* Messages */}
                  <CardContent className="flex-1 overflow-y-auto py-4">
                    {selectedThread.messages.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                          <p className="font-medium mb-1">No comments yet</p>
                          <p className="text-sm text-muted-foreground">
                            Send a comment to start the conversation
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {selectedThread.messages.map((message) => (
                          <div
                            key={message.id}
                            className={cn(
                              "flex gap-3",
                              !message.isAgency && "flex-row-reverse"
                            )}
                          >
                            <Avatar
                              size="sm"
                              user={{
                                name: message.isAgency
                                  ? message.user?.name || "Agency"
                                  : creator?.name || "You",
                                image: message.isAgency
                                  ? message.user?.image
                                  : creator?.image,
                              }}
                            />
                            <div
                              className={cn(
                                "flex-1 max-w-[75%]",
                                !message.isAgency && "text-right"
                              )}
                            >
                              <div
                                className={cn(
                                  "inline-block rounded-2xl px-4 py-2.5",
                                  message.isAgency
                                    ? "bg-muted rounded-tl-none"
                                    : "rounded-tr-none text-white"
                                )}
                                style={
                                  !message.isAgency
                                    ? { backgroundColor: branding.primaryColor }
                                    : undefined
                                }
                              >
                                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {format(new Date(message.createdAt), "MMM d, h:mm a")}
                              </p>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </CardContent>

                  {/* Message Input */}
                  <div className="p-4 border-t shrink-0">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendRequestMessage();
                      }}
                      className="flex gap-3"
                    >
                      <Input
                        placeholder="Type a comment..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        style={{ backgroundColor: branding.primaryColor }}
                      >
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </form>
                  </div>
                </>
              ) : (
                <CardContent className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg mb-1">Select a request</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Choose a request from the list to view and send comments
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
