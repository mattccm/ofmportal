"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { MentionAutocomplete } from "./mention-autocomplete";
import { useMentionInput } from "@/hooks/use-mentions";
import type { MentionSuggestion } from "@/types/mentions";

// ============================================
// TYPES
// ============================================

export interface MentionInputRef {
  focus: () => void;
  clear: () => void;
  getText: () => string;
  getMentionIds: () => string[];
  insertMention: (suggestion: MentionSuggestion) => void;
}

export interface MentionInputProps {
  /** Initial text value */
  value?: string;
  /** Callback when text changes */
  onChange?: (value: string, mentionIds: string[]) => void;
  /** Callback when mentions change */
  onMentionsChange?: (mentionIds: string[]) => void;
  /** Callback on submit (Enter without Shift) */
  onSubmit?: (value: string, mentionIds: string[]) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Number of visible rows */
  rows?: number;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Custom className */
  className?: string;
  /** Container className */
  containerClassName?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Allow multi-line input */
  multiline?: boolean;
  /** Recent mentions (shown first in suggestions) */
  recentMentions?: string[];
  /** Max character length */
  maxLength?: number;
}

// ============================================
// MENTION INPUT COMPONENT
// ============================================

export const MentionInput = forwardRef<MentionInputRef, MentionInputProps>(
  function MentionInput(
    {
      value: controlledValue,
      onChange,
      onMentionsChange,
      onSubmit,
      placeholder = "Type @ to mention someone...",
      rows = 3,
      disabled = false,
      className,
      containerClassName,
      autoFocus = false,
      multiline = true,
      recentMentions = [],
      maxLength,
    },
    ref
  ) {
    // Refs
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Use controlled or uncontrolled value
    const isControlled = controlledValue !== undefined;

    // Mention input hook
    const {
      inputState,
      suggestions,
      isLoadingSuggestions,
      handleTextChange: handleMentionTextChange,
      handleKeyDown: handleMentionKeyDown,
      handleSelectSuggestion,
      closeSuggestions,
      text: uncontrolledText,
      setText: setUncontrolledText,
      mentionIds,
    } = useMentionInput(controlledValue ?? "", { onMentionsChange });

    // Get current text
    const text = isControlled ? controlledValue : uncontrolledText;

    // Dropdown position state
    const [dropdownPosition, setDropdownPosition] = useState<{
      top: number;
      left: number;
    } | null>(null);

    // Calculate dropdown position
    const calculateDropdownPosition = useCallback(() => {
      if (!textareaRef.current || !containerRef.current) return null;

      const textarea = textareaRef.current;
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();

      // Get caret coordinates (approximate based on character position)
      const textBeforeCursor = text.slice(0, textarea.selectionStart);
      const lines = textBeforeCursor.split("\n");
      const currentLineIndex = lines.length - 1;
      const currentLineText = lines[currentLineIndex];

      // Calculate approximate position
      const lineHeight = 24; // Approximate line height
      const charWidth = 8; // Approximate character width

      const top = Math.min(
        (currentLineIndex + 1) * lineHeight + 8,
        textarea.offsetHeight
      );
      const left = Math.min(
        currentLineText.length * charWidth,
        containerRect.width - 300
      );

      return { top, left: Math.max(0, left) };
    }, [text]);

    // Update dropdown position when autocomplete opens
    useEffect(() => {
      if (inputState.isOpen) {
        setDropdownPosition(calculateDropdownPosition());
      }
    }, [inputState.isOpen, calculateDropdownPosition]);

    // Handle text area change
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const cursorPosition = e.target.selectionStart;

        if (maxLength && newValue.length > maxLength) {
          return;
        }

        if (!isControlled) {
          setUncontrolledText(newValue);
        }

        handleMentionTextChange(newValue, cursorPosition);
        onChange?.(newValue, mentionIds);
      },
      [
        isControlled,
        setUncontrolledText,
        handleMentionTextChange,
        onChange,
        mentionIds,
        maxLength,
      ]
    );

    // Handle key down
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Handle mention autocomplete navigation
        if (handleMentionKeyDown(e)) {
          return;
        }

        // Handle submit on Enter (without Shift for multiline)
        if (
          e.key === "Enter" &&
          !e.shiftKey &&
          onSubmit &&
          (!multiline || !inputState.isOpen)
        ) {
          e.preventDefault();
          onSubmit(text, mentionIds);
        }
      },
      [handleMentionKeyDown, onSubmit, text, mentionIds, multiline, inputState.isOpen]
    );

    // Handle selection change to track cursor
    const handleSelect = useCallback(
      (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement;
        handleMentionTextChange(text, target.selectionStart);
      },
      [handleMentionTextChange, text]
    );

    // Handle suggestion selection
    const handleSuggestionSelect = useCallback(
      (suggestion: MentionSuggestion) => {
        const newText = handleSelectSuggestion(suggestion);
        onChange?.(newText, [...mentionIds, suggestion.id]);

        // Focus textarea after selection
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 0);
      },
      [handleSelectSuggestion, onChange, mentionIds]
    );

    // Close on click outside
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          closeSuggestions();
        }
      };

      if (inputState.isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
          document.removeEventListener("mousedown", handleClickOutside);
        };
      }
    }, [inputState.isOpen, closeSuggestions]);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        focus: () => textareaRef.current?.focus(),
        clear: () => {
          if (!isControlled) {
            setUncontrolledText("");
          }
          onChange?.("", []);
        },
        getText: () => text,
        getMentionIds: () => mentionIds,
        insertMention: (suggestion: MentionSuggestion) => {
          handleSuggestionSelect(suggestion);
        },
      }),
      [
        isControlled,
        setUncontrolledText,
        onChange,
        text,
        mentionIds,
        handleSuggestionSelect,
      ]
    );

    return (
      <div ref={containerRef} className={cn("relative", containerClassName)}>
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cn(
            "resize-none",
            inputState.isOpen && "ring-2 ring-primary/50",
            className
          )}
          aria-expanded={inputState.isOpen}
          aria-haspopup="listbox"
          aria-controls={inputState.isOpen ? "mention-suggestions" : undefined}
        />

        {/* Character count */}
        {maxLength && (
          <div
            className={cn(
              "absolute bottom-2 right-2 text-xs",
              text.length > maxLength * 0.9
                ? "text-amber-500"
                : "text-muted-foreground"
            )}
          >
            {text.length}/{maxLength}
          </div>
        )}

        {/* Autocomplete dropdown */}
        {inputState.isOpen && (
          <MentionAutocomplete
            suggestions={suggestions}
            selectedIndex={inputState.selectedIndex}
            query={inputState.query}
            isLoading={isLoadingSuggestions}
            recentMentions={recentMentions}
            onSelect={handleSuggestionSelect}
            onHover={(index) => {
              // Could update selected index on hover if desired
            }}
            position={dropdownPosition ?? undefined}
            className="top-full mt-1"
          />
        )}
      </div>
    );
  }
);

// ============================================
// SIMPLE MENTION INPUT (Uncontrolled convenience wrapper)
// ============================================

interface SimpleMentionInputProps {
  onSubmit: (text: string, mentionIds: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SimpleMentionInput({
  onSubmit,
  placeholder,
  disabled,
  className,
}: SimpleMentionInputProps) {
  const inputRef = useRef<MentionInputRef>(null);

  const handleSubmit = useCallback(
    (text: string, mentionIds: string[]) => {
      if (text.trim()) {
        onSubmit(text, mentionIds);
        inputRef.current?.clear();
      }
    },
    [onSubmit]
  );

  return (
    <MentionInput
      ref={inputRef}
      onSubmit={handleSubmit}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
}

export default MentionInput;
