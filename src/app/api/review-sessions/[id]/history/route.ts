// GET /api/review-sessions/[id]/history - Get complete session history/recording

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  SessionRecording,
  SessionRecordingEvent,
  SessionRecordingMetadata,
  SessionAnalytics,
  ReviewUploadInfo,
} from "@/types/review-session";
import { calculateVoteSummary } from "@/lib/realtime-session";

// Mock auth helper - replace with real auth in production
async function getCurrentUser(request: NextRequest) {
  const userId = request.headers.get("x-user-id") || "user_demo";
  const agencyId = request.headers.get("x-agency-id") || "agency_demo";
  return { userId, agencyId };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const { agencyId } = await getCurrentUser(request);
    const { searchParams } = new URL(request.url);
    const includeAnalytics = searchParams.get("analytics") === "true";

    // Get session with all related data
    const session = await db.reviewSession.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          orderBy: { joinedAt: "asc" },
        },
        votes: {
          orderBy: { votedAt: "asc" },
        },
        chatMessages: {
          orderBy: { createdAt: "asc" },
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

    // Fetch user info
    const userIds = [
      ...new Set([
        session.hostUserId,
        ...session.participants.map((p) => p.userId),
        ...session.votes.map((v) => v.userId),
        ...session.chatMessages.map((m) => m.userId),
      ]),
    ];

    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatar: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Fetch upload info
    const uploadIds = session.uploadIds as string[];
    const uploads = await db.upload.findMany({
      where: { id: { in: uploadIds } },
      include: {
        creator: { select: { id: true, name: true } },
        request: { select: { id: true, title: true } },
      },
    });
    const uploadMap = new Map(uploads.map((u) => [u.id, u]));

    // Build recording events timeline
    const events: SessionRecordingEvent[] = [];

    // Session started event
    events.push({
      timestamp: session.startedAt,
      type: "session_started",
      userId: session.hostUserId,
      data: {
        sessionName: session.name,
        hostName: userMap.get(session.hostUserId)?.name || "Unknown",
        totalItems: uploadIds.length,
      },
    });

    // Participant events
    session.participants.forEach((p) => {
      events.push({
        timestamp: p.joinedAt,
        type: "participant_joined",
        userId: p.userId,
        data: {
          userName: userMap.get(p.userId)?.name || "Unknown",
          role: p.role,
        },
      });

      if (p.leftAt) {
        events.push({
          timestamp: p.leftAt,
          type: "participant_left",
          userId: p.userId,
          data: {
            userName: userMap.get(p.userId)?.name || "Unknown",
          },
        });
      }
    });

    // Vote events
    session.votes.forEach((v) => {
      events.push({
        timestamp: v.votedAt,
        type: "vote_cast",
        userId: v.userId,
        data: {
          uploadId: v.uploadId,
          uploadName: uploadMap.get(v.uploadId)?.originalName || "Unknown",
          vote: v.vote,
          note: v.note,
          userName: userMap.get(v.userId)?.name || "Unknown",
        },
      });
    });

    // Chat message events
    session.chatMessages.forEach((m) => {
      events.push({
        timestamp: m.createdAt,
        type: m.type === "VOICE_NOTE" ? "voice_note" : "chat_message",
        userId: m.userId,
        data: {
          message: m.message,
          type: m.type,
          uploadId: m.uploadId,
          voiceNoteDuration: m.voiceNoteDuration,
          userName: userMap.get(m.userId)?.name || "Unknown",
        },
      });
    });

    // Session ended event
    if (session.endedAt) {
      events.push({
        timestamp: session.endedAt,
        type: "session_ended",
        userId: session.hostUserId,
        data: {
          status: session.status,
        },
      });
    }

    // Sort events by timestamp
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Calculate metadata
    const voiceNotes = session.chatMessages.filter((m) => m.type === "VOICE_NOTE");
    const metadata: SessionRecordingMetadata = {
      totalDuration: session.endedAt
        ? Math.floor((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
        : Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000),
      participantCount: session.participants.length,
      totalVotes: session.votes.length,
      totalMessages: session.chatMessages.length,
      totalAnnotations: 0, // Would need annotations table
      totalVoiceNotes: voiceNotes.length,
    };

    const recording: SessionRecording = {
      id: `recording_${sessionId}`,
      sessionId,
      events,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      metadata,
    };

    // Calculate analytics if requested
    let analytics: SessionAnalytics | null = null;
    if (includeAnalytics) {
      const votesWithUsers = session.votes.map((v) => ({
        ...v,
        user: userMap.get(v.userId) || { id: v.userId, name: "Unknown", avatar: null },
      }));

      // Calculate vote distribution
      const voteDistribution = {
        approve: session.votes.filter((v) => v.vote === "APPROVE").length,
        reject: session.votes.filter((v) => v.vote === "REJECT").length,
        discuss: session.votes.filter((v) => v.vote === "DISCUSS").length,
        skip: session.votes.filter((v) => v.vote === "SKIP").length,
      };

      // Calculate conflict analysis
      const conflictItems: SessionAnalytics["conflictItems"] = [];
      let conflictCount = 0;

      uploadIds.forEach((uploadId) => {
        const summary = calculateVoteSummary(votesWithUsers, uploadId);
        if (summary.hasConflict) {
          conflictCount++;
          const upload = uploadMap.get(uploadId);
          conflictItems.push({
            uploadId,
            uploadName: upload?.originalName || "Unknown",
            conflictType: summary.conflictType || "approve_reject",
            voteBreakdown: {
              approve: summary.approve,
              reject: summary.reject,
              discuss: summary.discuss,
            },
            finalDecision: summary.majority || "PENDING",
            resolutionMethod: summary.hasConsensus ? "majority" : undefined,
          });
        }
      });

      // Calculate agreement rate
      const itemsWithConsensus = uploadIds.filter((uploadId) => {
        const summary = calculateVoteSummary(votesWithUsers, uploadId);
        return summary.hasConsensus;
      }).length;
      const agreementRate = uploadIds.length > 0 ? (itemsWithConsensus / uploadIds.length) * 100 : 0;

      // Calculate most discussed items
      const discussedItems = uploadIds
        .map((uploadId) => {
          const upload = uploadMap.get(uploadId);
          const uploadVotes = session.votes.filter((v) => v.uploadId === uploadId);
          const uploadMessages = session.chatMessages.filter((m) => m.uploadId === uploadId);
          const discussVotes = uploadVotes.filter((v) => v.vote === "DISCUSS").length;
          const voiceNoteCount = uploadMessages.filter((m) => m.type === "VOICE_NOTE").length;

          return {
            uploadId,
            uploadName: upload?.originalName || "Unknown",
            creatorName: upload?.creator.name || "Unknown",
            discussVoteCount: discussVotes,
            messageCount: uploadMessages.length,
            voiceNoteCount,
            annotationCount: 0,
            reviewTime: 0,
          };
        })
        .filter((item) => item.discussVoteCount > 0 || item.messageCount > 0)
        .sort((a, b) => b.discussVoteCount + b.messageCount - (a.discussVoteCount + a.messageCount))
        .slice(0, 5);

      // Participant engagement
      const participantEngagement = session.participants.map((p) => {
        const userVotes = session.votes.filter((v) => v.userId === p.userId);
        const itemsVotedOn = new Set(userVotes.map((v) => v.uploadId)).size;
        const participationRate = uploadIds.length > 0 ? (itemsVotedOn / uploadIds.length) * 100 : 0;

        // Calculate agreement with majority
        let agreementWithMajority = 0;
        let majorityVotes = 0;
        userVotes.forEach((v) => {
          const summary = calculateVoteSummary(votesWithUsers, v.uploadId);
          if (summary.majority) {
            majorityVotes++;
            if (v.vote === summary.majority) {
              agreementWithMajority++;
            }
          }
        });

        return {
          userId: p.userId,
          userName: userMap.get(p.userId)?.name || "Unknown",
          participationRate,
          avgResponseTime: 0,
          agreementWithMajority: majorityVotes > 0 ? (agreementWithMajority / majorityVotes) * 100 : 0,
          votingPattern: {
            approve: userVotes.filter((v) => v.vote === "APPROVE").length,
            reject: userVotes.filter((v) => v.vote === "REJECT").length,
            discuss: userVotes.filter((v) => v.vote === "DISCUSS").length,
            skip: userVotes.filter((v) => v.vote === "SKIP").length,
          },
        };
      });

      analytics = {
        sessionId,
        totalDuration: metadata.totalDuration,
        avgReviewTimePerItem: uploadIds.length > 0 ? metadata.totalDuration / uploadIds.length : 0,
        minReviewTime: 0,
        maxReviewTime: 0,
        reviewTimesPerItem: {},
        agreementRate,
        avgVotesPerItem: uploadIds.length > 0 ? session.votes.length / uploadIds.length : 0,
        voteDistribution,
        participantEngagement,
        mostDiscussedItems: discussedItems,
        conflictRate: uploadIds.length > 0 ? (conflictCount / uploadIds.length) * 100 : 0,
        conflictItems,
      };
    }

    // Build upload info for response
    const uploadsInfo: ReviewUploadInfo[] = uploads.map((upload) => ({
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
    }));

    return NextResponse.json({
      recording,
      session: {
        id: session.id,
        name: session.name,
        description: session.description,
        status: session.status,
        hostUserId: session.hostUserId,
        hostName: userMap.get(session.hostUserId)?.name || "Unknown",
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        settings: session.settings,
      },
      uploads: uploadsInfo,
      analytics,
    });
  } catch (error) {
    console.error("Error fetching session history:", error);
    return NextResponse.json(
      { error: "Failed to fetch session history" },
      { status: 500 }
    );
  }
}
