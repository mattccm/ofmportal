"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  children: string;
  className?: string;
  /** Compact mode reduces spacing and font sizes */
  compact?: boolean;
}

/**
 * Markdown renderer component with Tailwind prose styling.
 * Supports GitHub-flavored markdown (tables, strikethrough, autolinks, task lists).
 */
export function Markdown({ children, className, compact = false }: MarkdownProps) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        // Base text styling
        "prose-p:text-muted-foreground prose-p:leading-relaxed",
        // Headings
        "prose-headings:text-foreground prose-headings:font-semibold",
        "prose-h1:text-lg prose-h2:text-base prose-h3:text-sm",
        // Links
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        // Lists
        "prose-ul:list-disc prose-ol:list-decimal",
        "prose-li:text-muted-foreground prose-li:marker:text-muted-foreground/60",
        // Code
        "prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:bg-muted prose-pre:text-muted-foreground prose-pre:text-xs",
        // Blockquotes
        "prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground prose-blockquote:not-italic",
        // Tables
        "prose-table:text-sm",
        "prose-th:text-foreground prose-th:font-medium",
        "prose-td:text-muted-foreground",
        // Strong/Bold
        "prose-strong:text-foreground prose-strong:font-semibold",
        // Compact mode adjustments
        compact && [
          "prose-p:my-1 prose-p:text-xs",
          "prose-headings:my-1",
          "prose-ul:my-1 prose-ol:my-1",
          "prose-li:my-0.5",
          "prose-blockquote:my-1 prose-blockquote:pl-2",
        ],
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Inline markdown for single-line content (no block elements).
 */
export function InlineMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <span className={cn("inline [&_p]:inline", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Force inline rendering
          p: ({ children }) => <>{children}</>,
        }}
      >
        {children}
      </ReactMarkdown>
    </span>
  );
}

export default Markdown;
