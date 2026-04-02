"use client";

import * as React from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
  Heading1,
  Heading2,
  Quote,
  Minus,
  Undo,
  Redo,
} from "lucide-react";
import { Button } from "./button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";
import { Input } from "./input";

// ============================================
// TOOLBAR BUTTON
// ============================================

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "p-1.5 rounded-md transition-colors",
        "hover:bg-muted focus:bg-muted focus:outline-none",
        isActive && "bg-primary/10 text-primary",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

// ============================================
// LINK POPOVER
// ============================================

function LinkPopover({ editor }: { editor: Editor | null }) {
  const [url, setUrl] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const handleSetLink = () => {
    if (!editor) return;

    if (url) {
      // Ensure URL has protocol
      const finalUrl = url.startsWith("http") ? url : `https://${url}`;
      editor.chain().focus().setLink({ href: finalUrl }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setUrl("");
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && editor) {
      // Pre-fill with current link URL if exists
      const previousUrl = editor.getAttributes("link").href || "";
      setUrl(previousUrl);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Add link"
          className={cn(
            "p-1.5 rounded-md transition-colors",
            "hover:bg-muted focus:bg-muted focus:outline-none",
            editor?.isActive("link") && "bg-primary/10 text-primary"
          )}
        >
          <LinkIcon className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <p className="text-sm font-medium">Insert Link</p>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSetLink();
              }
            }}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSetLink}
              className="flex-1"
            >
              Apply
            </Button>
            {editor?.isActive("link") && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  editor?.chain().focus().unsetLink().run();
                  setOpen(false);
                }}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// EDITOR TOOLBAR
// ============================================

interface EditorToolbarProps {
  editor: Editor | null;
}

function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-border/50 bg-muted/30">
      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="Underline (Ctrl+U)"
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet list"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Numbered list"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Block elements */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Quote"
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Divider"
      >
        <Minus className="h-4 w-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Link */}
      <LinkPopover editor={editor} />

      <div className="flex-1" />

      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Y)"
      >
        <Redo className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

// ============================================
// MAIN EDITOR COMPONENT
// ============================================

interface WysiwygEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  minHeight?: string;
  maxHeight?: string;
  disabled?: boolean;
}

export function WysiwygEditor({
  value = "",
  onChange,
  placeholder = "Write something...",
  className,
  editorClassName,
  minHeight = "120px",
  maxHeight = "400px",
  disabled = false,
}: WysiwygEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline hover:text-primary/80",
        },
      }),
      Underline,
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  // Sync external value changes
  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  // Sync disabled state
  React.useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  return (
    <div
      className={cn(
        "rounded-lg border border-input bg-background overflow-hidden",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <EditorToolbar editor={editor} />
      <EditorContent
        editor={editor}
        className={cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "px-3 py-2 overflow-y-auto",
          "[&_.ProseMirror]:outline-none",
          "[&_.ProseMirror]:min-h-[var(--min-height)]",
          "[&_.ProseMirror.is-editor-empty]:before:content-[attr(data-placeholder)]",
          "[&_.ProseMirror.is-editor-empty]:before:text-muted-foreground",
          "[&_.ProseMirror.is-editor-empty]:before:float-left",
          "[&_.ProseMirror.is-editor-empty]:before:h-0",
          "[&_.ProseMirror.is-editor-empty]:before:pointer-events-none",
          // Prose styling overrides
          "[&_.ProseMirror_h1]:text-xl",
          "[&_.ProseMirror_h1]:font-bold",
          "[&_.ProseMirror_h1]:mt-4",
          "[&_.ProseMirror_h1]:mb-2",
          "[&_.ProseMirror_h2]:text-lg",
          "[&_.ProseMirror_h2]:font-semibold",
          "[&_.ProseMirror_h2]:mt-3",
          "[&_.ProseMirror_h2]:mb-2",
          "[&_.ProseMirror_p]:my-1.5",
          "[&_.ProseMirror_ul]:my-1.5",
          "[&_.ProseMirror_ol]:my-1.5",
          "[&_.ProseMirror_blockquote]:border-l-4",
          "[&_.ProseMirror_blockquote]:border-primary/30",
          "[&_.ProseMirror_blockquote]:pl-4",
          "[&_.ProseMirror_blockquote]:italic",
          "[&_.ProseMirror_blockquote]:text-muted-foreground",
          "[&_.ProseMirror_hr]:my-4",
          "[&_.ProseMirror_hr]:border-border",
          editorClassName
        )}
        style={{
          ["--min-height" as string]: minHeight,
          maxHeight,
        }}
      />
    </div>
  );
}

export default WysiwygEditor;
