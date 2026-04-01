"use client";

import { NotesPanel } from "./notes-panel";
import { type Note } from "@/lib/notes-utils";

interface RequestNotesProps {
  requestId: string;
  initialNotes: Note[];
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
}

export function RequestNotes({
  requestId,
  initialNotes,
  currentUser,
}: RequestNotesProps) {
  return (
    <NotesPanel
      entityType="request"
      entityId={requestId}
      initialNotes={initialNotes}
      currentUser={currentUser}
      apiBasePath="/api/notes"
      title="Internal Notes"
      description="Private notes about this request (only visible to team members)"
    />
  );
}
