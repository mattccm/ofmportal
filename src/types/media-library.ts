// Media Library Types for Creator Portfolio/Content Management

export type MediaType = "image" | "video" | "audio" | "document";
export type MediaStatus = "pending" | "approved" | "archived";

export interface MediaItem {
  id: string;
  creatorId: string;

  // File info
  fileName: string;
  originalName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  thumbnailKey?: string;

  // Metadata
  mediaType: MediaType;
  status: MediaStatus;

  // Organization
  folderId?: string;
  tags: string[];

  // Content details
  title?: string;
  description?: string;

  // For images
  width?: number;
  height?: number;

  // For videos
  duration?: number;
  resolution?: string;

  // Usage tracking
  usageCount: number;
  lastUsedAt?: Date;
  usedInRequests: string[]; // Request IDs where this was used

  // Source
  sourceRequestId?: string; // If imported from an approved upload
  sourceUploadId?: string;

  // Dates
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaFolder {
  id: string;
  creatorId: string;
  name: string;
  parentId?: string;
  color?: string;
  itemCount: number;
  createdAt: Date;
}

// API Types
export interface CreateMediaItemInput {
  creatorId: string;
  fileName: string;
  originalName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  thumbnailKey?: string;
  mediaType: MediaType;
  folderId?: string;
  tags?: string[];
  title?: string;
  description?: string;
  width?: number;
  height?: number;
  duration?: number;
  resolution?: string;
  sourceRequestId?: string;
  sourceUploadId?: string;
}

export interface UpdateMediaItemInput {
  folderId?: string | null;
  tags?: string[];
  title?: string;
  description?: string;
  status?: MediaStatus;
}

export interface CreateMediaFolderInput {
  creatorId: string;
  name: string;
  parentId?: string;
  color?: string;
}

export interface UpdateMediaFolderInput {
  name?: string;
  parentId?: string | null;
  color?: string;
}

export interface MediaLibraryFilters {
  creatorId: string;
  folderId?: string | null;
  mediaType?: MediaType;
  status?: MediaStatus;
  tags?: string[];
  search?: string;
  sortBy?: "createdAt" | "updatedAt" | "fileName" | "fileSize" | "usageCount";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface MediaLibraryResponse {
  items: MediaItem[];
  total: number;
  page: number;
  totalPages: number;
  folders?: MediaFolder[];
}

export interface BulkMediaAction {
  itemIds: string[];
  action: "move" | "tag" | "archive" | "delete";
  folderId?: string;
  tags?: string[];
}

// Import from uploads
export interface ImportableUpload {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  thumbnailUrl?: string;
  requestId: string;
  requestTitle: string;
  approvedAt: Date;
  alreadyImported: boolean;
}

export interface ImportUploadsInput {
  creatorId: string;
  uploadIds: string[];
  folderId?: string;
  tags?: string[];
}
