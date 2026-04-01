"use client";

import * as React from "react";
import { Copy, Check, Clipboard } from "lucide-react";
import { Button, ButtonProps } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";

export interface CopyButtonProps
  extends Omit<ButtonProps, "onClick" | "children"> {
  /** The text to copy to clipboard */
  value: string;
  /** Custom label for the button (shows instead of icon) */
  label?: string;
  /** Show icon alongside label */
  showIcon?: boolean;
  /** Custom copy icon */
  copyIcon?: React.ReactNode;
  /** Custom success icon */
  successIcon?: React.ReactNode;
  /** Tooltip text when not copied */
  tooltipText?: string;
  /** Tooltip text when copied */
  copiedTooltipText?: string;
  /** Time in ms before copied state resets */
  resetTimeout?: number;
  /** Callback when copy succeeds */
  onCopySuccess?: (text: string) => void;
  /** Callback when copy fails */
  onCopyError?: (error: Error) => void;
  /** Icon size class */
  iconSize?: string;
}

/**
 * A button component for copying text to clipboard with visual feedback
 * Includes tooltip, success animation, and configurable icons/text
 */
export function CopyButton({
  value,
  label,
  showIcon = true,
  copyIcon,
  successIcon,
  tooltipText = "Copy to clipboard",
  copiedTooltipText = "Copied!",
  resetTimeout = 2000,
  onCopySuccess,
  onCopyError,
  iconSize = "h-4 w-4",
  className,
  variant = "ghost",
  size = "icon",
  ...props
}: CopyButtonProps) {
  const { copied, copy } = useCopyToClipboard({
    resetTimeout,
    onSuccess: onCopySuccess,
    onError: onCopyError,
  });

  const handleCopy = React.useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      await copy(value);
    },
    [copy, value]
  );

  const DefaultCopyIcon = copyIcon ?? <Copy className={iconSize} />;
  const DefaultSuccessIcon = successIcon ?? (
    <Check className={cn(iconSize, "text-emerald-500")} />
  );

  const buttonContent = (
    <>
      {showIcon && (
        <span
          className={cn(
            "transition-all duration-200",
            copied ? "scale-110" : "scale-100"
          )}
        >
          {copied ? DefaultSuccessIcon : DefaultCopyIcon}
        </span>
      )}
      {label && (
        <span className={cn(showIcon && "ml-2", copied && "text-emerald-500")}>
          {copied ? "Copied!" : label}
        </span>
      )}
    </>
  );

  const button = (
    <Button
      type="button"
      variant={variant}
      size={label && !showIcon ? "sm" : size}
      className={cn(
        "relative transition-all duration-200",
        copied && "text-emerald-500",
        className
      )}
      onClick={handleCopy}
      aria-label={copied ? copiedTooltipText : tooltipText}
      {...props}
    >
      {buttonContent}
    </Button>
  );

  // If there's a label, don't wrap in tooltip (text is self-explanatory)
  if (label) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger>{button}</TooltipTrigger>
      <TooltipContent
        side="top"
        className={cn(
          "transition-all duration-200",
          copied && "bg-emerald-500 text-white border-emerald-500"
        )}
      >
        {copied ? copiedTooltipText : tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * A smaller, inline copy button variant for use within inputs or compact spaces
 */
export function CopyButtonInline({
  value,
  className,
  iconSize = "h-3.5 w-3.5",
  ...props
}: CopyButtonProps) {
  return (
    <CopyButton
      value={value}
      variant="ghost"
      size="icon-sm"
      className={cn("h-7 w-7", className)}
      iconSize={iconSize}
      {...props}
    />
  );
}

export default CopyButton;
