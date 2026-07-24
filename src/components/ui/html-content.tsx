"use client";

import DOMPurify from "isomorphic-dompurify";
import { cn } from "@/lib/utils";

/**
 * Sanitize HTML to prevent XSS while keeping formatting.
 * Uses DOMPurify with an allowlist - only permitted tags and attributes are kept.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "b", "i", "u", "em", "strong", "a", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code",
      "span", "div", "img", "hr", "table", "thead", "tbody", "tr", "td", "th",
      "sub", "sup", "small", "del", "s",
    ],
    ALLOWED_ATTR: ["href", "title", "target", "rel", "src", "alt", "width", "height", "class"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_ATTR: ["style"],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Strip all HTML tags and return plain text
 * Useful for showing descriptions in list views
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&nbsp;/g, " ") // Replace non-breaking spaces
    .replace(/&amp;/g, "&") // Replace HTML entities
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

interface HtmlContentProps {
  html: string | null | undefined;
  className?: string;
  /** Use prose styles for rich content formatting */
  prose?: boolean;
}

/**
 * Safely render HTML content with sanitization
 * Use this for user-generated HTML content like descriptions
 */
export function HtmlContent({ html, className, prose = true }: HtmlContentProps) {
  if (!html) return null;

  return (
    <div
      className={cn(
        prose && "prose prose-sm dark:prose-invert max-w-none",
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}
