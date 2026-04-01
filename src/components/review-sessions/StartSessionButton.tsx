"use client";

import React, { useState } from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { Play, Users } from "lucide-react";
import { CreateSessionModal } from "./CreateSessionModal";
import {
  CreateSessionRequest,
  CreateSessionResponse,
  ReviewUploadInfo,
} from "@/types/review-session";
import { useRouter } from "next/navigation";

interface StartSessionButtonProps extends Omit<ButtonProps, "onClick"> {
  selectedUploadIds?: string[];
  availableUploads: ReviewUploadInfo[];
  teamMembers: Array<{
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  }>;
  userId: string;
  agencyId?: string;
  onSessionCreated?: (response: CreateSessionResponse) => void;
}

export function StartSessionButton({
  selectedUploadIds = [],
  availableUploads,
  teamMembers,
  userId,
  agencyId = "agency_demo",
  onSessionCreated,
  children,
  ...buttonProps
}: StartSessionButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  // Filter available uploads to only show selected ones if any are selected
  const uploadsForModal =
    selectedUploadIds.length > 0
      ? availableUploads.filter((u) => selectedUploadIds.includes(u.id))
      : availableUploads;

  const handleCreateSession = async (
    request: CreateSessionRequest
  ): Promise<CreateSessionResponse> => {
    const response = await fetch("/api/review-sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        "x-agency-id": agencyId,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create session");
    }

    const data = await response.json();

    onSessionCreated?.(data);

    // Navigate to the session
    router.push(`/review-sessions/${data.session.id}`);

    return data;
  };

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        {...buttonProps}
      >
        {children || (
          <>
            <Play className="h-4 w-4 mr-2" />
            {selectedUploadIds.length > 0
              ? `Start Review (${selectedUploadIds.length})`
              : "Start Review Session"}
          </>
        )}
      </Button>

      <CreateSessionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onCreateSession={handleCreateSession}
        availableUploads={uploadsForModal}
        teamMembers={teamMembers}
      />
    </>
  );
}

export default StartSessionButton;
