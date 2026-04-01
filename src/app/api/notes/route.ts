import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
  createNote,
  extractMentions,
  extractHashtags,
  type Note,
} from "@/lib/notes-utils";

// Types for stored notes
interface StoredNote {
  id: string;
  content: string;
  entityType: "request" | "creator" | "upload";
  entityId: string;
  authorId: string;
  authorName: string;
  isPinned: boolean;
  isInternal: boolean;
  createdAt: string;
  updatedAt: string;
  mentions: string[];
  hashtags: string[];
}

// Schema validation
const createNoteSchema = z.object({
  entityType: z.enum(["request", "creator", "upload"]),
  entityId: z.string().min(1),
  content: z.string().min(1, "Note content is required"),
  isPinned: z.boolean().default(false),
  isInternal: z.boolean().default(true),
});

const updateNoteSchema = z.object({
  noteId: z.string().min(1),
  content: z.string().min(1).optional(),
  isPinned: z.boolean().optional(),
});

const searchSchema = z.object({
  entityType: z.enum(["request", "creator", "upload"]).optional(),
  entityId: z.string().optional(),
  query: z.string().optional(),
  hashtag: z.string().optional(),
  pinnedOnly: z.boolean().optional(),
});

// Helper to get notes storage field based on entity type
async function getEntityNotes(
  entityType: string,
  entityId: string,
  agencyId: string
): Promise<{ entity: Record<string, unknown> | null; notes: StoredNote[] }> {
  let entity: Record<string, unknown> | null = null;
  let notes: StoredNote[] = [];

  switch (entityType) {
    case "request": {
      const request = await db.contentRequest.findFirst({
        where: { id: entityId, agencyId },
        select: { id: true, requirements: true },
      });
      if (request) {
        entity = request as unknown as Record<string, unknown>;
        const reqs = (request.requirements as Record<string, unknown>) || {};
        notes = (reqs.internalNotes as StoredNote[]) || [];
      }
      break;
    }
    case "creator": {
      const creator = await db.creator.findFirst({
        where: { id: entityId, agencyId },
        select: { id: true, contentPreferences: true },
      });
      if (creator) {
        entity = creator as unknown as Record<string, unknown>;
        const prefs = (creator.contentPreferences as Record<string, unknown>) || {};
        notes = (prefs.internalNotes as StoredNote[]) || [];
      }
      break;
    }
    case "upload": {
      const upload = await db.upload.findFirst({
        where: {
          id: entityId,
          request: { agencyId },
        },
        select: { id: true, metadata: true },
      });
      if (upload) {
        entity = upload as unknown as Record<string, unknown>;
        const metadata = (upload.metadata as Record<string, unknown>) || {};
        notes = (metadata.internalNotes as StoredNote[]) || [];
      }
      break;
    }
  }

  return { entity, notes };
}

// Helper to save notes back to entity
async function saveEntityNotes(
  entityType: string,
  entityId: string,
  notes: StoredNote[]
): Promise<void> {
  switch (entityType) {
    case "request": {
      const request = await db.contentRequest.findUnique({
        where: { id: entityId },
        select: { requirements: true },
      });
      const reqs = (request?.requirements as Record<string, unknown>) || {};
      await db.contentRequest.update({
        where: { id: entityId },
        data: {
          requirements: { ...reqs, internalNotes: notes } as unknown as Prisma.InputJsonValue,
        },
      });
      break;
    }
    case "creator": {
      const creator = await db.creator.findUnique({
        where: { id: entityId },
        select: { contentPreferences: true },
      });
      const prefs = (creator?.contentPreferences as Record<string, unknown>) || {};
      await db.creator.update({
        where: { id: entityId },
        data: {
          contentPreferences: { ...prefs, internalNotes: notes } as unknown as Prisma.InputJsonValue,
        },
      });
      break;
    }
    case "upload": {
      const upload = await db.upload.findUnique({
        where: { id: entityId },
        select: { metadata: true },
      });
      const metadata = (upload?.metadata as Record<string, unknown>) || {};
      await db.upload.update({
        where: { id: entityId },
        data: {
          metadata: { ...metadata, internalNotes: notes } as unknown as Prisma.InputJsonValue,
        },
      });
      break;
    }
  }
}

// GET - Fetch notes for an entity or search across entities
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const entityType = url.searchParams.get("entityType");
    const entityId = url.searchParams.get("entityId");
    const query = url.searchParams.get("query");
    const hashtag = url.searchParams.get("hashtag");
    const pinnedOnly = url.searchParams.get("pinnedOnly") === "true";

    // If fetching notes for a specific entity
    if (entityType && entityId) {
      const { entity, notes } = await getEntityNotes(
        entityType,
        entityId,
        session.user.agencyId
      );

      if (!entity) {
        return NextResponse.json({ error: "Entity not found" }, { status: 404 });
      }

      let filteredNotes = notes;

      // Apply filters
      if (query) {
        const lowerQuery = query.toLowerCase();
        filteredNotes = filteredNotes.filter(
          (note) =>
            note.content.toLowerCase().includes(lowerQuery) ||
            note.authorName.toLowerCase().includes(lowerQuery) ||
            note.hashtags.some((h) => h.toLowerCase().includes(lowerQuery)) ||
            note.mentions.some((m) => m.toLowerCase().includes(lowerQuery))
        );
      }

      if (hashtag) {
        const normalizedTag = hashtag.toLowerCase().replace(/^#/, "");
        filteredNotes = filteredNotes.filter((note) =>
          note.hashtags.some((h) => h.toLowerCase() === normalizedTag)
        );
      }

      if (pinnedOnly) {
        filteredNotes = filteredNotes.filter((note) => note.isPinned);
      }

      // Sort: pinned first, then by date descending
      filteredNotes.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      return NextResponse.json({ notes: filteredNotes });
    }

    // If searching across all entities (for global search)
    // This could be expanded to search across all requests, creators, uploads
    // For now, return empty if no entity specified
    return NextResponse.json({ notes: [] });
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

// POST - Create a new note
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = createNoteSchema.parse(body);

    // Verify entity exists and belongs to agency
    const { entity, notes: existingNotes } = await getEntityNotes(
      validated.entityType,
      validated.entityId,
      session.user.agencyId
    );

    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    // Create the note
    const note = createNote(
      {
        content: validated.content,
        isPinned: validated.isPinned,
        isInternal: validated.isInternal,
      },
      validated.entityType,
      validated.entityId,
      session.user.id,
      session.user.name || "Unknown"
    );

    // Add to existing notes
    const updatedNotes = [note as StoredNote, ...existingNotes];

    // Save back to entity
    await saveEntityNotes(validated.entityType, validated.entityId, updatedNotes);

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "note.created",
        entityType: validated.entityType.charAt(0).toUpperCase() + validated.entityType.slice(1),
        entityId: validated.entityId,
        metadata: {
          noteId: note.id,
          isPinned: note.isPinned,
          isInternal: note.isInternal,
          hashtags: note.hashtags,
          mentions: note.mentions,
        },
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}

// PATCH - Update a note (content, pin status)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = updateNoteSchema.parse(body);

    // We need to find the note first to know which entity it belongs to
    // Search in all entity types
    let foundNote: StoredNote | null = null;
    let foundEntityType: string | null = null;
    let foundEntityId: string | null = null;
    let allNotes: StoredNote[] = [];

    // Search in requests
    const requests = await db.contentRequest.findMany({
      where: { agencyId: session.user.agencyId },
      select: { id: true, requirements: true },
    });

    for (const request of requests) {
      const reqs = (request.requirements as Record<string, unknown>) || {};
      const notes = (reqs.internalNotes as StoredNote[]) || [];
      const note = notes.find((n) => n.id === validated.noteId);
      if (note) {
        foundNote = note;
        foundEntityType = "request";
        foundEntityId = request.id;
        allNotes = notes;
        break;
      }
    }

    // Search in creators if not found
    if (!foundNote) {
      const creators = await db.creator.findMany({
        where: { agencyId: session.user.agencyId },
        select: { id: true, contentPreferences: true },
      });

      for (const creator of creators) {
        const prefs = (creator.contentPreferences as Record<string, unknown>) || {};
        const notes = (prefs.internalNotes as StoredNote[]) || [];
        const note = notes.find((n) => n.id === validated.noteId);
        if (note) {
          foundNote = note;
          foundEntityType = "creator";
          foundEntityId = creator.id;
          allNotes = notes;
          break;
        }
      }
    }

    // Search in uploads if not found
    if (!foundNote) {
      const uploads = await db.upload.findMany({
        where: {
          request: { agencyId: session.user.agencyId },
        },
        select: { id: true, metadata: true },
      });

      for (const upload of uploads) {
        const metadata = (upload.metadata as Record<string, unknown>) || {};
        const notes = (metadata.internalNotes as StoredNote[]) || [];
        const note = notes.find((n) => n.id === validated.noteId);
        if (note) {
          foundNote = note;
          foundEntityType = "upload";
          foundEntityId = upload.id;
          allNotes = notes;
          break;
        }
      }
    }

    if (!foundNote || !foundEntityType || !foundEntityId) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Update the note
    const updatedNote: StoredNote = {
      ...foundNote,
      content: validated.content ?? foundNote.content,
      isPinned: validated.isPinned ?? foundNote.isPinned,
      updatedAt: new Date().toISOString(),
      mentions: validated.content ? extractMentions(validated.content) : foundNote.mentions,
      hashtags: validated.content ? extractHashtags(validated.content) : foundNote.hashtags,
    };

    // Update in the notes array
    const updatedNotes = allNotes.map((n) =>
      n.id === validated.noteId ? updatedNote : n
    );

    // Save back to entity
    await saveEntityNotes(foundEntityType, foundEntityId, updatedNotes);

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "note.updated",
        entityType: foundEntityType.charAt(0).toUpperCase() + foundEntityType.slice(1),
        entityId: foundEntityId,
        metadata: {
          noteId: validated.noteId,
          updatedFields: Object.keys(validated).filter((k) => k !== "noteId"),
        },
      },
    });

    return NextResponse.json({ note: updatedNote });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating note:", error);
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a note
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const noteId = url.searchParams.get("noteId");

    if (!noteId) {
      return NextResponse.json({ error: "Note ID is required" }, { status: 400 });
    }

    // Find the note (similar to PATCH)
    let foundNote: StoredNote | null = null;
    let foundEntityType: string | null = null;
    let foundEntityId: string | null = null;
    let allNotes: StoredNote[] = [];

    // Search in requests
    const requests = await db.contentRequest.findMany({
      where: { agencyId: session.user.agencyId },
      select: { id: true, requirements: true },
    });

    for (const request of requests) {
      const reqs = (request.requirements as Record<string, unknown>) || {};
      const notes = (reqs.internalNotes as StoredNote[]) || [];
      const note = notes.find((n) => n.id === noteId);
      if (note) {
        foundNote = note;
        foundEntityType = "request";
        foundEntityId = request.id;
        allNotes = notes;
        break;
      }
    }

    // Search in creators
    if (!foundNote) {
      const creators = await db.creator.findMany({
        where: { agencyId: session.user.agencyId },
        select: { id: true, contentPreferences: true },
      });

      for (const creator of creators) {
        const prefs = (creator.contentPreferences as Record<string, unknown>) || {};
        const notes = (prefs.internalNotes as StoredNote[]) || [];
        const note = notes.find((n) => n.id === noteId);
        if (note) {
          foundNote = note;
          foundEntityType = "creator";
          foundEntityId = creator.id;
          allNotes = notes;
          break;
        }
      }
    }

    // Search in uploads
    if (!foundNote) {
      const uploads = await db.upload.findMany({
        where: {
          request: { agencyId: session.user.agencyId },
        },
        select: { id: true, metadata: true },
      });

      for (const upload of uploads) {
        const metadata = (upload.metadata as Record<string, unknown>) || {};
        const notes = (metadata.internalNotes as StoredNote[]) || [];
        const note = notes.find((n) => n.id === noteId);
        if (note) {
          foundNote = note;
          foundEntityType = "upload";
          foundEntityId = upload.id;
          allNotes = notes;
          break;
        }
      }
    }

    if (!foundNote || !foundEntityType || !foundEntityId) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Check if user is the author or has admin permissions
    const canDelete =
      foundNote.authorId === session.user.id ||
      ["OWNER", "ADMIN"].includes(session.user.role);

    if (!canDelete) {
      return NextResponse.json(
        { error: "You can only delete your own notes" },
        { status: 403 }
      );
    }

    // Remove note from array
    const filteredNotes = allNotes.filter((n) => n.id !== noteId);

    // Save back to entity
    await saveEntityNotes(foundEntityType, foundEntityId, filteredNotes);

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "note.deleted",
        entityType: foundEntityType.charAt(0).toUpperCase() + foundEntityType.slice(1),
        entityId: foundEntityId,
        metadata: {
          noteId,
        },
      },
    });

    return NextResponse.json({ message: "Note deleted successfully" });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
