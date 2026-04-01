"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Bold,
  Italic,
  Underline,
  Link2,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Code,
  Variable,
  Eye,
  EyeOff,
  Undo,
  Redo,
  Image,
  Heading1,
  Heading2,
  Quote,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Available variables for email templates
export const EMAIL_VARIABLES = [
  { key: "creator.name", label: "Creator Name", example: "John Smith" },
  { key: "creator.email", label: "Creator Email", example: "john@example.com" },
  { key: "creator.phone", label: "Creator Phone", example: "+1 555-0123" },
  { key: "agency.name", label: "Agency Name", example: "Creative Agency" },
  { key: "portal.link", label: "Portal Link", example: "https://portal.example.com" },
  { key: "request.title", label: "Request Title", example: "Summer Campaign Photos" },
  { key: "request.dueDate", label: "Due Date", example: "March 30, 2026" },
  { key: "request.status", label: "Request Status", example: "Pending" },
  { key: "date.today", label: "Today's Date", example: "March 27, 2026" },
  { key: "sender.name", label: "Sender Name", example: "Jane Doe" },
  { key: "sender.email", label: "Sender Email", example: "jane@agency.com" },
] as const;

// Template blocks for quick insertion
export const TEMPLATE_BLOCKS = [
  {
    id: "greeting",
    name: "Greeting",
    content: "Hi {{creator.name}},\n\n",
  },
  {
    id: "introduction",
    name: "Introduction",
    content: "I hope this email finds you well. I wanted to reach out regarding your content submissions.\n\n",
  },
  {
    id: "request-reminder",
    name: "Request Reminder",
    content: "This is a friendly reminder that your content for \"{{request.title}}\" is due on {{request.dueDate}}.\n\n",
  },
  {
    id: "portal-cta",
    name: "Portal CTA",
    content: "You can access your portal and upload content here: {{portal.link}}\n\n",
  },
  {
    id: "closing",
    name: "Closing",
    content: "Best regards,\n{{sender.name}}\n{{agency.name}}",
  },
  {
    id: "thank-you",
    name: "Thank You",
    content: "Thank you for your continued partnership with {{agency.name}}. We appreciate your work!\n\n",
  },
] as const;

interface EmailEditorProps {
  subject: string;
  onSubjectChange: (subject: string) => void;
  body: string;
  onBodyChange: (body: string) => void;
  previewData?: Record<string, string>;
  className?: string;
}

export function EmailEditor({
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  previewData = {},
  className,
}: EmailEditorProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Insert text at cursor position
  const insertAtCursor = useCallback(
    (text: string) => {
      const before = body.substring(0, cursorPosition);
      const after = body.substring(cursorPosition);
      const newBody = before + text + after;
      onBodyChange(newBody);

      // Set cursor position after inserted text
      setTimeout(() => {
        if (textareaRef.current) {
          const newPos = cursorPosition + text.length;
          textareaRef.current.setSelectionRange(newPos, newPos);
          textareaRef.current.focus();
        }
      }, 0);
    },
    [body, cursorPosition, onBodyChange]
  );

  // Insert variable
  const insertVariable = useCallback(
    (variableKey: string) => {
      insertAtCursor(`{{${variableKey}}}`);
      setShowVariablePicker(false);
    },
    [insertAtCursor]
  );

  // Insert template block
  const insertTemplateBlock = useCallback(
    (blockId: string) => {
      const block = TEMPLATE_BLOCKS.find((b) => b.id === blockId);
      if (block) {
        insertAtCursor(block.content);
      }
    },
    [insertAtCursor]
  );

  // Apply formatting
  const applyFormatting = useCallback(
    (type: string) => {
      if (!textareaRef.current) return;

      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const selectedText = body.substring(start, end);

      let prefix = "";
      let suffix = "";

      switch (type) {
        case "bold":
          prefix = "**";
          suffix = "**";
          break;
        case "italic":
          prefix = "*";
          suffix = "*";
          break;
        case "underline":
          prefix = "<u>";
          suffix = "</u>";
          break;
        case "code":
          prefix = "`";
          suffix = "`";
          break;
        case "h1":
          prefix = "# ";
          break;
        case "h2":
          prefix = "## ";
          break;
        case "quote":
          prefix = "> ";
          break;
        case "ul":
          prefix = "- ";
          break;
        case "ol":
          prefix = "1. ";
          break;
        case "hr":
          insertAtCursor("\n---\n");
          return;
        case "link":
          prefix = "[";
          suffix = "](url)";
          break;
      }

      const before = body.substring(0, start);
      const after = body.substring(end);
      const newText = prefix + (selectedText || "text") + suffix;
      const newBody = before + newText + after;
      onBodyChange(newBody);

      // Set cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          const newPos = start + prefix.length + (selectedText ? selectedText.length : 4);
          textareaRef.current.setSelectionRange(newPos, newPos);
          textareaRef.current.focus();
        }
      }, 0);
    },
    [body, onBodyChange, insertAtCursor]
  );

  // Process variables for preview
  const processVariables = useCallback(
    (text: string): string => {
      let processed = text;

      EMAIL_VARIABLES.forEach((variable) => {
        const regex = new RegExp(`\\{\\{${variable.key}\\}\\}`, "g");
        const value = previewData[variable.key] || variable.example;
        processed = processed.replace(regex, `<span class="bg-primary/20 px-1 rounded">${value}</span>`);
      });

      return processed;
    },
    [previewData]
  );

  // Handle cursor position tracking
  const handleSelect = useCallback(() => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  }, []);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Subject Line */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Subject Line</label>
        <Input
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Enter email subject..."
          className="text-base"
        />
        <p className="text-xs text-muted-foreground">
          You can use variables like {"{{creator.name}}"} in the subject
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/50 p-2">
        {/* Formatting buttons */}
        <div className="flex items-center gap-0.5 border-r pr-2 mr-1">
          <ToolbarButton icon={Bold} onClick={() => applyFormatting("bold")} title="Bold" />
          <ToolbarButton icon={Italic} onClick={() => applyFormatting("italic")} title="Italic" />
          <ToolbarButton icon={Underline} onClick={() => applyFormatting("underline")} title="Underline" />
          <ToolbarButton icon={Code} onClick={() => applyFormatting("code")} title="Code" />
        </div>

        {/* Headings */}
        <div className="flex items-center gap-0.5 border-r pr-2 mr-1">
          <ToolbarButton icon={Heading1} onClick={() => applyFormatting("h1")} title="Heading 1" />
          <ToolbarButton icon={Heading2} onClick={() => applyFormatting("h2")} title="Heading 2" />
          <ToolbarButton icon={Quote} onClick={() => applyFormatting("quote")} title="Quote" />
        </div>

        {/* Lists */}
        <div className="flex items-center gap-0.5 border-r pr-2 mr-1">
          <ToolbarButton icon={List} onClick={() => applyFormatting("ul")} title="Bullet List" />
          <ToolbarButton icon={ListOrdered} onClick={() => applyFormatting("ol")} title="Numbered List" />
          <ToolbarButton icon={Link2} onClick={() => applyFormatting("link")} title="Link" />
          <ToolbarButton icon={Minus} onClick={() => applyFormatting("hr")} title="Horizontal Rule" />
        </div>

        {/* Variable picker */}
        <Dialog open={showVariablePicker} onOpenChange={setShowVariablePicker}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8"
            >
              <Variable className="h-4 w-4" />
              <span className="hidden sm:inline">Insert Variable</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Insert Variable</DialogTitle>
              <DialogDescription>
                Click a variable to insert it at the cursor position
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 max-h-[300px] overflow-y-auto">
              {EMAIL_VARIABLES.map((variable) => (
                <button
                  key={variable.key}
                  onClick={() => insertVariable(variable.key)}
                  className="flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                >
                  <div>
                    <p className="font-medium">{variable.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {`{{${variable.key}}}`}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    e.g. {variable.example}
                  </span>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Template blocks */}
        <Select onValueChange={insertTemplateBlock}>
          <SelectTrigger className="h-8 w-auto gap-1.5">
            <SelectValue placeholder="Template Block" />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_BLOCKS.map((block) => (
              <SelectItem key={block.id} value={block.id}>
                {block.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Preview toggle */}
        <div className="ml-auto">
          <Button
            variant={isPreviewMode ? "default" : "outline"}
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
          >
            {isPreviewMode ? (
              <>
                <EyeOff className="h-4 w-4" />
                <span className="hidden sm:inline">Edit</span>
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">Preview</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Editor / Preview */}
      {isPreviewMode ? (
        <div className="min-h-[300px] rounded-lg border bg-white p-4 dark:bg-gray-950">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <div className="mb-4 rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">
                <strong>Subject:</strong>{" "}
                <span
                  dangerouslySetInnerHTML={{
                    __html: processVariables(subject),
                  }}
                />
              </p>
            </div>
            <div
              className="whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: processVariables(body),
              }}
            />
          </div>
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          onSelect={handleSelect}
          onClick={handleSelect}
          onKeyUp={handleSelect}
          placeholder="Compose your email here...

Use {{creator.name}} to insert the creator's name.
Use the toolbar above to format your text or insert variables."
          className="min-h-[300px] font-mono text-sm"
        />
      )}

      {/* Variable hints */}
      {!isPreviewMode && (
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-sm font-medium mb-2">Quick Reference</p>
          <div className="flex flex-wrap gap-2">
            {EMAIL_VARIABLES.slice(0, 5).map((variable) => (
              <button
                key={variable.key}
                onClick={() => insertVariable(variable.key)}
                className="inline-flex items-center rounded-md bg-background px-2 py-1 text-xs font-mono border hover:bg-muted transition-colors"
              >
                {`{{${variable.key}}}`}
              </button>
            ))}
            <span className="text-xs text-muted-foreground self-center">
              Click to insert
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Toolbar button component
function ToolbarButton({
  icon: Icon,
  onClick,
  title,
  active = false,
}: {
  icon: React.ElementType;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground",
        active && "bg-background text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export default EmailEditor;
