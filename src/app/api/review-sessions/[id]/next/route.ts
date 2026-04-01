// POST /api/review-sessions/[id]/next - Navigate to next/previous item

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sessionStore,
  emitNavigationChange,
  calculateSessionProgress,
  calculateVoteSummary,
} from "@/lib/realtime-session";
import { NavigationRequest, ReviewUploadInfo } from "@/types/review-session";

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
    const body: NavigationRequest = await request.json();

    // Get session
    const session = await db.reviewSession.findUnique({
      where: { id: sessionId },
      include: {
        votes: true,
        participants: {
          where: { isActive: true },
        },
      },
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

    if (session.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Session is not active" },
        { status: 400 }
      );
    }

    // Check if user is host (only host can navigate if setting is enabled)
    const settings = session.settings as Record<string, unknown>;
    const onlyHostCanNavigate = settings.onlyHostCanNavigate !== false;

    if (onlyHostCanNavigate && session.hostUserId !== userId) {
      return NextResponse.json(
        { error: "Only the host can navigate" },
        { status: 403 }
      );
    }

    const uploadIds = session.uploadIds as string[];
    let newIndex = session.currentUploadIndex;

    switch (body.action) {
      case "next":
        newIndex = Math.min(session.currentUploadIndex + 1, uploadIds.length - 1);
        break;
      case "previous":
        newIndex = Math.max(session.currentUploadIndex - 1, 0);
        break;
      case "goto":
        if (body.index !== undefined && body.index >= 0 && body.index < uploadIds.length) {
          newIndex = body.index;
        } else {
          return NextResponse.json(
            { error: "Invalid index" },
            { status: 400 }
          );
        }
        break;
      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    // Update session
    const updatedSession = await db.reviewSession.update({
      where: { id: sessionId },
      data: { currentUploadIndex: newIndex },
    });

    // Get new current upload info
    const newUploadId = uploadIds[newIndex];
    const upload = await db.upload.findUnique({
      where: { id: newUploadId },
      include: {
        creator: { select: { id: true, name: true } },
        request: { select: { id: true, title: true } },
      },
    });

    let currentUpload: ReviewUploadInfo | null = null;
    if (upload) {
      currentUpload = {
        id: upload.id,
        fileName: upload.fileName,
        originalName: upload.originalName,
        fileType: upload.fileType,
        fileSize: Number(upload.fileSize),
        storageUrl: upload.storageUrl,
        thumbnailUrl: upload.thumbnailUrl,
        metadata: upload.metadata as Record<string, unknown>,
        creatorId: upload.creatorId,
        creatorName: upload.creator.name,
        requestId: upload.requestId,
        requestTitle: upload.request.title,
        uploadedAt: upload.uploadedAt,
      };
    }

    // Get votes with user info for progress calculation
    const votesWithUsers = await Promise.all(
      session.votes.map(async (v) => {
        const user = await db.user.findUnique({
          where: { id: v.userId },
          select: { id: true, name: true, avatar: true },
        });
        return {
          ...v,
          user: user || { id: v.userId, name: "Unknown", avatar: null },
        };
      })
    );

    // Calculate progress
    const sessionWithTypes = {
      ...updatedSession,
      uploadIds: updatedSession.uploadIds as string[],
      settings: updatedSession.settings as Record<string, unknown>,
    };
    const progress = calculateSessionProgress(
      sessionWithTypes,
      votesWithUsers,
      session.participants.length
    );

    // Get votes for new upload
    const newUploadVotes = votesWithUsers.filter((v) => v.uploadId === newUploadId);
    const voteSummary = calculateVoteSummary(votesWithUsers, newUploadId);

    // Update in-memory state
    const state = sessionStore.getSession(sessionId);
    if (state) {
      sessionStore.updateSession(sessionId, {
        session: sessionWithTypes,
        currentUpload,
        votes: newUploadVotes,
        voteSummary,
        progress,
      });

      // Broadcast navigation change
      if (currentUpload) {
        emitNavigationChange(sessionId, newIndex, currentUpload, progress);
      }
    }

    return NextResponse.json({
      currentUploadIndex: newIndex,
      currentUpload,
      progress,
      voteSummary,
    });
  } catch (error) {
    console.error("Error navigating session:", error);
    return NextResponse.json(
      { error: "Failed to navigate" },
      { status: 500 }
    );
  }
}
