"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface UseCopyToClipboardOptions {
  /** Time in milliseconds before the copied state resets */
  resetTimeout?: number;
  /** Callback function called on successful copy */
  onSuccess?: (text: string) => void;
  /** Callback function called on copy error */
  onError?: (error: Error) => void;
}

export interface UseCopyToClipboardReturn {
  /** Whether the text was recently copied successfully */
  copied: boolean;
  /** Any error that occurred during copying */
  error: Error | null;
  /** Function to copy text to clipboard */
  copy: (text: string) => Promise<boolean>;
  /** Function to manually reset the copied state */
  reset: () => void;
}

/**
 * Hook for copying text to clipboard with success state management
 * Includes fallback for older browsers that don't support the Clipboard API
 */
export function useCopyToClipboard(
  options: UseCopyToClipboardOptions = {}
): UseCopyToClipboardReturn {
  const { resetTimeout = 2000, onSuccess, onError } = options;

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const reset = useCallback(() => {
    setCopied(false);
    setError(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  /**
   * Fallback copy method using execCommand for older browsers
   */
  const fallbackCopy = useCallback((text: string): boolean => {
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    textArea.style.opacity = "0";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      document.body.removeChild(textArea);
      return false;
    }
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      try {
        // Try using the Clipboard API first
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          // Fall back to execCommand for older browsers or non-secure contexts
          const successful = fallbackCopy(text);
          if (!successful) {
            throw new Error("Failed to copy text using fallback method");
          }
        }

        setCopied(true);
        setError(null);
        onSuccess?.(text);

        // Reset copied state after timeout
        timeoutRef.current = setTimeout(() => {
          setCopied(false);
        }, resetTimeout);

        return true;
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to copy to clipboard");
        setError(error);
        setCopied(false);
        onError?.(error);
        return false;
      }
    },
    [fallbackCopy, onError, onSuccess, resetTimeout]
  );

  return { copied, error, copy, reset };
}

export default useCopyToClipboard;
