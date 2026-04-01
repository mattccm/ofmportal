"use client";

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import {
  Loader2,
  Send,
  Lock,
  Paperclip,
  X,
  Bold,
  Italic,
  List,
  Code,
  AtSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

interface CommentEditorProps {
  teamMembers: TeamMember[];
  onSubmit: (
    message: string,
    mentions: string[],
    attachments: File[],
    isInternal?: boolean
  ) => Promise<void>;
  onCancel?: () => void;
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  showInternalToggle?: boolean;
  autoFocus?: boolean;
}

// ============================================
// MENTION DROPDOWN COMPONENT
// ============================================

interface MentionDropdownProps {
  members: TeamMember[];
  filter: string;
  onSelect: (member: TeamMember) => void;
  position: { top: number; left: number };
  selectedIndex: number;
}

function MentionDropdown({
  members,
  filter,
  onSelect,
  position,
  selectedIndex,
}: MentionDropdownProps) {
  const filteredMembers = members.filter(
    (member) =>
      member.name.toLowerCase().includes(filter.toLowerCase()) ||
      member.email.toLowerCase().includes(filter.toLowerCase())
  );

  if (filteredMembers.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute z-50 w-64 max-h-48 overflow-auto bg-popover border rounded-md shadow-md"
      style={{ top: position.top, left: position.left }}
    >
      {filteredMembers.slice(0, 5).map((member, index) => (
        <button
          key={member.id}
          type="button"
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors",
            index === selectedIndex && "bg-accent"
          )}
          onClick={() => onSelect(member)}
        >
          <Avatar user={member} size="xs" />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{member.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {member.email}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ============================================
// FORMATTING TOOLBAR
// ============================================

interface FormattingToolbarProps {
  onFormat: (format: string) => void;
  onMentionClick: () => void;
}

function FormattingToolbar({ onFormat, onMentionClick }: FormattingToolbarProps) {
  return (
    <div className="flex items-center gap-1 p-1 border-b bg-muted/50">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => onFormat("bold")}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => onFormat("italic")}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => onFormat("list")}
        title="Bullet list"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => onFormat("code")}
        title="Code"
      >
        <Code className="h-4 w-4" />
      </Button>
      <div className="w-px h-4 bg-border mx-1" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={onMentionClick}
        title="Mention someone (@)"
      >
        <AtSign className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================
// MAIN COMMENT EDITOR COMPONENT
// ============================================

export function CommentEditor({
  teamMembers,
  onSubmit,
  onCancel,
  initialValue = "",
  placeholder = "Add a comment...",
  submitLabel = "Send",
  showInternalToggle = false,
  autoFocus = false,
}: CommentEditorProps) {
  const [message, setMessage] = useState(initialValue);
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [mentions, setMentions] = useState<string[]>([]);

  // Mention autocomplete state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Focus textarea on mount if autoFocus
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Handle text changes and detect @ mentions
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setMessage(value);

    // Check for @ mention
    const textBeforeCursor = value.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(atIndex + 1);
      // Only show dropdown if there's no space after @ and not inside a completed mention
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("]")) {
        setMentionStartIndex(atIndex);
        setMentionFilter(textAfterAt);
        setShowMentions(true);
        setSelectedMentionIndex(0);

        // Calculate dropdown position
        if (textareaRef.current) {
          const rect = textareaRef.current.getBoundingClientRect();
          setMentionPosition({
            top: rect.height + 4,
            left: Math.min(atIndex * 8, rect.width - 256),
          });
        }
        return;
      }
    }

    setShowMentions(false);
    setMentionStartIndex(null);
  };

  // Handle mention selection
  const handleMentionSelect = (member: TeamMember) => {
    if (mentionStartIndex === null) return;

    const cursorPos = textareaRef.current?.selectionStart || 0;
    const beforeMention = message.substring(0, mentionStartIndex);
    const afterMention = message.substring(cursorPos);
    const mentionText = `@[${member.name}](${member.id}) `;

    const newMessage = beforeMention + mentionText + afterMention;
    setMessage(newMessage);

    // Track the mention
    if (!mentions.includes(member.id)) {
      setMentions([...mentions, member.id]);
    }

    setShowMentions(false);
    setMentionStartIndex(null);

    // Focus and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Handle keyboard navigation in mention dropdown
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Handle mention dropdown navigation
    if (showMentions) {
      const filteredMembers = teamMembers.filter(
        (member) =>
          member.name.toLowerCase().includes(mentionFilter.toLowerCase()) ||
          member.email.toLowerCase().includes(mentionFilter.toLowerCase())
      );

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          Math.min(prev + 1, Math.min(filteredMembers.length - 1, 4))
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filteredMembers[selectedMentionIndex]) {
          handleMentionSelect(filteredMembers[selectedMentionIndex]);
        }
      } else if (e.key === "Escape") {
        setShowMentions(false);
      }
      return;
    }

    // Handle formatting shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "b") {
        e.preventDefault();
        applyFormat("bold");
      } else if (e.key === "i") {
        e.preventDefault();
        applyFormat("italic");
      }
    }

    // Escape to cancel
    if (e.key === "Escape" && onCancel) {
      onCancel();
    }
  };

  // Apply formatting to selected text
  const applyFormat = (format: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end);

    let formattedText = "";
    let cursorOffset = 0;

    switch (format) {
      case "bold":
        formattedText = `**${selectedText}**`;
        cursorOffset = 2;
        break;
      case "italic":
        formattedText = `_${selectedText}_`;
        cursorOffset = 1;
        break;
      case "code":
        if (selectedText.includes("\n")) {
          formattedText = `\`\`\`\n${selectedText}\n\`\`\``;
          cursorOffset = 4;
        } else {
          formattedText = `\`${selectedText}\``;
          cursorOffset = 1;
        }
        break;
      case "list":
        const lines = selectedText.split("\n");
        formattedText = lines.map((line) => `- ${line}`).join("\n");
        cursorOffset = 2;
        break;
      default:
        return;
    }

    const newMessage =
      message.substring(0, start) + formattedText + message.substring(end);
    setMessage(newMessage);

    // Set cursor position after formatting
    setTimeout(() => {
      if (textarea) {
        const newPos = selectedText
          ? start + formattedText.length
          : start + cursorOffset;
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  // Handle mention button click
  const handleMentionClick = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const beforeCursor = message.substring(0, cursorPos);
    const afterCursor = message.substring(cursorPos);

    // Insert @ at cursor position
    const newMessage = beforeCursor + "@" + afterCursor;
    setMessage(newMessage);

    // Trigger mention dropdown
    setMentionStartIndex(cursorPos);
    setMentionFilter("");
    setShowMentions(true);
    setSelectedMentionIndex(0);

    // Calculate dropdown position
    const rect = textarea.getBoundingClientRect();
    setMentionPosition({
      top: rect.height + 4,
      left: Math.min(cursorPos * 8, rect.width - 256),
    });

    // Focus and set cursor after @
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos + 1, cursorPos + 1);
    }, 0);
  }, [message]);

  // Handle file attachment
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments([...attachments, ...files]);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!message.trim() && attachments.length === 0) return;

    setSubmitting(true);
    try {
      await onSubmit(message, mentions, attachments, isInternal);
      setMessage("");
      setAttachments([]);
      setMentions([]);
      setIsInternal(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="relative border rounded-lg overflow-hidden bg-background">
      {/* Formatting Toolbar */}
      <FormattingToolbar onFormat={applyFormat} onMentionClick={handleMentionClick} />

      {/* Textarea */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={3}
          disabled={submitting}
          className="border-0 rounded-none focus-visible:ring-0 resize-none min-h-[80px]"
        />

        {/* Mention Dropdown */}
        {showMentions && (
          <MentionDropdown
            members={teamMembers}
            filter={mentionFilter}
            onSelect={handleMentionSelect}
            position={mentionPosition}
            selectedIndex={selectedMentionIndex}
          />
        )}
      </div>

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="px-3 py-2 border-t bg-muted/30">
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="inline-flex items-center gap-2 px-2 py-1 bg-background border rounded text-sm"
              >
                <span className="truncate max-w-[150px]">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({formatFileSize(file.size)})
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30">
        <div className="flex items-center gap-3">
          {/* File Attachment */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
          >
            <Paperclip className="h-4 w-4 mr-1" />
            Attach
          </Button>

          {/* Internal Toggle */}
          {showInternalToggle && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="internal-comment"
                checked={isInternal}
                onCheckedChange={(checked) => setIsInternal(!!checked)}
                disabled={submitting}
              />
              <Label
                htmlFor="internal-comment"
                className="text-sm text-muted-foreground flex items-center gap-1 cursor-pointer"
              >
                <Lock className="h-3 w-3" />
                Internal only
              </Label>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={(!message.trim() && attachments.length === 0) || submitting}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {submitLabel}
          </Button>
        </div>
      </div>

      {/* Keyboard shortcut hint */}
      <div className="px-3 py-1 text-xs text-muted-foreground bg-muted/30 border-t">
        Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Cmd</kbd>+
        <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> to send
      </div>
    </div>
  );
}
