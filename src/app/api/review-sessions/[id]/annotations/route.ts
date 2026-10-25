// POST /api/review-sessions/[id]/annotations - Add an annotation
// GET /api/review-sessions/[id]/annotations - Get annotations for session
// DELETE /api/review-sessions/[id]/annotations - Clear all annotations (host only)

import { requireAccess, uploadWhere, type Access } from "@/lib/access/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcastSessionAnnotation } from "@/lib/realtime-broadcast";
import {
  SessionAnnotation,
  SessionAnnotationType,
  AnnotationData,
  AnnotationEvent,
} from "@/types/review-session";


/** Upload ids among these whose creator is inside the person's scope */
async function uploadsInScope(access: Access, uploadIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(uploadIds.filter(Boolean))];
  if (ids.length === 0) return new Set();
  const rows = await db.upload.findMany({ where: { AND: [uploadWhere(access), { id: { in: ids } }] }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

// In-memory annotation store (in production, use database)
const annotationStore = new Map<string, SessionAnnotation[]>();

function getAnnotations(sessionId: string): SessionAnnotation[] {
  return annotationStore.get(sessionId) || [];
}

function addAnnotation(sessionId: string, annotation: SessionAnnotation): void {
  const annotations = getAnnotations(sessionId);
  annotations.push(annotation);
  annotationStore.set(sessionId, annotations);
}

function updateAnnotation(
  sessionId: string,
  annotationId: string,
  data: AnnotationData
): SessionAnnotation | null {
  const annotations = getAnnotations(sessionId);
  const index = annotations.findIndex((a) => a.id === annotationId);
  if (index >= 0) {
    annotations[index] = { ...annotations[index], data };
    annotationStore.set(sessionId, annotations);
    return annotations[index];
  }
  return null;
}

function deleteAnnotation(sessionId: string, annotationId: string): boolean {
  const annotations = getAnnotations(sessionId);
  const index = annotations.findIndex((a) => a.id === annotationId);
  if (index >= 0) {
    annotations.splice(index, 1);
    annotationStore.set(sessionId, annotations);
    return true;
  }
  return false;
}

function clearAnnotations(sessionId: string, uploadId?: string): void {
  if (uploadId) {
    const annotations = getAnnotations(sessionId).filter(
      (a) => a.uploadId !== uploadId
    );
    annotationStore.set(sessionId, annotations);
  } else {
    annotationStore.set(sessionId, []);
  }
}

// Broadcast annotation event to all participants via Supabase Realtime.
// Fire-and-forget from the caller's perspective, but we await the broadcast so
// transient errors are logged rather than swallowed as unhandled rejections.
async function broadcastAnnotationEvent(
  sessionId: string,
  event: AnnotationEvent
): Promise<void> {
  try {
    await broadcastSessionAnnotation(sessionId, {
      action: event.action,
      annotation: event.annotation as unknown as Record<string, unknown>,
    });
  } catch (error) {
    console.error("Failed to broadcast annotation event:", error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const gate = await requireAccess("settings.reviewSessions");
    if (gate.error) return gate.error;
    const { userId, agencyId } = gate.access;
    const body = await request.json();

    // Validate required fields
    if (!body.uploadId || !body.type || !body.data) {
      return NextResponse.json(
        { error: "uploadId, type, and data are required" },
        { status: 400 }
      );
    }

    // Get session
    const session = await db.reviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.agencyId !== agencyId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Check session settings for annotations
    const settings = session.settings as Record<string, unknown>;
    if (settings.allowAnnotations === false) {
      return NextResponse.json(
        { error: "Annotations are disabled for this session" },
        { status: 403 }
      );
    }

    // Verify user is a participant
    const participant = await db.reviewSessionParticipant.findUnique({
      where: {
        sessionId_userId: { sessionId, userId },
      },
    });

    if (!participant || !participant.isActive) {
      return NextResponse.json(
        { error: "You must join the session first" },
        { status: 403 }
      );
    }

    // The upload must belong to a creator inside the person's scope
    if (!(await uploadsInScope(gate.access, [body.uploadId])).has(body.uploadId)) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // Get user info
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatar: true },
    });

    // Create annotation
    const annotation: SessionAnnotation = {
      id: `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      uploadId: body.uploadId,
      userId,
      type: body.type as SessionAnnotationType,
      data: body.data as AnnotationData,
      color: body.color || "#ff6461",
      timestamp: body.timestamp,
      createdAt: new Date(),
    };

    // Store annotation
    addAnnotation(sessionId, annotation);

    // Broadcast to other participants
    await broadcastAnnotationEvent(sessionId, {
      annotation,
      action: "add",
    });

    return NextResponse.json({
      annotation,
      user: user || { id: userId, name: "Unknown", avatar: null },
    });
  } catch (error) {
    console.error("Error adding annotation:", error);
    return NextResponse.json(
      { error: "Failed to add annotation" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const gate = await requireAccess("settings.reviewSessions");
    if (gate.error) return gate.error;
    const { agencyId } = gate.access;
    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get("uploadId");

    // Get session
    const session = await db.reviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.agencyId !== agencyId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Get annotations
    let annotations = getAnnotations(sessionId);

    // Filter by uploadId if specified
    if (uploadId) {
      annotations = annotations.filter((a) => a.uploadId === uploadId);
    }
    // Only annotations on uploads whose creator is inside the person's scope
    const inScope = await uploadsInScope(gate.access, annotations.map((a) => a.uploadId));
    annotations = annotations.filter((a) => inScope.has(a.uploadId));

    // Get user info for annotations
    const userIds = [...new Set(annotations.map((a) => a.userId))];
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatar: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const annotationsWithUsers = annotations.map((a) => ({
      ...a,
      user: userMap.get(a.userId) || { id: a.userId, name: "Unknown", avatar: null },
    }));

    return NextResponse.json({ annotations: annotationsWithUsers });
  } catch (error) {
    console.error("Error fetching annotations:", error);
    return NextResponse.json(
      { error: "Failed to fetch annotations" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const gate = await requireAccess("settings.reviewSessions");
    if (gate.error) return gate.error;
    const { userId, agencyId } = gate.access;
    const { searchParams } = new URL(request.url);
    const annotationId = searchParams.get("annotationId");
    const uploadId = searchParams.get("uploadId");

    // Get session
    const session = await db.reviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.agencyId !== agencyId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Delete specific annotation or clear all for upload
    if (annotationId) {
      // Delete specific annotation
      const annotations = getAnnotations(sessionId);
      const annotation = annotations.find((a) => a.id === annotationId);

      if (!annotation) {
        return NextResponse.json(
          { error: "Annotation not found" },
          { status: 404 }
        );
      }

      // Only annotation owner or host can delete
      if (annotation.userId !== userId && session.hostUserId !== userId) {
        return NextResponse.json(
          { error: "You can only delete your own annotations" },
          { status: 403 }
        );
      }

      deleteAnnotation(sessionId, annotationId);

      // Broadcast delete event
      await broadcastAnnotationEvent(sessionId, {
        annotation,
        action: "delete",
      });

      return NextResponse.json({ success: true });
    } else {
      // Clear all annotations (host only)
      if (session.hostUserId !== userId) {
        return NextResponse.json(
          { error: "Only the host can clear all annotations" },
          { status: 403 }
        );
      }

      clearAnnotations(sessionId, uploadId || undefined);

      // Broadcast clear event (include uploadId so subscribers can scope the clear)
      await broadcastAnnotationEvent(sessionId, {
        annotation: { uploadId: uploadId || undefined } as SessionAnnotation,
        action: "clear",
      });

      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("Error deleting annotation:", error);
    return NextResponse.json(
      { error: "Failed to delete annotation" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const gate = await requireAccess("settings.reviewSessions");
    if (gate.error) return gate.error;
    const { userId, agencyId } = gate.access;
    const body = await request.json();

    if (!body.annotationId || !body.data) {
      return NextResponse.json(
        { error: "annotationId and data are required" },
        { status: 400 }
      );
    }

    // Get session
    const session = await db.reviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.agencyId !== agencyId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Get annotation
    const annotations = getAnnotations(sessionId);
    const annotation = annotations.find((a) => a.id === body.annotationId);

    if (!annotation) {
      return NextResponse.json(
        { error: "Annotation not found" },
        { status: 404 }
      );
    }

    // Only annotation owner can update
    if (annotation.userId !== userId) {
      return NextResponse.json(
        { error: "You can only update your own annotations" },
        { status: 403 }
      );
    }

    // Update annotation
    const updatedAnnotation = updateAnnotation(
      sessionId,
      body.annotationId,
      body.data as AnnotationData
    );

    if (!updatedAnnotation) {
      return NextResponse.json(
        { error: "Failed to update annotation" },
        { status: 500 }
      );
    }

    // Broadcast update event
    await broadcastAnnotationEvent(sessionId, {
      annotation: updatedAnnotation,
      action: "update",
    });

    return NextResponse.json({ annotation: updatedAnnotation });
  } catch (error) {
    console.error("Error updating annotation:", error);
    return NextResponse.json(
      { error: "Failed to update annotation" },
      { status: 500 }
    );
  }
}
