/**
 * Notes/Memo System Utilities
 * Provides formatting, mention support, and hashtag support for notes
 */

// Note Types
export interface Note {
  id: string;
  content: string;
  entityType: "request" | "creator" | "upload";
  entityId: string;
  authorId: string;
  authorName: string;
  isPinned: boolean;
  isInternal: boolean; // Only visible to team, not creators
  createdAt: string;
  updatedAt: string;
  mentions: string[]; // User IDs
  hashtags: string[]; // Tag strings
}

export interface NoteFormData {
  content: string;
  isPinned?: boolean;
  isInternal?: boolean;
}

export interface ParsedContent {
  html: string;
  mentions: string[];
  hashtags: string[];
}

/**
 * Extract mentions (@username) from content
 * Returns array of usernames without the @ prefix
 */
export function extractMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = content.match(mentionRegex);
  if (!matches) return [];

  // Remove @ prefix and deduplicate
  const mentions = matches.map((m) => m.slice(1));
  return [...new Set(mentions)];
}

/**
 * Extract hashtags (#tag) from content
 * Returns array of tags without the # prefix
 */
export function extractHashtags(content: string): string[] {
  const hashtagRegex = /#(\w+)/g;
  const matches = content.match(hashtagRegex);
  if (!matches) return [];

  // Remove # prefix and deduplicate
  const hashtags = matches.map((h) => h.slice(1).toLowerCase());
  return [...new Set(hashtags)];
}

/**
 * Format note content with markdown-like support
 * Converts mentions, hashtags, and basic markdown to HTML
 */
export function formatNoteContent(content: string): string {
  let formatted = content;

  // Escape HTML to prevent XSS
  formatted = escapeHtml(formatted);

  // Format mentions - wrap in span with special styling
  formatted = formatted.replace(
    /@(\w+)/g,
    '<span class="mention text-primary font-medium bg-primary/10 px-1 rounded">@$1</span>'
  );

  // Format hashtags - wrap in span with special styling
  formatted = formatted.replace(
    /#(\w+)/g,
    '<span class="hashtag text-violet-600 dark:text-violet-400 font-medium bg-violet-100 dark:bg-violet-900/30 px-1 rounded">#$1</span>'
  );

  // Format bold text (**text**)
  formatted = formatted.replace(
    /\*\*(.+?)\*\*/g,
    '<strong class="font-semibold">$1</strong>'
  );

  // Format italic text (*text* or _text_)
  formatted = formatted.replace(
    /\*(.+?)\*/g,
    '<em>$1</em>'
  );
  formatted = formatted.replace(
    /_(.+?)_/g,
    '<em>$1</em>'
  );

  // Format code (`code`)
  formatted = formatted.replace(
    /`(.+?)`/g,
    '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>'
  );

  // Format strikethrough (~~text~~)
  formatted = formatted.replace(
    /~~(.+?)~~/g,
    '<del class="text-muted-foreground">$1</del>'
  );

  // Format line breaks
  formatted = formatted.replace(/\n/g, '<br />');

  // Format URLs
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  formatted = formatted.replace(
    urlRegex,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:no-underline">$1</a>'
  );

  return formatted;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

/**
 * Parse content and extract structured data
 */
export function parseNoteContent(content: string): ParsedContent {
  return {
    html: formatNoteContent(content),
    mentions: extractMentions(content),
    hashtags: extractHashtags(content),
  };
}

/**
 * Generate a unique note ID
 */
export function generateNoteId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 11);
  return `note_${timestamp}_${randomPart}`;
}

/**
 * Create a new note object
 */
export function createNote(
  data: NoteFormData,
  entityType: Note["entityType"],
  entityId: string,
  authorId: string,
  authorName: string
): Note {
  const now = new Date().toISOString();
  const parsed = parseNoteContent(data.content);

  return {
    id: generateNoteId(),
    content: data.content,
    entityType,
    entityId,
    authorId,
    authorName,
    isPinned: data.isPinned ?? false,
    isInternal: data.isInternal ?? true, // Default to internal notes
    createdAt: now,
    updatedAt: now,
    mentions: parsed.mentions,
    hashtags: parsed.hashtags,
  };
}

/**
 * Filter notes by search query
 * Searches in content, mentions, and hashtags
 */
export function searchNotes(notes: Note[], query: string): Note[] {
  if (!query.trim()) return notes;

  const lowerQuery = query.toLowerCase().trim();

  return notes.filter((note) => {
    // Search in content
    if (note.content.toLowerCase().includes(lowerQuery)) return true;

    // Search in mentions
    if (note.mentions.some((m) => m.toLowerCase().includes(lowerQuery))) return true;

    // Search in hashtags (without # prefix in query)
    const hashtagQuery = lowerQuery.startsWith('#') ? lowerQuery.slice(1) : lowerQuery;
    if (note.hashtags.some((h) => h.toLowerCase().includes(hashtagQuery))) return true;

    // Search in author name
    if (note.authorName.toLowerCase().includes(lowerQuery)) return true;

    return false;
  });
}

/**
 * Sort notes with pinned notes first, then by date
 */
export function sortNotes(notes: Note[], order: "asc" | "desc" = "desc"): Note[] {
  return [...notes].sort((a, b) => {
    // Pinned notes always come first
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    // Sort by date
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();

    return order === "desc" ? dateB - dateA : dateA - dateB;
  });
}

/**
 * Get all unique hashtags from notes
 */
export function getAllHashtags(notes: Note[]): string[] {
  const allHashtags = notes.flatMap((note) => note.hashtags);
  return [...new Set(allHashtags)].sort();
}

/**
 * Get all unique mentions from notes
 */
export function getAllMentions(notes: Note[]): string[] {
  const allMentions = notes.flatMap((note) => note.mentions);
  return [...new Set(allMentions)].sort();
}

/**
 * Filter notes by hashtag
 */
export function filterByHashtag(notes: Note[], hashtag: string): Note[] {
  const normalizedTag = hashtag.toLowerCase().replace(/^#/, '');
  return notes.filter((note) =>
    note.hashtags.some((h) => h.toLowerCase() === normalizedTag)
  );
}

/**
 * Get preview text from note content (first line or truncated)
 */
export function getNotePreview(content: string, maxLength: number = 100): string {
  // Get first line
  const firstLine = content.split('\n')[0];

  if (firstLine.length <= maxLength) {
    return firstLine;
  }

  return firstLine.slice(0, maxLength - 3) + '...';
}

/**
 * Format relative time for note display
 */
export function formatNoteTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  // Format as date for older notes
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}
