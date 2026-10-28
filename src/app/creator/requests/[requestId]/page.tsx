"use client";

import { use } from "react";
import { CreatorRequestView } from "@/components/portal/creator-request-view";

export default function CreatorRequestDetailPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = use(params);
  return <CreatorRequestView requestId={requestId} />;
}
