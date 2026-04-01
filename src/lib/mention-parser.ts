import type { ParsedMention, MentionSegment, MentionSuggestion } from "@/types/mentions";

// ============================================
// REGEX PATTERNS
// ============================================

/**
 * Pattern to match @mentions in text
 * Matches: @[User Name](userId) format for stored mentions
 */
export const MENTION_PATTERN = /@\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Pattern to detect @ trigger while typing
 * Matches @ followed by word characters
 */
export const MENTION_TRIGGER_PATTERN = /@(\w*)$/;

/**
 * Pattern to match simple @username mentions (for display)
 */
export const SIMPLE_MENTION_PATTERN = /@(\w+)/g;

// ============================================
// PARSING FUNCTIONS
// ============================================

/**
 * Parse all mentions from formatted text
 * @param text - Text containing @[Name](id) formatted mentions
 * @returns Array of parsed mentions with positions
 */
export function parseMentions(text: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  const regex = new RegExp(MENTION_PATTERN.source, "g");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    mentions.push({
      userId: match[2],
      username: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return mentions;
}

/**
 * Extract just the user IDs from text
 * @param text - Text containing mentions
 * @returns Array of user IDs
 */
export function extractMentionIds(text: string): string[] {
  const mentions = parseMentions(text);
  return [...new Set(mentions.map((m) => m.userId))];
}

/**
 * Convert mention format to display text
 * @param text - Text with @[Name](id) format
 * @returns Text with @Name format for display
 */
export function formatMentionsForDisplay(text: string): string {
  return text.replace(MENTION_PATTERN, "@$1");
}

/**
 * Convert text to segments for rich rendering
 * @param text - Text with formatted mentions
 * @returns Array of text and mention segments
 */
export function textToMentionSegments(text: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  const regex = new RegExp(MENTION_PATTERN.source, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }

    // Add mention segment
    segments.push({
      type: "mention",
      username: match[1],
      userId: match[2],
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return segments;
}

/**
 * Create a mention string in the stored format
 * @param user - User to mention
 * @returns Formatted mention string
 */
export function createMentionString(user: MentionSuggestion): string {
  return `@[${user.name}](${user.id})`;
}

/**
 * Get the current mention query from text at cursor position
 * @param text - Full text
 * @param cursorPosition - Current cursor position
 * @returns Mention query or null if not in mention context
 */
export function getMentionQuery(
  text: string,
  cursorPosition: number
): { query: string; startIndex: number } | null {
  // Get text up to cursor
  const textBeforeCursor = text.slice(0, cursorPosition);

  // Find the last @ symbol
  const lastAtIndex = textBeforeCursor.lastIndexOf("@");
  if (lastAtIndex === -1) return null;

  // Get text after @ to cursor
  const queryText = textBeforeCursor.slice(lastAtIndex + 1);

  // Check if this looks like an active mention query
  // (no spaces, newlines, or special chars that would break a mention)
  if (/^[\w\s]*$/.test(queryText) && !queryText.includes("\n")) {
    return {
      query: queryText,
      startIndex: lastAtIndex,
    };
  }

  return null;
}

/**
 * Insert a mention at the given position
 * @param text - Current text
 * @param mention - Mention to insert
 * @param startIndex - Start of the @query to replace
 * @param cursorPosition - Current cursor position
 * @returns New text and new cursor position
 */
export function insertMention(
  text: string,
  mention: MentionSuggestion,
  startIndex: number,
  cursorPosition: number
): { text: string; cursorPosition: number } {
  const mentionString = createMentionString(mention);
  const beforeMention = text.slice(0, startIndex);
  const afterMention = text.slice(cursorPosition);

  // Add a space after the mention for better UX
  const newText = beforeMention + mentionString + " " + afterMention;
  const newCursorPosition = startIndex + mentionString.length + 1;

  return {
    text: newText,
    cursorPosition: newCursorPosition,
  };
}

/**
 * Filter suggestions based on query
 * @param suggestions - All available suggestions
 * @param query - Search query
 * @returns Filtered and sorted suggestions
 */
export function filterSuggestions(
  suggestions: MentionSuggestion[],
  query: string
): MentionSuggestion[] {
  if (!query) return suggestions.slice(0, 10);

  const lowerQuery = query.toLowerCase();

  return suggestions
    .filter((user) => {
      const nameMatch = user.name.toLowerCase().includes(lowerQuery);
      const emailMatch = user.email.toLowerCase().includes(lowerQuery);
      return nameMatch || emailMatch;
    })
    .sort((a, b) => {
      // Prioritize name matches that start with the query
      const aNameStarts = a.name.toLowerCase().startsWith(lowerQuery);
      const bNameStarts = b.name.toLowerCase().startsWith(lowerQuery);

      if (aNameStarts && !bNameStarts) return -1;
      if (!aNameStarts && bNameStarts) return 1;

      // Then by name alphabetically
      return a.name.localeCompare(b.name);
    })
    .slice(0, 10);
}

/**
 * Highlight matching text in a string
 * @param text - Text to highlight
 * @param query - Query to highlight
 * @returns Array of { text, highlighted } segments
 */
export function highlightMatch(
  text: string,
  query: string
): { text: string; highlighted: boolean }[] {
  if (!query) {
    return [{ text, highlighted: false }];
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const startIndex = lowerText.indexOf(lowerQuery);

  if (startIndex === -1) {
    return [{ text, highlighted: false }];
  }

  const segments: { text: string; highlighted: boolean }[] = [];

  if (startIndex > 0) {
    segments.push({
      text: text.slice(0, startIndex),
      highlighted: false,
    });
  }

  segments.push({
    text: text.slice(startIndex, startIndex + query.length),
    highlighted: true,
  });

  if (startIndex + query.length < text.length) {
    segments.push({
      text: text.slice(startIndex + query.length),
      highlighted: false,
    });
  }

  return segments;
}

/**
 * Check if a mention string is valid
 * @param mentionString - String to validate
 * @returns True if valid mention format
 */
export function isValidMentionFormat(mentionString: string): boolean {
  const regex = new RegExp(`^${MENTION_PATTERN.source}$`);
  return regex.test(mentionString);
}

/**
 * Count mentions in text
 * @param text - Text to count mentions in
 * @returns Number of mentions
 */
export function countMentions(text: string): number {
  const matches = text.match(MENTION_PATTERN);
  return matches ? matches.length : 0;
}

/**
 * Strip all mentions from text (for plain text extraction)
 * @param text - Text with mentions
 * @returns Plain text without mention formatting
 */
export function stripMentions(text: string): string {
  return text.replace(MENTION_PATTERN, "$1");
}
