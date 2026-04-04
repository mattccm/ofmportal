import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Session configuration
const SESSION_DURATION_DAYS = 30;
const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;

export interface AuthenticatedCreator {
  id: string;
  agencyId: string;
  name: string;
  email: string;
  avatar?: string | null;
}

export type AuthResult =
  | {
      success: true;
      creator: AuthenticatedCreator;
    }
  | {
      success: false;
      error: NextResponse;
    };

/**
 * Validates a creator session token from the request headers.
 * Also extends the session on each successful validation (sliding expiry).
 * Sessions expire after 30 days of inactivity.
 */
export async function validateCreatorSession(
  request: NextRequest,
  options: { extendSession?: boolean } = { extendSession: true }
): Promise<AuthResult> {
  const sessionToken = request.headers.get("x-creator-token");

  if (!sessionToken) {
    return {
      success: false,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const creator = await db.creator.findFirst({
    where: {
      sessionToken: sessionToken,
      inviteStatus: "ACCEPTED",
      sessionExpiry: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      agencyId: true,
      name: true,
      email: true,
      avatar: true,
    },
  });

  if (!creator) {
    return {
      success: false,
      error: NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      ),
    };
  }

  // Extend session on activity (sliding expiry window)
  // This runs in the background and doesn't block the response
  if (options.extendSession) {
    extendCreatorSession(creator.id).catch((err) => {
      console.error("Failed to extend session:", err);
    });
  }

  return {
    success: true,
    creator,
  };
}

/**
 * Invalidates a creator's session (logout).
 */
export async function invalidateCreatorSession(creatorId: string): Promise<void> {
  await db.creator.update({
    where: { id: creatorId },
    data: {
      sessionToken: null,
      sessionExpiry: null,
    },
  });
}

/**
 * Extends a creator's session expiry by 30 days from now.
 * Called automatically on each authenticated API request (sliding window).
 * This keeps users logged in as long as they're active.
 */
export async function extendCreatorSession(creatorId: string): Promise<void> {
  const newExpiry = new Date(Date.now() + SESSION_DURATION_MS);
  await db.creator.update({
    where: { id: creatorId },
    data: {
      sessionExpiry: newExpiry,
    },
  });
}
