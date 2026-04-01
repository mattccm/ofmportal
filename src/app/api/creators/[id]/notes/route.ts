import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

interface CreatorNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  authorName: string;
}

// GET - Fetch all internal notes for a creator
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      select: { id: true, notes: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Notes are stored in activity logs with action "creator.note_added"
    const noteLogs = await db.activityLog.findMany({
      where: {
        entityType: "Creator",
        entityId: id,
        action: { in: ["creator.note_added", "creator.note_updated"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Parse notes from activity log metadata
    const notesMap = new Map<string, CreatorNote>();

    noteLogs.forEach((log) => {
      const metadata = log.metadata as Record<string, unknown>;
      const noteId = metadata.noteId as string;

      if (noteId && !notesMap.has(noteId)) {
        notesMap.set(noteId, {
          id: noteId,
          content: metadata.content as string,
          createdAt: (metadata.createdAt as string) || log.createdAt.toISOString(),
          updatedAt: log.createdAt.toISOString(),
          authorId: log.user?.id || "",
          authorName: log.user?.name || "Unknown",
        });
      }
    });

    // Also check for notes stored in the creator's contentPreferences JSON
    let storedNotes: CreatorNote[] = [];
    try {
      const creatorWithNotes = await db.creator.findFirst({
        where: { id },
        select: { contentPreferences: true },
      });

      const prefs = creatorWithNotes?.contentPreferences as Record<string, unknown>;
      if (prefs?.internalNotes && Array.isArray(prefs.internalNotes)) {
        storedNotes = prefs.internalNotes as CreatorNote[];
      }
    } catch {
      // Ignore errors parsing stored notes
    }

    // Merge notes from both sources
    storedNotes.forEach((note) => {
      if (!notesMap.has(note.id)) {
        notesMap.set(note.id, note);
      }
    });

    const notes = Array.from(notesMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Error fetching creator notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

// POST - Add a new internal note
const createNoteSchema = z.object({
  content: z.string().min(1, "Note content is required"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      select: { id: true, contentPreferences: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const body = await req.json();
    const { content } = createNoteSchema.parse(body);

    const noteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const newNote: CreatorNote = {
      id: noteId,
      content,
      createdAt: now,
      updatedAt: now,
      authorId: session.user.id,
      authorName: session.user.name || "Unknown",
    };

    // Store note in contentPreferences
    const prefs = (creator.contentPreferences as Record<string, unknown>) || {};
    const existingNotes = (prefs.internalNotes as CreatorNote[]) || [];
    const updatedPrefs = {
      ...prefs,
      internalNotes: [newNote, ...existingNotes],
    } as unknown as Prisma.InputJsonValue;

    await db.creator.update({
      where: { id },
      data: {
        contentPreferences: updatedPrefs,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "creator.note_added",
        entityType: "Creator",
        entityId: id,
        metadata: {
          noteId,
          content,
          createdAt: now,
        },
      },
    });

    return NextResponse.json({ note: newNote }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating creator note:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}

// PATCH - Update an existing note
const updateNoteSchema = z.object({
  noteId: z.string(),
  content: z.string().min(1, "Note content is required"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const creator = await db.creator.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      select: { id: true, contentPreferences: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const body = await req.json();
    const { noteId, content } = updateNoteSchema.parse(body);

    const prefs = (creator.contentPreferences as Record<string, unknown>) || {};
    const existingNotes = (prefs.internalNotes as CreatorNote[]) || [];

    const noteIndex = existingNotes.findIndex((n) => n.id === noteId);
    if (noteIndex === -1) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const updatedNote = {
      ...existingNotes[noteIndex],
      content,
      updatedAt: new Date().toISOString(),
    };

    existingNotes[noteIndex] = updatedNote;

    const updatedPrefsPatch = {
      ...prefs,
      internalNotes: existingNotes,
    } as unknown as Prisma.InputJsonValue;

    await db.creator.update({
      where: { id },
      data: {
        contentPreferences: updatedPrefsPatch,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "creator.note_updated",
        entityType: "Creator",
        entityId: id,
        metadata: {
          noteId,
          content,
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

    console.error("Error updating creator note:", error);
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a note
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const noteId = url.searchParams.get("noteId");

    if (!noteId) {
      return NextResponse.json({ error: "Note ID is required" }, { status: 400 });
    }

    const creator = await db.creator.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      select: { id: true, contentPreferences: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const prefs = (creator.contentPreferences as Record<string, unknown>) || {};
    const existingNotes = (prefs.internalNotes as CreatorNote[]) || [];

    const filteredNotes = existingNotes.filter((n) => n.id !== noteId);

    if (filteredNotes.length === existingNotes.length) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const updatedPrefsDelete = {
      ...prefs,
      internalNotes: filteredNotes,
    } as unknown as Prisma.InputJsonValue;

    await db.creator.update({
      where: { id },
      data: {
        contentPreferences: updatedPrefsDelete,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "creator.note_deleted",
        entityType: "Creator",
        entityId: id,
        metadata: {
          noteId,
        },
      },
    });

    return NextResponse.json({ message: "Note deleted successfully" });
  } catch (error) {
    console.error("Error deleting creator note:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
