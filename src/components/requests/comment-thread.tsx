"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Reply,
  Pencil,
  Trash2,
  Lock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { CommentEditor } from "./comment-editor";
import { CommentReactions } from "./comment-reactions";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

export interface CommentUser {
  id: string;
  name: string;
  avatar?: string | null;
}

export interface CommentReaction {
  emoji: string;
  userIds: string[];
}

export interface CommentAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Comment {
  id: string;
  message: string;
  isInternal: boolean;
  createdAt: Date;
  editedAt?: Date | null;
  user: CommentUser;
  parentId?: string | null;
  replies?: Comment[];
  mentions: string[];
  attachments: CommentAttachment[];
  reactions: Record<string, string[]>; // emoji -> userIds
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

interface CommentThreadProps {
  requestId: string;
  uploadId?: string;
  comments: Comment[];
  currentUserId: string;
  teamMembers: TeamMember[];
  onCommentAdded?: (comment: Comment) => void;
  onCommentUpdated?: (comment: Comment) => void;
  onCommentDeleted?: (commentId: string) => void;
}

// ============================================
// SINGLE COMMENT COMPONENT
// ============================================

interface SingleCommentProps {
  comment: Comment;
  currentUserId: string;
  teamMembers: TeamMember[];
  requestId: string;
  uploadId?: string;
  depth?: number;
  onReply: (parentId: string) => void;
  onEdit: (comment: Comment) => void;
  onDelete: (commentId: string) => void;
  onReaction: (commentId: string, emoji: string) => void;
  replyingTo: string | null;
  editingId: string | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSubmitReply: (message: string, mentions: string[], attachments: File[]) => Promise<void>;
  onSubmitEdit: (message: string, mentions: string[], attachments: File[]) => Promise<void>;
}

function SingleComment({
  comment,
  currentUserId,
  teamMembers,
  requestId,
  uploadId,
  depth = 0,
  onReply,
  onEdit,
  onDelete,
  onReaction,
  replyingTo,
  editingId,
  onCancelReply,
  onCancelEdit,
  onSubmitReply,
  onSubmitEdit,
}: SingleCommentProps) {
  const [showReplies, setShowReplies] = useState(true);
  const isOwner = comment.user.id === currentUserId;
  const isEditing = editingId === comment.id;
  const isReplying = replyingTo === comment.id;
  const hasReplies = comment.replies && comment.replies.length > 0;

  // Maximum depth for visual indentation (after this, no more indentation)
  const maxIndentDepth = 4;
  const indentLevel = Math.min(depth, maxIndentDepth);

  // Parse mentions in message and highlight them
  const renderMessage = (message: string) => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(message)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(message.slice(lastIndex, match.index));
      }
      // Add highlighted mention
      parts.push(
        <span
          key={match.index}
          className="inline-flex items-center px-1 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-sm font-medium"
        >
          @{match[1]}
        </span>
      );
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < message.length) {
      parts.push(message.slice(lastIndex));
    }

    return parts.length > 0 ? parts : message;
  };

  if (isEditing) {
    return (
      <div className={cn("pl-4", indentLevel > 0 && `ml-${indentLevel * 6}`)}>
        <CommentEditor
          teamMembers={teamMembers}
          initialValue={comment.message}
          onSubmit={onSubmitEdit}
          onCancel={onCancelEdit}
          submitLabel="Save"
          placeholder="Edit your comment..."
        />
      </div>
    );
  }

  return (
    <div className={cn("group", indentLevel > 0 && "border-l-2 border-gray-200 dark:border-gray-700")}>
      <div
        className={cn(
          "flex gap-3 p-3 rounded-lg transition-colors",
          comment.isInternal
            ? "bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800"
            : "bg-gray-50 dark:bg-gray-800/50",
          indentLevel > 0 && "ml-4"
        )}
      >
        <Avatar
          user={comment.user}
          size="sm"
          className="flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm">{comment.user.name}</span>
            {comment.isInternal && (
              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Internal
              </span>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatDistanceToNow(new Date(comment.createdAt), {
                addSuffix: true,
              })}
            </span>
            {comment.editedAt && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                (edited)
              </span>
            )}
          </div>

          {/* Message */}
          <p className="text-sm whitespace-pre-wrap break-words">
            {renderMessage(comment.message)}
          </p>

          {/* Attachments */}
          {comment.attachments && comment.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {comment.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <span className="truncate max-w-[150px]">{attachment.name}</span>
                </a>
              ))}
            </div>
          )}

          {/* Reactions */}
          <CommentReactions
            reactions={comment.reactions}
            currentUserId={currentUserId}
            onReact={(emoji) => onReaction(comment.id, emoji)}
            teamMembers={teamMembers}
          />

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onReply(comment.id)}
            >
              <Reply className="h-3 w-3 mr-1" />
              Reply
            </Button>

            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => onEdit(comment)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(comment.id)}
                    className="text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Reply form */}
      {isReplying && (
        <div className={cn("mt-2", indentLevel > 0 && "ml-4")}>
          <CommentEditor
            teamMembers={teamMembers}
            onSubmit={onSubmitReply}
            onCancel={onCancelReply}
            submitLabel="Reply"
            placeholder={`Reply to ${comment.user.name}...`}
            autoFocus
          />
        </div>
      )}

      {/* Replies toggle */}
      {hasReplies && (
        <div className={cn("mt-2", indentLevel > 0 && "ml-4")}>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-gray-500 dark:text-gray-400"
            onClick={() => setShowReplies(!showReplies)}
          >
            {showReplies ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Hide {comment.replies!.length} {comment.replies!.length === 1 ? "reply" : "replies"}
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show {comment.replies!.length} {comment.replies!.length === 1 ? "reply" : "replies"}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Nested replies */}
      {hasReplies && showReplies && (
        <div className="mt-2 space-y-2">
          {comment.replies!.map((reply) => (
            <SingleComment
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              teamMembers={teamMembers}
              requestId={requestId}
              uploadId={uploadId}
              depth={depth + 1}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onReaction={onReaction}
              replyingTo={replyingTo}
              editingId={editingId}
              onCancelReply={onCancelReply}
              onCancelEdit={onCancelEdit}
              onSubmitReply={onSubmitReply}
              onSubmitEdit={onSubmitEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN COMMENT THREAD COMPONENT
// ============================================

export function CommentThread({
  requestId,
  uploadId,
  comments: initialComments,
  currentUserId,
  teamMembers,
  onCommentAdded,
  onCommentUpdated,
  onCommentDeleted,
}: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);

  // Build a nested structure from flat comments
  const buildCommentTree = useCallback((flatComments: Comment[]): Comment[] => {
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    // First pass: create map and initialize replies
    flatComments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: build tree
    flatComments.forEach((comment) => {
      const mappedComment = commentMap.get(comment.id)!;
      if (comment.parentId && commentMap.has(comment.parentId)) {
        commentMap.get(comment.parentId)!.replies!.push(mappedComment);
      } else {
        rootComments.push(mappedComment);
      }
    });

    return rootComments;
  }, []);

  const nestedComments = buildCommentTree(comments);

  // Handle reply
  const handleReply = (parentId: string) => {
    setReplyingTo(parentId);
    setEditingId(null);
    setEditingComment(null);
  };

  // Handle edit
  const handleEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditingComment(comment);
    setReplyingTo(null);
  };

  // Handle delete
  const handleDelete = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      const response = await fetch(`/api/comments?id=${commentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete comment");
      }

      // Remove from local state (including nested)
      const removeComment = (list: Comment[]): Comment[] => {
        return list
          .filter((c) => c.id !== commentId)
          .map((c) => ({
            ...c,
            replies: c.replies ? removeComment(c.replies) : [],
          }));
      };

      setComments(removeComment(comments));
      onCommentDeleted?.(commentId);
      toast.success("Comment deleted");
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  // Handle reaction
  const handleReaction = async (commentId: string, emoji: string) => {
    try {
      const response = await fetch("/api/comments/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, emoji }),
      });

      if (!response.ok) {
        throw new Error("Failed to react");
      }

      const { reactions } = await response.json();

      // Update local state
      const updateReactions = (list: Comment[]): Comment[] => {
        return list.map((c) => {
          if (c.id === commentId) {
            return { ...c, reactions };
          }
          if (c.replies) {
            return { ...c, replies: updateReactions(c.replies) };
          }
          return c;
        });
      };

      setComments(updateReactions(comments));
    } catch {
      toast.error("Failed to react");
    }
  };

  // Submit reply
  const handleSubmitReply = async (
    message: string,
    mentions: string[],
    attachments: File[]
  ) => {
    try {
      const formData = new FormData();
      formData.append("requestId", requestId);
      if (uploadId) formData.append("uploadId", uploadId);
      formData.append("message", message);
      formData.append("parentId", replyingTo!);
      formData.append("mentions", JSON.stringify(mentions));
      attachments.forEach((file) => formData.append("attachments", file));

      const response = await fetch("/api/comments", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to add reply");
      }

      const newComment = await response.json();
      setComments([...comments, newComment]);
      setReplyingTo(null);
      onCommentAdded?.(newComment);
      toast.success("Reply added");
    } catch {
      toast.error("Failed to add reply");
    }
  };

  // Submit edit
  const handleSubmitEdit = async (
    message: string,
    mentions: string[],
    attachments: File[]
  ) => {
    if (!editingComment) return;

    try {
      const formData = new FormData();
      formData.append("id", editingComment.id);
      formData.append("message", message);
      formData.append("mentions", JSON.stringify(mentions));
      attachments.forEach((file) => formData.append("attachments", file));

      const response = await fetch("/api/comments", {
        method: "PATCH",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to update comment");
      }

      const updatedComment = await response.json();

      // Update local state
      const updateComment = (list: Comment[]): Comment[] => {
        return list.map((c) => {
          if (c.id === updatedComment.id) {
            return { ...updatedComment, replies: c.replies };
          }
          if (c.replies) {
            return { ...c, replies: updateComment(c.replies) };
          }
          return c;
        });
      };

      setComments(updateComment(comments));
      setEditingId(null);
      setEditingComment(null);
      onCommentUpdated?.(updatedComment);
      toast.success("Comment updated");
    } catch {
      toast.error("Failed to update comment");
    }
  };

  // Submit new top-level comment
  const handleSubmitNew = async (
    message: string,
    mentions: string[],
    attachments: File[],
    isInternal?: boolean
  ) => {
    try {
      const formData = new FormData();
      formData.append("requestId", requestId);
      if (uploadId) formData.append("uploadId", uploadId);
      formData.append("message", message);
      formData.append("isInternal", String(isInternal ?? false));
      formData.append("mentions", JSON.stringify(mentions));
      attachments.forEach((file) => formData.append("attachments", file));

      const response = await fetch("/api/comments", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to add comment");
      }

      const newComment = await response.json();
      setComments([newComment, ...comments]);
      onCommentAdded?.(newComment);
      toast.success("Comment added");
    } catch {
      toast.error("Failed to add comment");
    }
  };

  return (
    <div className="space-y-6">
      {/* New Comment Form */}
      <CommentEditor
        teamMembers={teamMembers}
        onSubmit={handleSubmitNew}
        submitLabel="Send"
        placeholder="Add a comment..."
        showInternalToggle
      />

      {/* Comments List */}
      {nestedComments.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-4">
          {nestedComments.map((comment) => (
            <SingleComment
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              teamMembers={teamMembers}
              requestId={requestId}
              uploadId={uploadId}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReaction={handleReaction}
              replyingTo={replyingTo}
              editingId={editingId}
              onCancelReply={() => setReplyingTo(null)}
              onCancelEdit={() => {
                setEditingId(null);
                setEditingComment(null);
              }}
              onSubmitReply={handleSubmitReply}
              onSubmitEdit={handleSubmitEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
