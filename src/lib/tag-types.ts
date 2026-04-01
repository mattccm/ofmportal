// Tag Types and Utilities for the Content Tagging System

export interface Tag {
  id: string;
  name: string;
  color: string;
  agencyId: string;
  usageCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TagInput {
  name: string;
  color: string;
}

// Preset colors for tags with indigo/violet theme
export const PRESET_TAG_COLORS = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Fuchsia", value: "#d946ef" },
  { name: "Pink", value: "#ec4899" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Yellow", value: "#eab308" },
  { name: "Lime", value: "#84cc16" },
  { name: "Green", value: "#22c55e" },
  { name: "Emerald", value: "#10b981" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Slate", value: "#64748b" },
] as const;

// Helper to get contrasting text color
export function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace("#", "");

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black or white based on luminance
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

// Validate hex color
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

// Generate a random preset color
export function getRandomPresetColor(): string {
  const index = Math.floor(Math.random() * PRESET_TAG_COLORS.length);
  return PRESET_TAG_COLORS[index].value;
}

// Tag filter types
export interface TagFilter {
  tagIds: string[];
  mode: "any" | "all"; // Match any tag or all tags
}

// Bulk tag operation types
export type BulkTagAction = "add" | "remove" | "replace";

export interface BulkTagOperation {
  action: BulkTagAction;
  tagIds: string[];
  targetIds: string[]; // Upload or Request IDs
  targetType: "upload" | "request";
}
