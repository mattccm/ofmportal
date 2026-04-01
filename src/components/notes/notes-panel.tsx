"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  StickyNote,
  Plus,
  Search,
  Pin,
  Hash,
  Loader2,
  Filter,
  X,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { NoteCard } from "./note-card";
import {
  type Note,
  searchNotes,
  sortNotes,
  getAllHashtags,
  filterByHashtag,
} from "@/lib/notes-utils";

interface NotesPanelProps {
  entityType: "request" | "creator" | "upload";
  entityId: string;
  initialNotes: Note[];
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
  onNotesChange?: (notes: Note[]) => void;
  apiBasePath?: string; // e.g., "/api/notes" or "/api/creators/[id]/notes"
  title?: string;
  description?: string;
  compact?: boolean;
}

export function NotesPanel({
  entityType,
  entityId,
  initialNotes,
  currentUser,
  onNotesChange,
  apiBasePath = "/api/notes",
  title = "Internal Notes",
  description = "Private notes only visible to team members",
  compact = false,
}: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNotePinned, setNewNotePinned] = useState(false);
  const [newNoteInternal, setNewNoteInternal] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // All unique hashtags
  const allHashtags = useMemo(() => getAllHashtags(notes), [notes]);

  // Filtered and sorted notes
  const displayedNotes = useMemo(() => {
    let filtered = notes;

    // Filter by search query
    if (searchQuery) {
      filtered = searchNotes(filtered, searchQuery);
    }

    // Filter by hashtag
    if (selectedHashtag) {
      filtered = filterByHashtag(filtered, selectedHashtag);
    }

    // Filter pinned only
    if (showPinnedOnly) {
      filtered = filtered.filter((note) => note.isPinned);
    }

    // Sort with pinned first
    return sortNotes(filtered);
  }, [notes, searchQuery, selectedHashtag, showPinnedOnly]);

  // Update notes state and notify parent
  const updateNotes = useCallback(
    (newNotes: Note[]) => {
      setNotes(newNotes);
      onNotesChange?.(newNotes);
    },
    [onNotesChange]
  );

  // Add new note
  const handleAddNote = async () => {
    if (!newNoteContent.trim()) {
      toast.error("Note content is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(apiBasePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          content: newNoteContent,
          isPinned: newNotePinned,
          isInternal: newNoteInternal,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add note");
      }

      const { note } = await response.json();
      updateNotes([note, ...notes]);

      // Reset form
      setNewNoteContent("");
      setNewNotePinned(false);
      setNewNoteInternal(true);
      setAddDialogOpen(false);

      toast.success("Note added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add note");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit note
  const handleEditNote = async (noteId: string, content: string) => {
    const response = await fetch(apiBasePath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        noteId,
        content,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to update note");
    }

    const { note: updatedNote } = await response.json();
    updateNotes(
      notes.map((n) => (n.id === noteId ? updatedNote : n))
    );
  };

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    const response = await fetch(`${apiBasePath}?noteId=${noteId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to delete note");
    }

    updateNotes(notes.filter((n) => n.id !== noteId));
  };

  // Toggle pin
  const handleTogglePin = async (noteId: string, isPinned: boolean) => {
    const response = await fetch(apiBasePath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        noteId,
        isPinned,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to update note");
    }

    const { note: updatedNote } = await response.json();
    updateNotes(
      notes.map((n) => (n.id === noteId ? updatedNote : n))
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedHashtag(null);
    setShowPinnedOnly(false);
  };

  const hasActiveFilters = searchQuery || selectedHashtag || showPinnedOnly;

  if (compact) {
    return (
      <div className="space-y-4">
        {/* Compact Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">{title}</span>
            <Badge variant="secondary" className="h-5 text-xs">
              {notes.length}
            </Badge>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>

        {/* Compact Notes List */}
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No notes yet
          </p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {sortNotes(notes.slice(0, 5)).map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                currentUserId={currentUser.id}
                onEdit={handleEditNote}
                onDelete={handleDeleteNote}
                onTogglePin={handleTogglePin}
              />
            ))}
            {notes.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                +{notes.length - 5} more notes
              </p>
            )}
          </div>
        )}

        {/* Add Note Dialog */}
        <AddNoteDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          content={newNoteContent}
          setContent={setNewNoteContent}
          isPinned={newNotePinned}
          setIsPinned={setNewNotePinned}
          isInternal={newNoteInternal}
          setIsInternal={setNewNoteInternal}
          isSubmitting={isSubmitting}
          onSubmit={handleAddNote}
        />
      </div>
    );
  }

  return (
    <Card className="card-elevated">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-amber-500" />
              {title}
              <Badge variant="secondary" className="ml-2">
                {notes.length}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search and Filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(hasActiveFilters && "ring-2 ring-primary/20")}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="p-4 rounded-lg bg-muted/50 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Filters</span>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear all
                </Button>
              )}
            </div>

            {/* Pinned filter */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="pinned-only"
                checked={showPinnedOnly}
                onCheckedChange={(checked) => setShowPinnedOnly(checked === true)}
              />
              <Label htmlFor="pinned-only" className="text-sm cursor-pointer">
                <Pin className="h-3 w-3 inline mr-1" />
                Pinned only
              </Label>
            </div>

            {/* Hashtag filter */}
            {allHashtags.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  <Hash className="h-3 w-3 inline mr-1" />
                  Filter by tag
                </p>
                <div className="flex flex-wrap gap-1">
                  {allHashtags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={selectedHashtag === tag ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer transition-colors",
                        selectedHashtag === tag
                          ? "bg-violet-600 hover:bg-violet-700"
                          : "hover:bg-violet-100 dark:hover:bg-violet-900/30"
                      )}
                      onClick={() =>
                        setSelectedHashtag(selectedHashtag === tag ? null : tag)
                      }
                    >
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notes List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : displayedNotes.length === 0 ? (
          <div className="text-center py-12">
            <StickyNote className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            {hasActiveFilters ? (
              <>
                <h3 className="text-lg font-semibold">No matching notes</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your search or filters
                </p>
                <Button variant="outline" className="mt-4" onClick={clearFilters}>
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold">No notes yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add a note to keep track of important information
                </p>
                <Button className="mt-4" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Note
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                currentUserId={currentUser.id}
                onEdit={handleEditNote}
                onDelete={handleDeleteNote}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        )}
      </CardContent>

      {/* Add Note Dialog */}
      <AddNoteDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        content={newNoteContent}
        setContent={setNewNoteContent}
        isPinned={newNotePinned}
        setIsPinned={setNewNotePinned}
        isInternal={newNoteInternal}
        setIsInternal={setNewNoteInternal}
        isSubmitting={isSubmitting}
        onSubmit={handleAddNote}
      />
    </Card>
  );
}

// Add Note Dialog Component
interface AddNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  setContent: (content: string) => void;
  isPinned: boolean;
  setIsPinned: (pinned: boolean) => void;
  isInternal: boolean;
  setIsInternal: (internal: boolean) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}

function AddNoteDialog({
  open,
  onOpenChange,
  content,
  setContent,
  isPinned,
  setIsPinned,
  isInternal,
  setIsInternal,
  isSubmitting,
  onSubmit,
}: AddNoteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-amber-500" />
            Add Note
          </DialogTitle>
          <DialogDescription>
            Add a note with optional @mentions and #hashtags
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="Write your note...

Use @username to mention someone
Use #tag to add hashtags"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="resize-none"
          />

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="pin-note"
                checked={isPinned}
                onCheckedChange={(checked) => setIsPinned(checked === true)}
              />
              <Label htmlFor="pin-note" className="text-sm cursor-pointer">
                <Pin className="h-3 w-3 inline mr-1" />
                Pin this note
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="internal-note"
                checked={isInternal}
                onCheckedChange={(checked) => setIsInternal(checked === true)}
              />
              <Label htmlFor="internal-note" className="text-sm cursor-pointer">
                <Lock className="h-3 w-3 inline mr-1" />
                Internal only
              </Label>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>
              <strong>Tip:</strong> Use **bold**, *italic*, `code`, and ~~strikethrough~~ for formatting.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting || !content.trim()}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Adding...
              </>
            ) : (
              "Add Note"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Export a simpler inline notes component for modals
interface InlineNotesProps {
  entityType: "request" | "creator" | "upload";
  entityId: string;
  notes: Note[];
  currentUser: {
    id: string;
    name: string;
  };
  onAddNote: (content: string, isPinned: boolean) => Promise<void>;
  onEditNote: (noteId: string, content: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onTogglePin: (noteId: string, isPinned: boolean) => Promise<void>;
}

export function InlineNotes({
  entityType,
  entityId,
  notes,
  currentUser,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onTogglePin,
}: InlineNotesProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newContent.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddNote(newContent, false);
      setNewContent("");
      setShowAddForm(false);
    } catch {
      toast.error("Failed to add note");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedNotes = sortNotes(notes);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">Notes</span>
          {notes.length > 0 && (
            <Badge variant="secondary" className="h-5 text-xs">
              {notes.length}
            </Badge>
          )}
        </div>
        {!showAddForm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="space-y-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30">
          <Textarea
            placeholder="Write a note..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
            className="bg-white/50 dark:bg-black/20"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAddForm(false);
                setNewContent("");
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || !newContent.trim()}
            >
              {isSubmitting ? "Adding..." : "Add"}
            </Button>
          </div>
        </div>
      )}

      {/* Notes List */}
      {sortedNotes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No notes yet
        </p>
      ) : (
        <div className="space-y-2">
          {sortedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              currentUserId={currentUser.id}
              onEdit={onEditNote}
              onDelete={onDeleteNote}
              onTogglePin={onTogglePin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
