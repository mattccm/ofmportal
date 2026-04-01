// Live Review Session Types
// Real-time collaborative content review system

// ============================================
// Session Status and Roles
// ============================================

export type ReviewSessionStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type SessionParticipantRole = "HOST" | "REVIEWER" | "OBSERVER";
export type ReviewVoteType = "APPROVE" | "REJECT" | "DISCUSS" | "SKIP";
export type ChatMessageType = "MESSAGE" | "SYSTEM" | "REACTION" | "VOICE_NOTE";

// ============================================
// Core Data Types
// ============================================

export interface ReviewSession {
  id: string;
  agencyId: string;
  name: string;
  description?: string | null;
  status: ReviewSessionStatus;
  hostUserId: string;
  startedAt: Date;
  endedAt?: Date | null;
  uploadIds: string[];
  currentUploadIndex: number;
  settings: ReviewSessionSettings;
  participants?: ReviewSessionParticipant[];
  votes?: ReviewSessionVote[];
  chatMessages?: ReviewSessionChat[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewSessionParticipant {
  id: string;
  sessionId: string;
  userId: string;
  joinedAt: Date;
  leftAt?: Date | null;
  votesCount: number;
  messagesCount: number;
  isActive: boolean;
  role: SessionParticipantRole;
  createdAt: Date;
  // Populated user info
  user?: {
    id: string;
    name: string;
    avatar?: string | null;
    email: string;
  };
}

export interface ReviewSessionVote {
  id: string;
  sessionId: string;
  uploadId: string;
  userId: string;
  vote: ReviewVoteType;
  note?: string | null;
  votedAt: Date;
  createdAt: Date;
  // Populated user info
  user?: {
    id: string;
    name: string;
    avatar?: string | null;
  };
}

export interface ReviewSessionChat {
  id: string;
  sessionId: string;
  userId: string;
  message: string;
  uploadId?: string | null;
  type: ChatMessageType;
  createdAt: Date;
  // Voice note support
  voiceNoteUrl?: string | null;
  voiceNoteDuration?: number | null; // Duration in seconds
  // Populated user info
  user?: {
    id: string;
    name: string;
    avatar?: string | null;
  };
}

// ============================================
// Session Settings
// ============================================

export interface ReviewSessionSettings {
  allowAnonymousVotes?: boolean;
  requireAllVotes?: boolean;
  autoAdvance?: boolean;
  autoAdvanceDelay?: number; // seconds to wait before auto-advancing
  autoAdvanceTimer?: number; // Seconds timer for auto-advance (0 = disabled)
  autoAdvanceOnMajority?: boolean; // Auto-advance when majority is reached
  showVotesImmediately?: boolean;
  allowChat?: boolean;
  allowReactions?: boolean;
  allowVoiceNotes?: boolean; // Enable voice note comments
  allowAnnotations?: boolean; // Enable drawing/annotations on content
  votingTimeLimit?: number; // seconds per item (0 = unlimited)
  onlyHostCanNavigate?: boolean;
  enableSessionRecording?: boolean; // Record all session activity
  conflictHighlighting?: boolean; // Highlight vote conflicts
}

export const DEFAULT_SESSION_SETTINGS: ReviewSessionSettings = {
  allowAnonymousVotes: false,
  requireAllVotes: false,
  autoAdvance: false,
  autoAdvanceDelay: 5,
  autoAdvanceTimer: 0,
  autoAdvanceOnMajority: false,
  showVotesImmediately: true,
  allowChat: true,
  allowReactions: true,
  allowVoiceNotes: true,
  allowAnnotations: true,
  votingTimeLimit: 0,
  onlyHostCanNavigate: true,
  enableSessionRecording: true,
  conflictHighlighting: true,
};

// ============================================
// Upload Info for Review
// ============================================

export interface ReviewUploadInfo {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  storageUrl?: string | null;
  thumbnailUrl?: string | null;
  metadata: Record<string, unknown>;
  creatorId: string;
  creatorName: string;
  requestId: string;
  requestTitle: string;
  uploadedAt?: Date | null;
}

// ============================================
// Session State (for real-time sync)
// ============================================

export interface SessionState {
  session: ReviewSession;
  participants: ReviewSessionParticipantWithUser[];
  currentUpload: ReviewUploadInfo | null;
  votes: ReviewSessionVoteWithUser[];
  recentMessages: ReviewSessionChatWithUser[];
  voteSummary: VoteSummary;
  progress: SessionProgress;
}

export interface ReviewSessionParticipantWithUser extends ReviewSessionParticipant {
  user: {
    id: string;
    name: string;
    avatar?: string | null;
    email: string;
  };
}

export interface ReviewSessionVoteWithUser extends ReviewSessionVote {
  user: {
    id: string;
    name: string;
    avatar?: string | null;
  };
}

export interface ReviewSessionChatWithUser extends ReviewSessionChat {
  user: {
    id: string;
    name: string;
    avatar?: string | null;
  };
}

export interface VoteSummary {
  uploadId: string;
  approve: number;
  reject: number;
  discuss: number;
  skip: number;
  total: number;
  majority: ReviewVoteType | null;
  hasConsensus: boolean;
  consensusThreshold: number;
  // Conflict resolution
  hasConflict: boolean;
  conflictType?: "approve_reject" | "approve_discuss" | "reject_discuss" | "three_way";
  conflictSeverity?: "low" | "medium" | "high"; // Based on vote distribution
}

export interface SessionProgress {
  currentIndex: number;
  totalItems: number;
  reviewedCount: number;
  approvedCount: number;
  rejectedCount: number;
  discussCount: number;
  percentComplete: number;
  elapsedTime: number; // seconds since session started
  // Auto-advance timer
  autoAdvanceTimeRemaining?: number; // Seconds remaining before auto-advance
  // Item timing for analytics
  currentItemStartTime?: Date;
  avgReviewTimePerItem?: number; // Average seconds per item
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateSessionRequest {
  name: string;
  description?: string;
  uploadIds: string[];
  inviteUserIds?: string[];
  settings?: Partial<ReviewSessionSettings>;
}

export interface CreateSessionResponse {
  session: ReviewSession;
  inviteLink: string;
}

export interface JoinSessionRequest {
  role?: SessionParticipantRole;
}

export interface JoinSessionResponse {
  participant: ReviewSessionParticipant;
  state: SessionState;
}

export interface VoteRequest {
  uploadId: string;
  vote: ReviewVoteType;
  note?: string;
}

export interface VoteResponse {
  vote: ReviewSessionVote;
  summary: VoteSummary;
}

export interface ChatRequest {
  message: string;
  type?: ChatMessageType;
}

export interface ChatResponse {
  message: ReviewSessionChat;
}

export interface NavigationRequest {
  action: "next" | "previous" | "goto";
  index?: number; // for "goto" action
}

export interface EndSessionRequest {
  status?: "COMPLETED" | "CANCELLED";
  note?: string;
}

// ============================================
// SSE Event Types
// ============================================

export type SessionEventType =
  | "session_update"
  | "participant_joined"
  | "participant_left"
  | "vote_cast"
  | "navigation_change"
  | "chat_message"
  | "session_ended"
  | "ping";

export interface SessionEvent<T = unknown> {
  type: SessionEventType;
  timestamp: Date;
  data: T;
}

export interface ParticipantJoinedEvent {
  participant: ReviewSessionParticipantWithUser;
  participantCount: number;
}

export interface ParticipantLeftEvent {
  userId: string;
  participantCount: number;
}

export interface VoteCastEvent {
  vote: ReviewSessionVoteWithUser;
  summary: VoteSummary;
}

export interface NavigationChangeEvent {
  currentUploadIndex: number;
  currentUpload: ReviewUploadInfo;
  progress: SessionProgress;
}

export interface ChatMessageEvent {
  message: ReviewSessionChatWithUser;
}

export interface SessionEndedEvent {
  status: ReviewSessionStatus;
  endedAt: Date;
  summary: SessionSummary;
}

// ============================================
// Session Summary (end of session stats)
// ============================================

export interface SessionSummary {
  sessionId: string;
  sessionName: string;
  duration: number; // seconds
  totalItems: number;
  reviewedItems: number;
  participantCount: number;
  totalVotes: number;
  decisions: SessionDecision[];
  participantStats: ParticipantStats[];
}

export interface SessionDecision {
  uploadId: string;
  uploadName: string;
  creatorName: string;
  thumbnailUrl?: string | null;
  decision: ReviewVoteType | "PENDING";
  voteBreakdown: {
    approve: number;
    reject: number;
    discuss: number;
    skip: number;
  };
  notes: string[];
}

export interface ParticipantStats {
  userId: string;
  userName: string;
  userAvatar?: string | null;
  role: SessionParticipantRole;
  joinedAt: Date;
  leftAt?: Date | null;
  totalVotes: number;
  approveVotes: number;
  rejectVotes: number;
  discussVotes: number;
  messagesCount: number;
  participationDuration: number; // seconds
}

// ============================================
// UI Component Props Types
// ============================================

export interface ReviewSessionViewProps {
  sessionId: string;
  userId: string;
  isHost: boolean;
}

export interface ParticipantsListProps {
  participants: ReviewSessionParticipantWithUser[];
  hostUserId: string;
  currentUserId: string;
}

export interface VotingPanelProps {
  currentUploadId: string | null;
  userVote: ReviewVoteType | null;
  voteSummary: VoteSummary | null;
  isVoting: boolean;
  onVote: (vote: ReviewVoteType, note?: string) => void;
  disabled?: boolean;
}

export interface SessionChatProps {
  sessionId: string;
  messages: ReviewSessionChatWithUser[];
  currentUserId: string;
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export interface SessionSummaryProps {
  summary: SessionSummary;
  onClose: () => void;
  onExport?: () => void;
}

export interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateSession: (request: CreateSessionRequest) => Promise<CreateSessionResponse>;
  availableUploads: ReviewUploadInfo[];
  teamMembers: Array<{ id: string; name: string; email: string; avatar?: string | null }>;
}

// ============================================
// Utility Types
// ============================================

export interface SessionInvite {
  sessionId: string;
  sessionName: string;
  hostName: string;
  itemCount: number;
  invitedAt: Date;
  expiresAt?: Date;
}

export interface ActiveSessionIndicator {
  sessionId: string;
  sessionName: string;
  participantCount: number;
  currentItemIndex: number;
  totalItems: number;
  hostName: string;
  startedAt: Date;
}

// ============================================
// Session Templates
// ============================================

export interface SessionTemplate {
  id: string;
  agencyId: string;
  name: string;
  description?: string | null;
  settings: ReviewSessionSettings;
  // Default participant configuration
  defaultParticipantIds?: string[];
  defaultParticipantRoles?: Record<string, SessionParticipantRole>;
  // Filter criteria for uploads
  uploadFilters?: SessionTemplateUploadFilters;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionTemplateUploadFilters {
  creatorIds?: string[];
  requestIds?: string[];
  fileTypes?: string[];
  statuses?: string[];
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

export interface CreateSessionTemplateRequest {
  name: string;
  description?: string;
  settings: ReviewSessionSettings;
  defaultParticipantIds?: string[];
  defaultParticipantRoles?: Record<string, SessionParticipantRole>;
  uploadFilters?: SessionTemplateUploadFilters;
}

// ============================================
// Voice Notes
// ============================================

export interface VoiceNote {
  id: string;
  sessionId: string;
  userId: string;
  uploadId: string;
  audioUrl: string;
  duration: number; // seconds
  transcript?: string | null; // AI-generated transcript
  createdAt: Date;
}

export interface VoiceNoteRequest {
  uploadId: string;
  audioBlob: Blob;
  duration: number;
}

// ============================================
// Session Annotations
// ============================================

export interface SessionAnnotation {
  id: string;
  sessionId: string;
  uploadId: string;
  userId: string;
  type: SessionAnnotationType;
  data: AnnotationData;
  color: string;
  timestamp?: number; // For video annotations (seconds)
  createdAt: Date;
}

export type SessionAnnotationType = "freehand" | "rectangle" | "circle" | "arrow" | "text" | "highlight";

export interface AnnotationData {
  // For freehand drawings
  paths?: Array<{ x: number; y: number }[]>;
  // For shapes
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // For arrows
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  // For text
  text?: string;
  fontSize?: number;
}

export interface AnnotationEvent {
  annotation: SessionAnnotation;
  action: "add" | "update" | "delete" | "clear";
}

// ============================================
// Session Recording / History
// ============================================

export interface SessionRecording {
  id: string;
  sessionId: string;
  events: SessionRecordingEvent[];
  startedAt: Date;
  endedAt?: Date | null;
  metadata: SessionRecordingMetadata;
}

export interface SessionRecordingEvent {
  timestamp: Date;
  type: SessionRecordingEventType;
  userId?: string;
  data: Record<string, unknown>;
}

export type SessionRecordingEventType =
  | "session_started"
  | "session_ended"
  | "participant_joined"
  | "participant_left"
  | "vote_cast"
  | "vote_changed"
  | "navigation"
  | "chat_message"
  | "voice_note"
  | "annotation_added"
  | "annotation_removed"
  | "role_changed"
  | "settings_changed";

export interface SessionRecordingMetadata {
  totalDuration: number;
  participantCount: number;
  totalVotes: number;
  totalMessages: number;
  totalAnnotations: number;
  totalVoiceNotes: number;
}

// ============================================
// Rejoin Session
// ============================================

export interface RejoinSessionRequest {
  lastKnownIndex?: number;
  lastEventTimestamp?: Date;
}

export interface RejoinSessionResponse {
  participant: ReviewSessionParticipantWithUser;
  state: SessionState;
  missedEvents: SessionRecordingEvent[];
  rejoinedAt: Date;
}

// ============================================
// Session Analytics
// ============================================

export interface SessionAnalytics {
  sessionId: string;
  // Timing metrics
  totalDuration: number;
  avgReviewTimePerItem: number;
  minReviewTime: number;
  maxReviewTime: number;
  reviewTimesPerItem: Record<string, number>; // uploadId -> seconds
  // Vote metrics
  agreementRate: number; // Percentage of items with consensus
  avgVotesPerItem: number;
  voteDistribution: {
    approve: number;
    reject: number;
    discuss: number;
    skip: number;
  };
  // Participation metrics
  participantEngagement: ParticipantEngagement[];
  // Most discussed items
  mostDiscussedItems: MostDiscussedItem[];
  // Conflict analysis
  conflictRate: number;
  conflictItems: ConflictItem[];
}

export interface ParticipantEngagement {
  userId: string;
  userName: string;
  participationRate: number; // Percentage of items voted on
  avgResponseTime: number; // Avg seconds to cast vote
  agreementWithMajority: number; // How often they voted with majority
  votingPattern: {
    approve: number;
    reject: number;
    discuss: number;
    skip: number;
  };
}

export interface MostDiscussedItem {
  uploadId: string;
  uploadName: string;
  creatorName: string;
  discussVoteCount: number;
  messageCount: number;
  voiceNoteCount: number;
  annotationCount: number;
  reviewTime: number;
}

export interface ConflictItem {
  uploadId: string;
  uploadName: string;
  conflictType: "approve_reject" | "approve_discuss" | "reject_discuss" | "three_way";
  voteBreakdown: {
    approve: number;
    reject: number;
    discuss: number;
  };
  finalDecision: ReviewVoteType | "PENDING";
  resolutionMethod?: "majority" | "discussion" | "host_override";
}

// ============================================
// Auto-advance Timer
// ============================================

export interface AutoAdvanceState {
  enabled: boolean;
  duration: number; // Total seconds
  remaining: number; // Seconds remaining
  isPaused: boolean;
  pausedAt?: Date;
}

export interface AutoAdvanceEvent {
  type: "timer_started" | "timer_paused" | "timer_resumed" | "timer_reset" | "timer_completed";
  remaining?: number;
}

// ============================================
// Participant Role Management
// ============================================

export interface ParticipantRoleChangeRequest {
  userId: string;
  newRole: SessionParticipantRole;
}

export interface ParticipantRoleChangeEvent {
  userId: string;
  previousRole: SessionParticipantRole;
  newRole: SessionParticipantRole;
  changedBy: string;
}
