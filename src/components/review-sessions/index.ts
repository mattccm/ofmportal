// Review Sessions Components
// Live collaborative content review system

export { CreateSessionModal } from "./CreateSessionModal";
export { ParticipantsList } from "./ParticipantsList";
export { VotingPanel } from "./VotingPanel";
export { SessionChat } from "./SessionChat";
export { SessionSummary } from "./SessionSummary";
export { ReviewSessionView } from "./ReviewSessionView";
export { ActiveSessionsIndicator } from "./ActiveSessionsIndicator";
export { StartSessionButton } from "./StartSessionButton";
export { useReviewSession } from "./useReviewSession";

// New enhanced components
export { VoiceNoteRecorder } from "./VoiceNoteRecorder";
export { SessionTemplateSelector } from "./SessionTemplateSelector";
export { AutoAdvanceTimer } from "./AutoAdvanceTimer";
export { ConflictHighlight, ConflictIndicator } from "./ConflictHighlight";
export { SessionHistoryViewer } from "./SessionHistoryViewer";
export { AnnotationCanvas } from "./AnnotationCanvas";

// Re-export types for convenience
export type {
  ReviewSession,
  ReviewSessionParticipant,
  ReviewSessionVote,
  ReviewSessionChat,
  SessionState,
  VoteSummary,
  SessionProgress,
  SessionSummary as SessionSummaryType,
  CreateSessionRequest,
  CreateSessionResponse,
  ReviewUploadInfo,
  ActiveSessionIndicator,
  // New types
  SessionTemplate,
  VoiceNote,
  SessionAnnotation,
  SessionRecording,
  AutoAdvanceState,
  RejoinSessionRequest,
  RejoinSessionResponse,
} from "@/types/review-session";
