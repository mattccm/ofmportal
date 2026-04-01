"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Lock, AtSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { MentionInput, RenderMentions } from "@/components/mentions";
import type { MentionInputRef } from "@/components/mentions";
import { textToMentionSegments, extractMentionIds } from "@/lib/mention-parser";

// ============================================
// TYPES
// ============================================

interface Comment {
  id: string;
  message: string;
  isInternal: boolean;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email?: string;
    image?: string | null;
  };
  mentions?: string[];
}

interface CommentSectionProps {
  requestId: string;
  uploadId?: string;
  comments: Comment[];
  currentUserId?: string;
}

// ============================================
// COMMENT SECTION COMPONENT
// ============================================

export function CommentSection({
  requestId,
  uploadId,
  comments: initialComments,
  currentUserId,
}: CommentSectionProps) {
  const [comments, setComments] = useState(initialComments);
  const [newComment, setNewComment] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const mentionInputRef = useRef<MentionInputRef>(null);

  // Handle comment text change
  const handleCommentChange = useCallback(
    (value: string, mentions: string[]) => {
      setNewComment(value);
      setMentionIds(mentions);
    },
    []
  );

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      // Create the comment
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          uploadId,
          message: newComment,
          isInternal,
          mentions: mentionIds,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add comment");
      }

      const comment = await response.json();

      // Create mentions if there are any
      if (mentionIds.length > 0) {
        await fetch("/api/mentions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            commentId: comment.id,
            message: newComment,
            resourceType: uploadId ? "upload" : "request",
            resourceId: uploadId || requestId,
          }),
        });
      }

      setComments([comment, ...comments]);
      setNewComment("");
      setMentionIds([]);
      setIsInternal(false);
      mentionInputRef.current?.clear();

      toast.success(
        mentionIds.length > 0
          ? `Comment added and ${mentionIds.length} team member${mentionIds.length !== 1 ? "s" : ""} notified`
          : "Comment added"
      );
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle submit from mention input (Enter key)
  const handleMentionSubmit = useCallback(
    (text: string, mentions: string[]) => {
      setNewComment(text);
      setMentionIds(mentions);
      // Trigger form submit
      const form = document.getElementById("comment-form") as HTMLFormElement;
      if (form) {
        form.requestSubmit();
      }
    },
    []
  );

  return (
    <div className="space-y-6">
      {/* New Comment Form */}
      <form id="comment-form" onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <MentionInput
            ref={mentionInputRef}
            value={newComment}
            onChange={handleCommentChange}
            onSubmit={handleMentionSubmit}
            placeholder="Add a comment... Type @ to mention someone"
            rows={3}
            disabled={submitting}
            className="pr-10"
          />
          {/* Mention hint */}
          {mentionIds.length === 0 && newComment.length === 0 && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 text-xs text-muted-foreground pointer-events-none">
              <AtSign className="h-3 w-3" />
              <span>to mention</span>
            </div>
          )}
        </div>

        {/* Mentioned users indicator */}
        {mentionIds.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AtSign className="h-3 w-3" />
            <span>
              {mentionIds.length} team member{mentionIds.length !== 1 ? "s" : ""} will
              be notified
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="internal"
              checked={isInternal}
              onCheckedChange={(checked) => setIsInternal(!!checked)}
              disabled={submitting}
            />
            <Label
              htmlFor="internal"
              className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1"
            >
              <Lock className="h-3 w-3" />
              Internal only (not visible to creator)
            </Label>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!newComment.trim() || submitting}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send
          </Button>
        </div>
      </form>

      {/* Comments List */}
      {comments.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// COMMENT ITEM COMPONENT
// ============================================

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
}

function CommentItem({ comment, currentUserId }: CommentItemProps) {
  // Parse message for mentions
  const segments = textToMentionSegments(comment.message);
  const hasMentions = segments.some((s) => s.type === "mention");

  return (
    <div
      className={`flex gap-3 p-3 rounded-lg ${
        comment.isInternal
          ? "bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/30"
          : "bg-gray-50 dark:bg-gray-800/50"
      }`}
    >
      <Avatar
        user={{
          name: comment.user.name,
          email: comment.user.email,
          image: comment.user.image,
        }}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-medium text-sm">
            {comment.user.name ?? "Unknown"}
          </span>
          {comment.isInternal && (
            <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Internal
            </span>
          )}
          {hasMentions && (
            <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <AtSign className="h-3 w-3" />
              Mentions
            </span>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatDistanceToNow(new Date(comment.createdAt), {
              addSuffix: true,
            })}
          </span>
        </div>
        <div className="text-sm whitespace-pre-wrap break-words">
          <RenderMentions
            segments={segments}
            currentUserId={currentUserId}
            showHoverCards
          />
        </div>
      </div>
    </div>
  );
}

export default CommentSection;
