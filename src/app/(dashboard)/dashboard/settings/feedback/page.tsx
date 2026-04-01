"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Bug,
  Lightbulb,
  MessageCircle,
  Star,
  Filter,
  ChevronLeft,
  Clock,
  User,
  Globe,
  Reply,
  Check,
  Sparkles,
  Loader2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  Feedback,
  FeedbackType,
  FeedbackStatus,
  FeedbackListResponse,
} from "@/types/feedback";
import Link from "next/link";

const typeConfig: Record<FeedbackType, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  BUG: {
    label: "Bug Report",
    icon: <Bug className="h-4 w-4" />,
    color: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-950/30",
  },
  FEATURE_REQUEST: {
    label: "Feature Request",
    icon: <Lightbulb className="h-4 w-4" />,
    color: "text-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
  },
  GENERAL: {
    label: "General",
    icon: <MessageCircle className="h-4 w-4" />,
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
};

const statusConfig: Record<FeedbackStatus, { label: string; color: string; bgColor: string }> = {
  NEW: {
    label: "New",
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800/50",
  },
  REVIEWED: {
    label: "Reviewed",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50",
  },
  IMPLEMENTED: {
    label: "Implemented",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50",
  },
};

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "h-4 w-4",
            rating >= star
              ? "fill-amber-400 text-amber-400"
              : "text-gray-300 dark:text-gray-600"
          )}
        />
      ))}
    </div>
  );
}

export default function FeedbackHistoryPage() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");

  // Reply dialog
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [replyText, setReplyText] = useState("");
  const [newStatus, setNewStatus] = useState<FeedbackStatus | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchFeedback = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/feedback?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch feedback");
      }

      const data: FeedbackListResponse = await response.json();
      setFeedback(data.feedback);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch feedback");
    } finally {
      setIsLoading(false);
    }
  }, [page, typeFilter, statusFilter]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleOpenReply = (item: Feedback) => {
    setSelectedFeedback(item);
    setReplyText(item.adminReply || "");
    setNewStatus(item.status);
  };

  const handleCloseReply = () => {
    setSelectedFeedback(null);
    setReplyText("");
    setNewStatus(null);
  };

  const handleUpdateFeedback = async () => {
    if (!selectedFeedback) return;

    setIsUpdating(true);

    try {
      const response = await fetch("/api/feedback", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedFeedback.id,
          status: newStatus,
          adminReply: replyText.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update feedback");
      }

      // Refresh the list
      await fetchFeedback();
      handleCloseReply();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update feedback");
    } finally {
      setIsUpdating(false);
    }
  };

  const stats = {
    total,
    new: feedback.filter((f) => f.status === "NEW").length,
    reviewed: feedback.filter((f) => f.status === "REVIEWED").length,
    implemented: feedback.filter((f) => f.status === "IMPLEMENTED").length,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/settings">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-violet-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Feedback Management</h1>
              <p className="text-muted-foreground">Review and respond to user feedback</p>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={fetchFeedback} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="card-elevated">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{total}</p>
                <p className="text-sm text-muted-foreground">Total Feedback</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.new}</p>
                <p className="text-sm text-muted-foreground">New</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                <Check className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.reviewed}</p>
                <p className="text-sm text-muted-foreground">Reviewed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.implemented}</p>
                <p className="text-sm text-muted-foreground">Implemented</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="card-elevated">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <div className="flex flex-1 flex-wrap gap-3">
              <Select
                value={typeFilter}
                onValueChange={(value) => {
                  setTypeFilter(value as FeedbackType | "all");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="BUG">Bug Reports</SelectItem>
                  <SelectItem value="FEATURE_REQUEST">Feature Requests</SelectItem>
                  <SelectItem value="GENERAL">General Feedback</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as FeedbackStatus | "all");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="REVIEWED">Reviewed</SelectItem>
                  <SelectItem value="IMPLEMENTED">Implemented</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback List */}
      {isLoading ? (
        <Card className="card-elevated">
          <CardContent className="p-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="card-elevated border-red-200 dark:border-red-800/50">
          <CardContent className="p-6 text-center text-red-600 dark:text-red-400">
            {error}
          </CardContent>
        </Card>
      ) : feedback.length === 0 ? (
        <Card className="card-elevated">
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Feedback Found</h3>
            <p className="text-muted-foreground">
              {typeFilter !== "all" || statusFilter !== "all"
                ? "Try adjusting your filters to see more results."
                : "No feedback has been submitted yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {feedback.map((item) => {
            const typeInfo = typeConfig[item.type];
            const statusInfo = statusConfig[item.status];

            return (
              <Card key={item.id} className="card-elevated hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    {/* Type Icon */}
                    <div className={cn("p-3 rounded-xl shrink-0", typeInfo.bgColor)}>
                      <div className={typeInfo.color}>{typeInfo.icon}</div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Header */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn("border", statusInfo.bgColor, statusInfo.color)}>
                          {statusInfo.label}
                        </Badge>
                        <Badge variant="secondary" className={typeInfo.color}>
                          {typeInfo.label}
                        </Badge>
                        <StarRating rating={item.rating} />
                      </div>

                      {/* Message */}
                      <p className="text-sm leading-relaxed">{item.message}</p>

                      {/* Admin Reply */}
                      {item.adminReply && (
                        <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50">
                          <div className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400 mb-1">
                            <Reply className="h-4 w-4" />
                            <span className="font-medium">Admin Reply</span>
                            {item.repliedBy && (
                              <span className="text-muted-foreground">by {item.repliedBy}</span>
                            )}
                          </div>
                          <p className="text-sm">{item.adminReply}</p>
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {item.userName}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(item.createdAt)}
                        </div>
                        {item.pageUrl && (
                          <a
                            href={item.pageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-violet-500 transition-colors"
                          >
                            <Globe className="h-3.5 w-3.5" />
                            Page URL
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenReply(item)}
                      >
                        <Reply className="h-4 w-4 mr-1" />
                        {item.adminReply ? "Edit Reply" : "Reply"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Reply Dialog */}
      <Dialog open={!!selectedFeedback} onOpenChange={(open) => !open && handleCloseReply()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Reply className="h-5 w-5 text-violet-500" />
              Respond to Feedback
            </DialogTitle>
            <DialogDescription>
              Update the status and send a reply to the user.
            </DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-5 py-4">
              {/* Original Feedback Summary */}
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className={typeConfig[selectedFeedback.type].color}>
                    {typeConfig[selectedFeedback.type].label}
                  </Badge>
                  <StarRating rating={selectedFeedback.rating} />
                </div>
                <p className="text-sm line-clamp-3">{selectedFeedback.message}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  From {selectedFeedback.userName} on {formatDate(selectedFeedback.createdAt)}
                </p>
              </div>

              {/* Status Update */}
              <div className="space-y-2">
                <Label>Update Status</Label>
                <Select
                  value={newStatus || selectedFeedback.status}
                  onValueChange={(value) => setNewStatus(value as FeedbackStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">New</SelectItem>
                    <SelectItem value="REVIEWED">Reviewed</SelectItem>
                    <SelectItem value="IMPLEMENTED">Implemented</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reply */}
              <div className="space-y-2">
                <Label>Admin Reply (optional)</Label>
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a response to this feedback..."
                  className="min-h-[100px] resize-none"
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {replyText.length}/2000
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleCloseReply}
              className="flex-1"
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateFeedback}
              disabled={isUpdating}
              className="flex-1 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
