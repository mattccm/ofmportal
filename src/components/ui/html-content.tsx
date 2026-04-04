"use client";

import { cn } from "@/lib/utils";

/**
 * Sanitize HTML to prevent XSS while keeping formatting
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  // Remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "");
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
