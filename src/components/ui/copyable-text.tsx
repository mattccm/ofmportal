"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";

export interface CopyableTextProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** The text to display and copy */
  text: string;
  /** Optional display text (if different from copy text) */
  displayText?: string;
  /** Whether to truncate the text */
  truncate?: boolean;
  /** Maximum width for truncation */
  maxWidth?: string;
  /** Show the full text in a tooltip when truncated */
  showFullTextOnHover?: boolean;
  /** Whether clicking anywhere copies (vs just the button) */
  clickToCopy?: boolean;
  /** Show the copy button inline */
  showCopyButton?: boolean;
  /** Position of the copy button */
  copyButtonPosition?: "left" | "right";
  /** Size of the copy icon */
  iconSize?: string;
  /** Custom class for the text element */
  textClassName?: string;
  /** Custom class for the container */
  containerClassName?: string;
  /** Whether to use monospace font */
  monospace?: boolean;
  /** Callback when copy succeeds */
  onCopySuccess?: (text: string) => void;
  /** Callback when copy fails */
  onCopyError?: (error: Error) => void;
  /** Time in ms before copied state resets */
  resetTimeout?: number;
  /** Tooltip text when not copied */
  tooltipText?: string;
  /** Tooltip text after copying */
  copiedTooltipText?: string;
}

/**
 * A component that displays text with integrated copy functionality
 * Supports truncation, hover tooltips, and click-to-copy behavior
 */
export function CopyableText({
  text,
  displayText,
  truncate = false,
  maxWidth = "200px",
  showFullTextOnHover = true,
  clickToCopy = true,
  showCopyButton = true,
  copyButtonPosition = "right",
  iconSize = "h-3.5 w-3.5",
  textClassName,
  containerClassName,
  monospace = false,
  onCopySuccess,
  onCopyError,
  resetTimeout = 2000,
  tooltipText,
  copiedTooltipText = "Copied!",
  className,
  ...props
}: CopyableTextProps) {
  const { copied, copy } = useCopyToClipboard({
    resetTimeout,
    onSuccess: onCopySuccess,
    onError: onCopyError,
  });

  const displayValue = displayText ?? text;
  const isTruncated = truncate && displayValue.length > 0;

  const handleClick = React.useCallback(
    async (e: React.MouseEvent) => {
      if (!clickToCopy) return;
      e.preventDefault();
      e.stopPropagation();
      await copy(text);
    },
    [clickToCopy, copy, text]
  );

  const handleCopyButtonClick = React.useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      await copy(text);
    },
    [copy, text]
  );

  const copyIcon = (
    <button
      type="button"
      onClick={handleCopyButtonClick}
      className={cn(
        "inline-flex items-center justify-center rounded p-1 transition-all duration-200",
        "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
        "opacity-0 group-hover:opacity-100",
        copied && "opacity-100"
      )}
      aria-label={copied ? copiedTooltipText : tooltipText ?? "Copy"}
    >
      {copied ? (
        <Check className={cn(iconSize, "text-emerald-500")} />
      ) : (
        <Copy className={cn(iconSize, "text-muted-foreground")} />
      )}
    </button>
  );

  const textElement = (
    <span
      className={cn(
        "transition-colors duration-200",
        isTruncated && "truncate block",
        monospace && "font-mono",
        clickToCopy && "cursor-pointer",
        copied && "text-emerald-600 dark:text-emerald-400",
        textClassName
      )}
      style={isTruncated ? { maxWidth } : undefined}
    >
      {displayValue}
    </span>
  );

  const content = (
    <div
      className={cn(
        "group inline-flex items-center gap-1.5",
        clickToCopy && "cursor-pointer",
        containerClassName,
        className
      )}
      onClick={handleClick}
      role={clickToCopy ? "button" : undefined}
      tabIndex={clickToCopy ? 0 : undefined}
      onKeyDown={
        clickToCopy
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                copy(text);
              }
            }
          : undefined
      }
      {...props}
    >
      {showCopyButton && copyButtonPosition === "left" && copyIcon}
      {textElement}
      {showCopyButton && copyButtonPosition === "right" && copyIcon}
    </div>
  );

  // Show tooltip with full text when truncated
  if (isTruncated && showFullTextOnHover) {
    return (
      <Tooltip>
        <TooltipTrigger>{content}</TooltipTrigger>
        <TooltipContent
          side="top"
          className={cn(
            "max-w-sm break-all",
            copied && "bg-emerald-500 text-white border-emerald-500"
          )}
        >
          {copied ? copiedTooltipText : text}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Show tooltip with custom text or copied state
  if (tooltipText || copied) {
    return (
      <Tooltip>
        <TooltipTrigger>{content}</TooltipTrigger>
        <TooltipContent
          side="top"
          className={cn(
            copied && "bg-emerald-500 text-white border-emerald-500"
          )}
        >
          {copied ? copiedTooltipText : tooltipText}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

/**
 * A variant for displaying IDs, keys, and other technical identifiers
 */
export function CopyableId({
  text,
  className,
  ...props
}: Omit<CopyableTextProps, "monospace" | "truncate">) {
  return (
    <CopyableText
      text={text}
      truncate
      maxWidth="120px"
      monospace
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * A variant for displaying URLs
 */
export function CopyableUrl({
  text,
  className,
  ...props
}: Omit<CopyableTextProps, "monospace" | "truncate">) {
  return (
    <CopyableText
      text={text}
      truncate
      maxWidth="300px"
      monospace
      className={cn("text-sm", className)}
      {...props}
    />
  );
}

/**
 * A variant for displaying emails
 */
export function CopyableEmail({
  text,
  className,
  ...props
}: Omit<CopyableTextProps, "truncate">) {
  return (
    <CopyableText
      text={text}
      truncate
      maxWidth="200px"
      className={cn("text-sm text-muted-foreground", className)}
      tooltipText="Click to copy email"
      {...props}
    />
  );
}

/**
 * A variant for API keys and secrets (partially masked)
 */
export function CopyableSecret({
  text,
  visibleChars = 8,
  className,
  ...props
}: Omit<CopyableTextProps, "displayText" | "monospace"> & {
  visibleChars?: number;
}) {
  const maskedText = React.useMemo(() => {
    if (text.length <= visibleChars) return text;
    const prefix = text.slice(0, visibleChars);
    return `${prefix}${"*".repeat(Math.min(24, text.length - visibleChars))}`;
  }, [text, visibleChars]);

  return (
    <CopyableText
      text={text}
      displayText={maskedText}
      monospace
      className={cn("text-sm", className)}
      tooltipText="Click to copy"
      {...props}
    />
  );
}

export default CopyableText;
