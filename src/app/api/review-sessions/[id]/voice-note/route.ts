// POST /api/review-sessions/[id]/voice-note - Upload a voice note
// GET /api/review-sessions/[id]/voice-note - Get voice notes for session

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sessionStore,
  emitChatMessage,
} from "@/lib/realtime-session";
import { VoiceNote, ReviewSessionChatWithUser } from "@/types/review-session";
import {
  uploadToStorage,
  generateVoiceNoteKey,
  getPublicFileUrl,
  getViewPresignedUrl,
} from "@/lib/storage";

// Mock auth helper - replace with real auth in production
async function getCurrentUser(request: NextRequest) {
  const userId = request.headers.get("x-user-id") || "user_demo";
  const agencyId = request.headers.get("x-agency-id") || "agency_demo";
  return { userId, agencyId };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const { userId, agencyId } = await getCurrentUser(request);

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

    // Check session settings for voice notes
    const settings = session.settings as Record<string, unknown>;
    if (settings.allowVoiceNotes === false) {
      return NextResponse.json(
        { error: "Voice notes are disabled for this session" },
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

    // Parse form data
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const duration = parseInt(formData.get("duration") as string, 10) || 0;
    const uploadId = formData.get("uploadId") as string || null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!audioFile.type.startsWith("audio/")) {
      return NextResponse.json(
        { error: "Invalid file type. Must be an audio file." },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (audioFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Get user info
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatar: true },
    });

    // Generate a unique ID for this voice note
    const noteId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Upload audio to R2 storage (NOT base64 in DB - that wastes 33% more space)
    const arrayBuffer = await audioFile.arrayBuffer();
    const storageKey = generateVoiceNoteKey(sessionId, noteId);
    await uploadToStorage(storageKey, Buffer.from(arrayBuffer), audioFile.type);

    // Get URL for the voice note (prefer public URL for zero bandwidth)
    let voiceNoteUrl = getPublicFileUrl(storageKey);
    if (!voiceNoteUrl) {
      voiceNoteUrl = await getViewPresignedUrl(storageKey);
    }

    // Get current upload ID for context
    const uploadIds = session.uploadIds as string[];
    const currentUploadId = uploadId || uploadIds[session.currentUploadIndex] || null;

    // Create voice note as a chat message with type VOICE_NOTE
    // Store the storage key (not URL) so we can generate fresh URLs on-demand
    // The key is prefixed with "r2:" to distinguish from legacy base64 data URLs
    const chatMessage = await db.reviewSessionChat.create({
      data: {
        sessionId,
        userId,
        message: `Voice note (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")})`,
        uploadId: currentUploadId,
        type: "VOICE_NOTE",
        voiceNoteUrl: `r2:${storageKey}`,
        voiceNoteDuration: duration,
      },
    });

    // Update participant message count
    await db.reviewSessionParticipant.update({
      where: { id: participant.id },
      data: {
        messagesCount: { increment: 1 },
      },
    });

    const messageWithUser: ReviewSessionChatWithUser = {
      ...chatMessage,
      // Return the actual URL (not the storage key) for immediate playback
      voiceNoteUrl,
      user: user || { id: userId, name: "Unknown", avatar: null },
    };

    // Update in-memory state
    const state = sessionStore.getSession(sessionId);
    if (state) {
      const updatedMessages = [...state.recentMessages, messageWithUser].slice(-50);
      sessionStore.updateSession(sessionId, { recentMessages: updatedMessages });

      // Broadcast message
      emitChatMessage(sessionId, messageWithUser);
    }

    // Create voice note record for analytics
    const voiceNote: VoiceNote = {
      id: chatMessage.id,
      sessionId,
      userId,
      uploadId: currentUploadId || "",
      audioUrl: voiceNoteUrl,
      duration,
      transcript: null, // Could be populated by AI transcription service
      createdAt: chatMessage.createdAt,
    };

    return NextResponse.json({
      voiceNote,
      message: messageWithUser,
    });
  } catch (error) {
    console.error("Error uploading voice note:", error);
    return NextResponse.json(
      { error: "Failed to upload voice note" },
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
    const { agencyId } = await getCurrentUser(request);
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

    // Get voice notes (chat messages with type VOICE_NOTE)
    const voiceNotes = await db.reviewSessionChat.findMany({
      where: {
        sessionId,
        type: "VOICE_NOTE",
        ...(uploadId ? { uploadId } : {}),
      },
      orderBy: { createdAt: "asc" },
    });

    // Get user info
    const userIds = [...new Set(voiceNotes.map((v) => v.userId))];
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatar: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Generate fresh URLs for each voice note
    const voiceNotesWithUsers = await Promise.all(
      voiceNotes.map(async (vn) => {
        let audioUrl = vn.voiceNoteUrl;

        // Check if this is an R2 storage key (new format) vs legacy base64 data URL
        if (audioUrl?.startsWith("r2:")) {
          const storageKey = audioUrl.substring(3); // Remove "r2:" prefix
          // Prefer public URL (zero bandwidth) over presigned
          audioUrl = getPublicFileUrl(storageKey);
          if (!audioUrl) {
            audioUrl = await getViewPresignedUrl(storageKey);
          }
        }
        // Legacy base64 data URLs (data:audio/...) work as-is

        return {
          id: vn.id,
          sessionId: vn.sessionId,
          userId: vn.userId,
          uploadId: vn.uploadId,
          audioUrl,
          duration: vn.voiceNoteDuration,
          transcript: null,
          createdAt: vn.createdAt,
          user: userMap.get(vn.userId) || { id: vn.userId, name: "Unknown", avatar: null },
        };
      })
    );

    return NextResponse.json({ voiceNotes: voiceNotesWithUsers });
  } catch (error) {
    console.error("Error fetching voice notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch voice notes" },
      { status: 500 }
    );
  }
}
