"use client";

import React, { use } from "react";
import { ReviewSessionView } from "@/components/review-sessions/ReviewSessionView";

interface ReviewSessionPageProps {
  params: Promise<{ id: string }>;
}

export default function ReviewSessionPage({ params }: ReviewSessionPageProps) {
  const { id: sessionId } = use(params);

  // In production, get these from auth context
  const userId = "user_demo";
  const isHost = true; // Determine from session data

  return (
    <ReviewSessionView
      sessionId={sessionId}
      userId={userId}
      isHost={isHost}
    />
  );
}
