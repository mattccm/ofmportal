"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAccess } from "@/lib/access/client";
import {
  MoreHorizontal,
  Edit2,
  Trash2,
  Pin,
  PinOff,
  Copy,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { type Note, formatNoteContent, formatNoteTime } from "@/lib/notes-utils";

interface NoteCardProps {
  note: Note;
  currentUserId: string;
  onEdit: (noteId: string, content: string) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
  onTogglePin: (noteId: string, isPinned: boolean) => Promise<void>;
  isEditing?: boolean;
  showEntityLink?: boolean;
}

export function NoteCard({
  note,
  currentUserId,
  onEdit,
  onDelete,
  onTogglePin,
  isEditing: initialEditing = false,
  showEntityLink = false,
}: NoteCardProps) {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [editContent, setEditContent] = useState(note.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { can } = useAccess();
  const isAuthor = note.authorId === currentUserId;
  // Anyone deletes their own notes; notes.moderate deletes anyone's
  const canDelete = isAuthor || can("notes.moderate");
  const wasEdited = note.updatedAt !== note.createdAt;

  const handleSaveEdit = async () => {
    if (!editContent.trim()) {
      toast.error("Note content cannot be empty");
      return;
    }

    if (editContent === note.content) {
      setIsEditing(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await onEdit(note.id, editContent);
      setIsEditing(false);
      toast.success("Note updated");
    } catch {
      toast.error("Failed to update note");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(note.content);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(note.id);
      setDeleteDialogOpen(false);
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTogglePin = async () => {
    try {
      await onTogglePin(note.id, !note.isPinned);
      toast.success(note.isPinned ? "Note unpinned" : "Note pinned");
    } catch {
      toast.error("Failed to update note");
    }
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(note.content);
    toast.success("Note copied to clipboard");
  };

  return (
    <>
      <div
        className={cn(
          "group relative p-4 rounded-lg border transition-all duration-200",
          // Sticky note styling
          "bg-tile-hi border-transparent hover:border-ctl",
          // Pinned state
          note.isPinned && "border-ctl-hi",
          // Internal note indicator
          note.isInternal && "bg-tile-hi"
        )}
      >
        {/* Pin indicator */}
        {note.isPinned && (
          <div className="absolute -top-2 -right-2 z-10">
            <div className="h-6 w-6 rounded-full bg-raised flex items-center justify-center shadow-sm">
              <Pin className="h-3 w-3 text-ink" />
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">
              {note.authorName}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatNoteTime(note.createdAt)}
            </span>
            {wasEdited && (
              <span className="text-xs text-muted-foreground italic">
                (edited)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {note.isInternal && (
              <Badge
                variant="outline"
                className="h-5 text-xs bg-tile-hi text-foreground border-line dark:border-line"
              >
                <Lock className="h-3 w-3 mr-1" />
                Internal
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button aria-label="Note actions"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={handleTogglePin}>
                  {note.isPinned ? (
                    <>
                      <PinOff className="h-4 w-4 mr-2" />
                      Unpin
                    </>
                  ) : (
                    <>
                      <Pin className="h-4 w-4 mr-2" />
                      Pin Note
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyContent}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    {isAuthor && (
                      <DropdownMenuItem onClick={() => setIsEditing(true)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => setDeleteDialogOpen(true)}
                      className="text-late focus:text-late"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Write your note..."
              rows={4}
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={isSubmitting || !editContent.trim()}
              >
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="text-sm text-foreground/90 whitespace-pre-wrap break-words prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: formatNoteContent(note.content) }}
          />
        )}

        {/* Hashtags */}
        {note.hashtags.length > 0 && !isEditing && (
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-line">
            {note.hashtags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="h-5 text-xs bg-tile-hi text-foreground cursor-pointer hover:bg-tile-hi dark:hover:bg-tile-hi"
              >
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Entity link (optional) */}
        {showEntityLink && (
          <div className="mt-3 pt-3 border-t border-line">
            <span className="text-xs text-muted-foreground">
              On {note.entityType}: {note.entityId}
            </span>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this note? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Compact version for lists
interface CompactNoteCardProps {
  note: Note;
  onClick?: () => void;
}

export function CompactNoteCard({ note, onClick }: CompactNoteCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all duration-200",
        "bg-tile-hi border-transparent hover:border-ctl",
        note.isPinned && "border-ctl-hi"
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        {note.isPinned && <Pin className="h-3 w-3 text-icon" />}
        <span className="text-xs font-medium text-foreground truncate">
          {note.authorName}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatNoteTime(note.createdAt)}
        </span>
      </div>
      <p className="text-sm text-foreground/80 line-clamp-2">{note.content}</p>
    </button>
  );
}
