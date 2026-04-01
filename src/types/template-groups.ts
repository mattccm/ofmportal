// Template Groups Types
// Organize request templates by platform (Instagram, Twitter, TikTok, OnlyFans, Fansly, etc.)

// ============================================
// PLATFORM TYPES
// ============================================

export type Platform =
  | "instagram"
  | "twitter"
  | "tiktok"
  | "onlyfans"
  | "fansly"
  | "youtube"
  | "reddit"
  | "custom";

// ============================================
// TEMPLATE GROUP INTERFACE
// ============================================

export interface TemplateGroup {
  id: string;
  name: string;
  description?: string;
  platform: Platform;
  icon?: string;
  color?: string;
  templateIds: string[];
  isDefault?: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateGroupWithTemplates extends TemplateGroup {
  templates: TemplateInGroup[];
}

export interface TemplateInGroup {
  id: string;
  name: string;
  description?: string;
  fieldCount: number;
  usageCount: number;
  isActive: boolean;
}

// ============================================
// PLATFORM CONFIGURATION
// ============================================

export interface PlatformConfig {
  label: string;
  icon: string;
  color: string;
  defaultFields: string[];
  description?: string;
}

export const PLATFORM_CONFIG: Record<Platform, PlatformConfig> = {
  instagram: {
    label: "Instagram",
    icon: "Instagram",
    color: "#E4405F",
    defaultFields: ["image", "caption", "hashtags"],
    description: "Photo and video content for Instagram posts, stories, and reels",
  },
  twitter: {
    label: "Twitter/X",
    icon: "Twitter",
    color: "#1DA1F2",
    defaultFields: ["image", "text", "hashtags"],
    description: "Tweets, threads, and media for Twitter/X",
  },
  tiktok: {
    label: "TikTok",
    icon: "Music",
    color: "#000000",
    defaultFields: ["video", "caption", "sounds"],
    description: "Short-form video content for TikTok",
  },
  onlyfans: {
    label: "OnlyFans",
    icon: "Heart",
    color: "#00AFF0",
    defaultFields: ["media", "caption", "price", "ppv"],
    description: "Content for OnlyFans feed, messages, and PPV",
  },
  fansly: {
    label: "Fansly",
    icon: "Star",
    color: "#1FA7F8",
    defaultFields: ["media", "caption", "tier"],
    description: "Tiered content for Fansly",
  },
  youtube: {
    label: "YouTube",
    icon: "Youtube",
    color: "#FF0000",
    defaultFields: ["video", "title", "description", "tags"],
    description: "Long and short-form video content for YouTube",
  },
  reddit: {
    label: "Reddit",
    icon: "MessageCircle",
    color: "#FF4500",
    defaultFields: ["media", "title", "subreddit"],
    description: "Posts and content for Reddit communities",
  },
  custom: {
    label: "Custom",
    icon: "Folder",
    color: "#6B7280",
    defaultFields: [],
    description: "Custom template groups for any platform",
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getPlatformConfig(platform: Platform): PlatformConfig {
  return PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.custom;
}

export function getPlatformLabel(platform: Platform): string {
  return PLATFORM_CONFIG[platform]?.label || "Unknown";
}

export function getPlatformColor(platform: Platform): string {
  return PLATFORM_CONFIG[platform]?.color || "#6B7280";
}

export function getAllPlatforms(): Platform[] {
  return Object.keys(PLATFORM_CONFIG) as Platform[];
}

export function isValidPlatform(value: string): value is Platform {
  return Object.keys(PLATFORM_CONFIG).includes(value);
}

// ============================================
// FORM DATA TYPES
// ============================================

export interface TemplateGroupFormData {
  name: string;
  description?: string;
  platform: Platform;
  icon?: string;
  color?: string;
  templateIds: string[];
  isDefault?: boolean;
  sortOrder?: number;
}

export interface CreateTemplateGroupInput {
  name: string;
  description?: string;
  platform: Platform;
  icon?: string;
  color?: string;
  templateIds?: string[];
  isDefault?: boolean;
}

export interface UpdateTemplateGroupInput {
  name?: string;
  description?: string;
  platform?: Platform;
  icon?: string;
  color?: string;
  templateIds?: string[];
  isDefault?: boolean;
  sortOrder?: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface TemplateGroupsResponse {
  groups: TemplateGroup[];
  total: number;
}

export interface TemplateGroupResponse {
  group: TemplateGroupWithTemplates;
}

// ============================================
// RECENT & FAVORITES
// ============================================

export interface RecentlyUsedGroup {
  groupId: string;
  usedAt: Date;
}

export interface FavoriteGroup {
  groupId: string;
  favoritedAt: Date;
}

// ============================================
// DRAG AND DROP
// ============================================

export interface DragItem {
  type: "template" | "group";
  id: string;
  index: number;
  groupId?: string;
}

export interface DropResult {
  templateId: string;
  fromGroupId?: string;
  toGroupId: string;
  newIndex: number;
}
