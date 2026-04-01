// ============================================
// VIDEO TIMESTAMP TYPES
// ============================================

/**
 * User information for video timestamps
 */
export interface TimestampUser {
  id: string;
  name: string;
  avatar?: string | null;
}

/**
 * Annotation for drawing on video frames
 */
export interface TimestampAnnotation {
  type: "point" | "rectangle" | "arrow" | "freehand";
  coordinates: { x: number; y: number }[];
  color: string;
}

/**
 * Video timestamp comment
 */
export interface VideoTimestamp {
  id: string;
  uploadId: string;
  userId: string;

  // Timestamp
  timestamp: number; // Seconds from start
  endTimestamp?: number; // For ranges

  // Comment
  comment: string;
  type: "feedback" | "issue" | "praise" | "note";
  severity?: "minor" | "major" | "critical"; // For issues

  // Resolution
  resolved: boolean;
  resolvedAt?: Date;
  resolvedById?: string;

  // Drawing/annotation
  annotation?: TimestampAnnotation;

  createdAt: Date;
  updatedAt: Date;

  // Relations
  user: TimestampUser;
  replies?: VideoTimestampReply[];
}

/**
 * Reply to a video timestamp
 */
export interface VideoTimestampReply {
  id: string;
  timestampId: string;
  userId: string;
  comment: string;
  createdAt: Date;
  user: TimestampUser;
}

// ============================================
// API TYPES
// ============================================

/**
 * Create timestamp payload
 */
export interface CreateTimestampPayload {
  uploadId: string;
  timestamp: number;
  endTimestamp?: number;
  comment: string;
  type: VideoTimestamp["type"];
  severity?: VideoTimestamp["severity"];
  annotation?: TimestampAnnotation;
}

/**
 * Update timestamp payload
 */
export interface UpdateTimestampPayload {
  id: string;
  comment?: string;
  type?: VideoTimestamp["type"];
  severity?: VideoTimestamp["severity"];
  resolved?: boolean;
  annotation?: TimestampAnnotation;
}

/**
 * Create reply payload
 */
export interface CreateReplyPayload {
  timestampId: string;
  comment: string;
}

/**
 * API response for timestamps list
 */
export interface TimestampsResponse {
  timestamps: VideoTimestamp[];
}

/**
 * API response for single timestamp
 */
export interface TimestampResponse {
  timestamp: VideoTimestamp;
}

/**
 * API response for replies
 */
export interface RepliesResponse {
  replies: VideoTimestampReply[];
}

// ============================================
// COMPONENT TYPES
// ============================================

/**
 * Timestamp marker type colors
 */
export const TIMESTAMP_TYPE_COLORS: Record<VideoTimestamp["type"], string> = {
  feedback: "#3b82f6", // blue
  issue: "#ef4444",    // red
  praise: "#22c55e",   // green
  note: "#a855f7",     // purple
};

/**
 * Severity colors for issues
 */
export const SEVERITY_COLORS: Record<NonNullable<VideoTimestamp["severity"]>, string> = {
  minor: "#fbbf24",    // yellow
  major: "#f97316",    // orange
  critical: "#ef4444", // red
};

/**
 * Annotation tool types
 */
export type AnnotationTool = "point" | "rectangle" | "arrow" | "freehand" | null;

/**
 * Video player state
 */
export interface VideoPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isFullscreen: boolean;
  isMuted: boolean;
}

/**
 * Timestamp filter options
 */
export interface TimestampFilters {
  types: VideoTimestamp["type"][];
  showResolved: boolean;
  sortBy: "timestamp" | "createdAt" | "type";
  sortOrder: "asc" | "desc";
}

/**
 * Default filters
 */
export const DEFAULT_TIMESTAMP_FILTERS: TimestampFilters = {
  types: ["feedback", "issue", "praise", "note"],
  showResolved: true,
  sortBy: "timestamp",
  sortOrder: "asc",
};

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Format timestamp to readable string
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Parse timestamp string to seconds
 */
export function parseTimestamp(timeString: string): number {
  const parts = timeString.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
}

/**
 * Get timestamp type label
 */
export function getTimestampTypeLabel(type: VideoTimestamp["type"]): string {
  switch (type) {
    case "feedback":
      return "Feedback";
    case "issue":
      return "Issue";
    case "praise":
      return "Praise";
    case "note":
      return "Note";
    default:
      return type;
  }
}

/**
 * Get severity label
 */
export function getSeverityLabel(severity: VideoTimestamp["severity"]): string {
  switch (severity) {
    case "minor":
      return "Minor";
    case "major":
      return "Major";
    case "critical":
      return "Critical";
    default:
      return severity || "";
  }
}
