"use client";

import * as React from "react";
import {
  Type,
  AlignLeft,
  Hash,
  Calendar,
  ChevronDown,
  CheckSquare,
  Upload,
  X,
  Plus,
  GripVertical,
  Settings2,
  Trash2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Video,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";
import { cn } from "@/lib/utils";

// Helper to safely parse error response
async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const error = await response.json();
    return error.error || "Upload failed";
  } catch {
    // Response wasn't JSON, try to get text
    try {
      const text = await response.text();
      if (text) {
        return text.substring(0, 100); // Limit error message length
      }
    } catch {
      // Ignore
    }
    return `Upload failed (${response.status})`;
  }
}

import {
  TemplateField,
  FieldType,
  SelectOption,
  ValidationRule,
  ConditionalVisibility,
  RichContent,
  FIELD_TYPE_CONFIG,
} from "@/lib/template-types";

// ============================================
// FIELD TYPE ICONS
// ============================================

const fieldTypeIcons: Record<FieldType, React.ElementType> = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  date: Calendar,
  select: ChevronDown,
  checkbox: CheckSquare,
  file: Upload,
};

// ============================================
// FIELD EDITOR PROPS
// ============================================

interface FieldEditorProps {
  field: TemplateField;
  allFields: TemplateField[];
  onChange: (field: TemplateField) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
}

// ============================================
// FIELD EDITOR COMPONENT
// ============================================

export function FieldEditor({
  field,
  allFields,
  onChange,
  onDelete,
  onDuplicate,
  isExpanded,
  onToggleExpand,
  dragHandleProps,
  isDragging,
}: FieldEditorProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showValidationPanel, setShowValidationPanel] = React.useState(false);
  const [showConditionalPanel, setShowConditionalPanel] = React.useState(false);

  const Icon = fieldTypeIcons[field.type];
  const config = FIELD_TYPE_CONFIG[field.type];

  const updateField = (updates: Partial<TemplateField>) => {
    onChange({ ...field, ...updates });
  };

  const otherFields = allFields.filter((f) => f.id !== field.id);

  return (
    <>
      <div
        className={cn(
          "group relative rounded-xl border bg-card transition-all duration-200",
          isDragging
            ? "border-primary shadow-lg ring-2 ring-primary/20"
            : "border-border/50 hover:border-border hover:shadow-sm",
          isExpanded && "ring-1 ring-primary/10"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4">
          {/* Drag Handle */}
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted transition-colors"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Field Type Icon */}
          <div
            className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
              `bg-${config.color}-500/10`
            )}
            style={{
              backgroundColor: `var(--${config.color}-100, hsl(var(--primary) / 0.1))`,
            }}
          >
            <Icon
              className="h-5 w-5"
              style={{
                color: `var(--${config.color}-500, hsl(var(--primary)))`,
              }}
            />
          </div>

          {/* Field Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground truncate">
                {field.label || "Untitled Field"}
              </span>
              {field.quantity && field.quantity > 1 && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  x{field.quantity}
                </Badge>
              )}
              {field.required && (
                <Badge variant="outline" className="text-xs shrink-0">
                  Required
                </Badge>
              )}
              {field.conditionalVisibility && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  <Eye className="h-3 w-3 mr-1" />
                  Conditional
                </Badge>
              )}
            </div>
            <span className="text-sm text-muted-foreground">
              {config.label}
              {field.quantity && field.quantity > 1 && ` (${field.quantity} duplicates)`}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleExpand}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onDuplicate}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Expanded Editor */}
        {isExpanded && (
          <div className="border-t px-4 py-5 space-y-5 animate-in slide-in-from-top-2 duration-200">
            {/* Basic Settings */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Field Type */}
              <div className="space-y-2">
                <Label>Field Type</Label>
                <Select
                  value={field.type}
                  onValueChange={(value: FieldType) => {
                    const updates: Partial<TemplateField> = { type: value };
                    if (value === "select" && !field.options?.length) {
                      updates.options = [
                        { id: `opt_${Date.now()}`, label: "Option 1", value: "option1" },
                      ];
                    }
                    if (value === "file") {
                      updates.acceptedFileTypes = ["image/*", "video/*"];
                      updates.maxFileSize = 100 * 1024 * 1024;
                      updates.maxFiles = 10;
                    }
                    updateField(updates);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FIELD_TYPE_CONFIG) as FieldType[]).map((type) => {
                      const TypeIcon = fieldTypeIcons[type];
                      const typeConfig = FIELD_TYPE_CONFIG[type];
                      return (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center gap-2">
                            <TypeIcon className="h-4 w-4" />
                            <span>{typeConfig.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Label */}
              <div className="space-y-2">
                <Label>Label *</Label>
                <Input
                  value={field.label}
                  onChange={(e) => updateField({ label: e.target.value })}
                  placeholder="Enter field label"
                />
              </div>
            </div>

            {/* Placeholder & Help Text */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Placeholder</Label>
                <Input
                  value={field.placeholder || ""}
                  onChange={(e) => updateField({ placeholder: e.target.value })}
                  placeholder="Enter placeholder text"
                />
              </div>
              <div className="space-y-2">
                <Label>Help Text</Label>
                <Input
                  value={field.helpText || ""}
                  onChange={(e) => updateField({ helpText: e.target.value })}
                  placeholder="Additional instructions for this field"
                />
              </div>
            </div>

            {/* Required Toggle */}
            <div className="flex items-center gap-3">
              <Checkbox
                id={`required-${field.id}`}
                checked={field.required}
                onCheckedChange={(checked) =>
                  updateField({ required: checked as boolean })
                }
              />
              <Label htmlFor={`required-${field.id}`} className="cursor-pointer">
                Required field
              </Label>
            </div>

            {/* Quantity / Multiplier */}
            <div className="space-y-2">
              <Label>Duplicate This Field</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={field.quantity || 1}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    updateField({ quantity: isNaN(value) || value < 1 ? 1 : Math.min(value, 20) });
                  }}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">
                  {field.quantity && field.quantity > 1
                    ? `Creates ${field.quantity} fields: "${field.label || "Field"} 1", "${field.label || "Field"} 2", etc.`
                    : "No duplication (single field)"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                When set to more than 1, this field will be duplicated with numbered labels for creators to fill out separately.
              </p>
            </div>

            {/* Rich Content / Examples Section */}
            <RichContentEditor
              richContent={field.richContent}
              onChange={(richContent) => updateField({ richContent })}
            />

            {/* Select Options */}
            {field.type === "select" && (
              <OptionsEditor
                options={field.options || []}
                onChange={(options) => updateField({ options })}
              />
            )}

            {/* File Options */}
            {field.type === "file" && (
              <FileOptionsEditor
                acceptedFileTypes={field.acceptedFileTypes}
                maxFileSize={field.maxFileSize}
                maxFiles={field.maxFiles}
                minFiles={field.minFiles}
                showMaxFileSize={field.showMaxFileSize}
                enforceFileTypes={field.enforceFileTypes}
                enforceMaxFileSize={field.enforceMaxFileSize}
                enforceFileCount={field.enforceFileCount}
                onChange={(updates) => updateField(updates)}
              />
            )}

            {/* Advanced Settings */}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowValidationPanel(true)}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Validation Rules
                {(field.validation?.length ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {field.validation?.length}
                  </Badge>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConditionalPanel(true)}
              >
                {field.conditionalVisibility ? (
                  <Eye className="h-4 w-4 mr-2" />
                ) : (
                  <EyeOff className="h-4 w-4 mr-2" />
                )}
                Conditional Visibility
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Field</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{field.label || "this field"}&quot;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete();
                setShowDeleteConfirm(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validation Panel */}
      <ValidationPanel
        open={showValidationPanel}
        onOpenChange={setShowValidationPanel}
        field={field}
        onChange={(validation) => updateField({ validation })}
      />

      {/* Conditional Visibility Panel */}
      <ConditionalVisibilityPanel
        open={showConditionalPanel}
        onOpenChange={setShowConditionalPanel}
        field={field}
        otherFields={otherFields}
        onChange={(conditionalVisibility) => updateField({ conditionalVisibility })}
      />
    </>
  );
}

// ============================================
// OPTIONS EDITOR (for Select fields)
// ============================================

interface OptionsEditorProps {
  options: SelectOption[];
  onChange: (options: SelectOption[]) => void;
}

function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const addOption = () => {
    const newOption: SelectOption = {
      id: `opt_${Date.now()}`,
      label: `Option ${options.length + 1}`,
      value: `option${options.length + 1}`,
    };
    onChange([...options, newOption]);
  };

  const updateOption = (index: number, updates: Partial<SelectOption>) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], ...updates };
    onChange(newOptions);
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  const moveOption = (from: number, to: number) => {
    const newOptions = [...options];
    const [removed] = newOptions.splice(from, 1);
    newOptions.splice(to, 0, removed);
    onChange(newOptions);
  };

  return (
    <div className="space-y-3">
      <Label>Options</Label>
      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={option.id} className="flex items-center gap-2">
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={index === 0}
                onClick={() => moveOption(index, index - 1)}
              >
                <ChevronDown className="h-3 w-3 rotate-180" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={index === options.length - 1}
                onClick={() => moveOption(index, index + 1)}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
            <Input
              value={option.label}
              onChange={(e) => updateOption(index, { label: e.target.value })}
              placeholder="Label"
              className="flex-1"
            />
            <Input
              value={option.value}
              onChange={(e) => updateOption(index, { value: e.target.value })}
              placeholder="Value"
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => removeOption(index)}
              disabled={options.length <= 1}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={addOption}>
        <Plus className="h-4 w-4 mr-2" />
        Add Option
      </Button>
    </div>
  );
}

// ============================================
// RICH CONTENT EDITOR
// ============================================

export interface RichContentEditorProps {
  richContent?: RichContent;
  onChange: (richContent: RichContent | undefined) => void;
  title?: string; // Optional custom title
  description?: string; // Optional custom description
}

export function RichContentEditor({ richContent, onChange, title, description }: RichContentEditorProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const [uploadingVideo, setUploadingVideo] = React.useState(false);
  const [isDraggingImage, setIsDraggingImage] = React.useState(false);
  const [isDraggingVideo, setIsDraggingVideo] = React.useState(false);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const videoInputRef = React.useRef<HTMLInputElement>(null);
  const imageDragCounter = React.useRef(0);
  const videoDragCounter = React.useRef(0);

  const updateRichContent = (updates: Partial<NonNullable<TemplateField["richContent"]>>) => {
    onChange({
      ...richContent,
      ...updates,
    });
  };

  const addReferenceLink = () => {
    const links = richContent?.referenceLinks || [];
    updateRichContent({
      referenceLinks: [...links, { label: "", url: "" }],
    });
  };

  const updateReferenceLink = (index: number, updates: { label?: string; url?: string }) => {
    const links = [...(richContent?.referenceLinks || [])];
    links[index] = { ...links[index], ...updates };
    updateRichContent({ referenceLinks: links });
  };

  const removeReferenceLink = (index: number) => {
    const links = (richContent?.referenceLinks || []).filter((_, i) => i !== index);
    updateRichContent({ referenceLinks: links });
  };

  const updateExampleImage = (index: number, updates: { url?: string; caption?: string }) => {
    const images = [...(richContent?.exampleImages || [])];
    images[index] = { ...images[index], ...updates };
    updateRichContent({ exampleImages: images });
  };

  const removeExampleImage = (index: number) => {
    const images = (richContent?.exampleImages || []).filter((_, i) => i !== index);
    updateRichContent({ exampleImages: images });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    const newImages: { url: string; caption: string }[] = [];

    try {
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image`);
          continue;
        }

        // Validate file size (max 5MB per image)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 5MB)`);
          continue;
        }

        // Step 1: Get presigned URL from our API
        const presignResponse = await fetch("/api/templates/upload-example", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          }),
        });

        if (!presignResponse.ok) {
          const errorMessage = await parseErrorResponse(presignResponse);
          throw new Error(errorMessage);
        }

        const { uploadUrl, publicUrl } = await presignResponse.json();

        // Step 2: Upload directly to R2/S3 using presigned URL
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.status}`);
        }

        newImages.push({ url: publicUrl, caption: file.name.replace(/\.[^/.]+$/, "") });
      }

      if (newImages.length > 0) {
        // Add all images at once for bulk upload
        const existingImages = richContent?.exampleImages || [];
        updateRichContent({
          exampleImages: [...existingImages, ...newImages],
        });
        toast.success(`${newImages.length} example image(s) added`);
      }
    } catch (error) {
      console.error("Error uploading images:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload images");
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0]; // Only single video for now

    // Validate file type
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Video is too large (max 50MB)");
      return;
    }

    setUploadingVideo(true);
    try {
      // Step 1: Get presigned URL from our API
      const presignResponse = await fetch("/api/templates/upload-example", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      if (!presignResponse.ok) {
        const error = await presignResponse.json();
        throw new Error(error.error || "Upload failed");
      }

      const { uploadUrl, publicUrl } = await presignResponse.json();

      // Step 2: Upload directly to R2/S3 using presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      updateRichContent({ exampleVideoUrl: publicUrl });
      toast.success("Example video added");
    } catch (error) {
      console.error("Error uploading video:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload video");
    } finally {
      setUploadingVideo(false);
      if (videoInputRef.current) {
        videoInputRef.current.value = "";
      }
    }
  };

  // Helper function to handle files for drag and drop
  const handleImageFiles = async (files: FileList | File[]) => {
    setUploadingImage(true);
    const newImages: { url: string; caption: string }[] = [];

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 5MB)`);
          continue;
        }

        // Step 1: Get presigned URL from our API
        const presignResponse = await fetch("/api/templates/upload-example", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          }),
        });

        if (!presignResponse.ok) {
          const errorMessage = await parseErrorResponse(presignResponse);
          throw new Error(errorMessage);
        }

        const { uploadUrl, publicUrl } = await presignResponse.json();

        // Step 2: Upload directly to R2/S3 using presigned URL
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.status}`);
        }

        newImages.push({ url: publicUrl, caption: file.name.replace(/\.[^/.]+$/, "") });
      }

      if (newImages.length > 0) {
        const existingImages = richContent?.exampleImages || [];
        updateRichContent({
          exampleImages: [...existingImages, ...newImages],
        });
        toast.success(`${newImages.length} example image(s) added`);
      }
    } catch (error) {
      console.error("Error uploading images:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload images");
    } finally {
      setUploadingImage(false);
    }
  };

  // Drag and drop handlers for images
  const handleImageDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    imageDragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingImage(true);
    }
  };

  const handleImageDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    imageDragCounter.current--;
    if (imageDragCounter.current === 0) {
      setIsDraggingImage(false);
    }
  };

  const handleImageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleImageDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingImage(false);
    imageDragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleImageFiles(files);
    }
  };

  // Drag and drop handlers for video
  const handleVideoDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    videoDragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingVideo(true);
    }
  };

  const handleVideoDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    videoDragCounter.current--;
    if (videoDragCounter.current === 0) {
      setIsDraggingVideo(false);
    }
  };

  const handleVideoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleVideoDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingVideo(false);
    videoDragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.type.startsWith("video/")) {
        toast.error("Please drop a video file");
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error("Video is too large (max 50MB)");
        return;
      }

      setUploadingVideo(true);
      try {
        // Step 1: Get presigned URL from our API
        const presignResponse = await fetch("/api/templates/upload-example", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          }),
        });

        if (!presignResponse.ok) {
          const errorMessage = await parseErrorResponse(presignResponse);
          throw new Error(errorMessage);
        }

        const { uploadUrl, publicUrl } = await presignResponse.json();

        // Step 2: Upload directly to R2/S3 using presigned URL
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.status}`);
        }

        updateRichContent({ exampleVideoUrl: publicUrl });
        toast.success("Example video added");
      } catch (error) {
        console.error("Error uploading video:", error);
        toast.error(error instanceof Error ? error.message : "Failed to upload video");
      } finally {
        setUploadingVideo(false);
      }
    }
  };

  const hasContent = richContent?.exampleImageUrl || richContent?.exampleVideoUrl ||
    (richContent?.exampleImages && richContent.exampleImages.length > 0) ||
    (richContent?.referenceLinks && richContent.referenceLinks.length > 0);

  return (
    <div className="space-y-3 p-4 rounded-lg bg-muted/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{title || "Rich Content & Examples"}</Label>
          {hasContent && (
            <Badge variant="secondary" className="text-xs">
              Configured
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Collapse" : "Expand"}
          <ChevronDown className={cn("h-4 w-4 ml-1 transition-transform", expanded && "rotate-180")} />
        </Button>
      </div>

      {!expanded && !hasContent && (
        <p className="text-xs text-muted-foreground">
          {description || "Add example images, videos, or reference links to help creators understand what you need."}
        </p>
      )}

      {expanded && (
        <div className="space-y-4 pt-2">
          {/* Example Images - Upload Only (Bulk) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Example Images</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3 mr-1" />
                )}
                Upload Images
              </Button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>

            {/* Example images grid */}
            {richContent?.exampleImages && richContent.exampleImages.length > 0 && (
              <div
                className={cn(
                  "p-3 rounded-lg transition-colors",
                  isDraggingImage ? "bg-primary/10 ring-2 ring-primary ring-dashed" : ""
                )}
                onDragEnter={handleImageDragEnter}
                onDragLeave={handleImageDragLeave}
                onDragOver={handleImageDragOver}
                onDrop={handleImageDrop}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {richContent.exampleImages.map((img, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square rounded-lg border bg-muted overflow-hidden">
                        {img.url ? (
                          <img
                            src={img.url}
                            alt={img.caption || `Example ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeExampleImage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <Input
                        value={img.caption || ""}
                        onChange={(e) => updateExampleImage(index, { caption: e.target.value })}
                        placeholder="Caption"
                        className="mt-1 h-7 text-xs"
                      />
                    </div>
                  ))}
                </div>
                {isDraggingImage && (
                  <div className="mt-3 p-3 border-2 border-dashed border-primary rounded-lg text-center">
                    <Upload className="h-6 w-6 mx-auto text-primary mb-1" />
                    <p className="text-sm text-primary font-medium">Drop to add more images</p>
                  </div>
                )}
              </div>
            )}

            {(!richContent?.exampleImages || richContent.exampleImages.length === 0) && (
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  isDraggingImage
                    ? "border-primary bg-primary/10"
                    : "hover:bg-muted/50"
                )}
                onClick={() => imageInputRef.current?.click()}
                onDragEnter={handleImageDragEnter}
                onDragLeave={handleImageDragLeave}
                onDragOver={handleImageDragOver}
                onDrop={handleImageDrop}
              >
                {uploadingImage ? (
                  <>
                    <Loader2 className="h-8 w-8 mx-auto text-primary mb-2 animate-spin" />
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                  </>
                ) : isDraggingImage ? (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-primary mb-2" />
                    <p className="text-sm text-primary font-medium">Drop images here</p>
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">Drag & drop images here or click to upload</p>
                    <p className="text-xs text-muted-foreground mt-1">You can select multiple images at once</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Example Video - Upload Only */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Example Video</Label>
              {richContent?.exampleVideoUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive h-7"
                  onClick={() => updateRichContent({ exampleVideoUrl: "" })}
                >
                  <X className="h-3 w-3 mr-1" />
                  Remove
                </Button>
              )}
            </div>

            {richContent?.exampleVideoUrl ? (
              <div className="relative rounded-lg border bg-muted overflow-hidden">
                {richContent.exampleVideoUrl.startsWith("data:") ? (
                  <video
                    src={richContent.exampleVideoUrl}
                    controls
                    className="w-full max-h-[200px]"
                  />
                ) : (
                  <div className="p-4 flex items-center gap-3">
                    <Video className="h-8 w-8 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">Video attached</p>
                      <p className="text-xs text-muted-foreground truncate">{richContent.exampleVideoUrl}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  isDraggingVideo
                    ? "border-primary bg-primary/10"
                    : "hover:bg-muted/50"
                )}
                onClick={() => videoInputRef.current?.click()}
                onDragEnter={handleVideoDragEnter}
                onDragLeave={handleVideoDragLeave}
                onDragOver={handleVideoDragOver}
                onDrop={handleVideoDrop}
              >
                {uploadingVideo ? (
                  <>
                    <Loader2 className="h-8 w-8 mx-auto text-primary mb-2 animate-spin" />
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                  </>
                ) : isDraggingVideo ? (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-primary mb-2" />
                    <p className="text-sm text-primary font-medium">Drop video here</p>
                  </>
                ) : (
                  <>
                    <Video className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">Drag & drop video here or click to upload</p>
                    <p className="text-xs text-muted-foreground mt-1">Max 50MB - MP4, WebM, MOV</p>
                  </>
                )}
              </div>
            )}
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleVideoUpload}
            />
          </div>

          {/* Reference Links */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Reference Links</Label>
              <Button variant="outline" size="sm" onClick={addReferenceLink}>
                <Plus className="h-3 w-3 mr-1" />
                Add Link
              </Button>
            </div>
            {richContent?.referenceLinks?.map((link, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  value={link.label}
                  onChange={(e) => updateReferenceLink(index, { label: e.target.value })}
                  placeholder="Link label"
                  className="flex-1"
                />
                <Input
                  value={link.url}
                  onChange={(e) => updateReferenceLink(index, { url: e.target.value })}
                  placeholder="https://..."
                  type="url"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => removeReferenceLink(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {(!richContent?.referenceLinks || richContent.referenceLinks.length === 0) && (
              <p className="text-xs text-muted-foreground">
                Add links to style guides, mood boards, or reference content
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// FILE OPTIONS EDITOR
// ============================================

interface FileOptionsEditorProps {
  acceptedFileTypes?: string[];
  maxFileSize?: number;
  maxFiles?: number;
  minFiles?: number;
  showMaxFileSize?: boolean;
  enforceFileTypes?: boolean;
  enforceMaxFileSize?: boolean;
  enforceFileCount?: boolean;
  onChange: (updates: Partial<TemplateField>) => void;
}

function FileOptionsEditor({
  acceptedFileTypes = ["image/*", "video/*"],
  maxFileSize = 100 * 1024 * 1024,
  maxFiles = 10,
  minFiles = 0,
  showMaxFileSize = true,
  enforceFileTypes = false,
  enforceMaxFileSize = false,
  enforceFileCount = false,
  onChange,
}: FileOptionsEditorProps) {
  const fileSizeInMB = Math.round(maxFileSize / (1024 * 1024));

  return (
    <div className="space-y-4 p-4 rounded-lg bg-muted/50">
      <Label className="text-sm font-medium">File Upload Settings</Label>
      <p className="text-xs text-muted-foreground">
        All restrictions are optional. Enable only the ones you need.
      </p>

      <div className="space-y-4">
        {/* File Types Restriction */}
        <div className="space-y-3 p-3 rounded-lg border bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={enforceFileTypes}
                onCheckedChange={(checked) =>
                  onChange({ enforceFileTypes: checked })
                }
              />
              <Label className="text-sm font-medium cursor-pointer">
                Restrict File Types
              </Label>
            </div>
          </div>
          {enforceFileTypes && (
            <div className="space-y-2 pl-10">
              <Label className="text-xs text-muted-foreground">Allowed Types</Label>
              <div className="flex flex-wrap gap-2">
                {["image/*", "video/*", "application/pdf", ".doc,.docx", "audio/*", ".zip,.rar"].map((type) => (
                  <Badge
                    key={type}
                    variant={acceptedFileTypes.includes(type) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      const newTypes = acceptedFileTypes.includes(type)
                        ? acceptedFileTypes.filter((t) => t !== type)
                        : [...acceptedFileTypes, type];
                      onChange({ acceptedFileTypes: newTypes });
                    }}
                  >
                    {type === "image/*"
                      ? "Images"
                      : type === "video/*"
                      ? "Videos"
                      : type === "application/pdf"
                      ? "PDF"
                      : type === "audio/*"
                      ? "Audio"
                      : type === ".zip,.rar"
                      ? "Archives"
                      : "Documents"}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Max File Size Restriction */}
        <div className="space-y-3 p-3 rounded-lg border bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={enforceMaxFileSize}
                onCheckedChange={(checked) =>
                  onChange({ enforceMaxFileSize: checked })
                }
              />
              <Label className="text-sm font-medium cursor-pointer">
                Limit File Size
              </Label>
            </div>
          </div>
          {enforceMaxFileSize && (
            <div className="space-y-2 pl-10">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  Max Size: {fileSizeInMB} MB
                </Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-max-file-size"
                    checked={showMaxFileSize}
                    onCheckedChange={(checked) =>
                      onChange({ showMaxFileSize: Boolean(checked) })
                    }
                  />
                  <Label htmlFor="show-max-file-size" className="text-xs cursor-pointer">
                    Show limit to creators
                  </Label>
                </div>
              </div>
              <Input
                type="range"
                min={1}
                max={500}
                value={fileSizeInMB}
                onChange={(e) =>
                  onChange({ maxFileSize: parseInt(e.target.value) * 1024 * 1024 })
                }
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 MB</span>
                <span>500 MB</span>
              </div>
            </div>
          )}
        </div>

        {/* File Count Restriction */}
        <div className="space-y-3 p-3 rounded-lg border bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={enforceFileCount}
                onCheckedChange={(checked) =>
                  onChange({ enforceFileCount: checked })
                }
              />
              <Label className="text-sm font-medium cursor-pointer">
                Limit Number of Files
              </Label>
            </div>
          </div>
          {enforceFileCount && (
            <div className="grid gap-4 sm:grid-cols-2 pl-10">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Min Files
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={minFiles || 0}
                  onChange={(e) => onChange({ minFiles: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">0 = no minimum</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Max Files
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={maxFiles || 10}
                  onChange={(e) => onChange({ maxFiles: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// VALIDATION PANEL
// ============================================

interface ValidationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: TemplateField;
  onChange: (validation: ValidationRule[]) => void;
}

function ValidationPanel({
  open,
  onOpenChange,
  field,
  onChange,
}: ValidationPanelProps) {
  const [rules, setRules] = React.useState<ValidationRule[]>(
    field.validation || []
  );

  React.useEffect(() => {
    setRules(field.validation || []);
  }, [field.validation]);

  const addRule = (type: ValidationRule["type"]) => {
    const defaultValues: Record<ValidationRule["type"], ValidationRule> = {
      required: { type: "required", value: true },
      minLength: { type: "minLength", value: 1, message: "" },
      maxLength: { type: "maxLength", value: 100, message: "" },
      min: { type: "min", value: 0, message: "" },
      max: { type: "max", value: 100, message: "" },
      pattern: { type: "pattern", value: "", message: "" },
    };
    setRules([...rules, defaultValues[type]]);
  };

  const updateRule = (index: number, updates: Partial<ValidationRule>) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], ...updates };
    setRules(newRules);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onChange(rules);
    onOpenChange(false);
  };

  const availableRuleTypes: { type: ValidationRule["type"]; label: string }[] = [
    { type: "minLength", label: "Minimum Length" },
    { type: "maxLength", label: "Maximum Length" },
    { type: "min", label: "Minimum Value" },
    { type: "max", label: "Maximum Value" },
    { type: "pattern", label: "Regex Pattern" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Validation Rules</DialogTitle>
          <DialogDescription>
            Add validation rules to ensure data quality for &quot;{field.label}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No validation rules added yet
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex-1 space-y-2">
                    <div className="font-medium text-sm capitalize">
                      {rule.type.replace(/([A-Z])/g, " $1").trim()}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        type={
                          ["minLength", "maxLength", "min", "max"].includes(rule.type)
                            ? "number"
                            : "text"
                        }
                        value={rule.value as string | number}
                        onChange={(e) =>
                          updateRule(index, {
                            value:
                              ["minLength", "maxLength", "min", "max"].includes(
                                rule.type
                              )
                                ? parseInt(e.target.value) || 0
                                : e.target.value,
                          })
                        }
                        placeholder="Value"
                      />
                      <Input
                        value={rule.message || ""}
                        onChange={(e) =>
                          updateRule(index, { message: e.target.value })
                        }
                        placeholder="Error message (optional)"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => removeRule(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {availableRuleTypes.map(({ type, label }) => (
              <Button
                key={type}
                variant="outline"
                size="sm"
                onClick={() => addRule(type)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {label}
              </Button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Rules</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// CONDITIONAL VISIBILITY PANEL
// ============================================

interface ConditionalVisibilityPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: TemplateField;
  otherFields: TemplateField[];
  onChange: (condition: ConditionalVisibility | undefined) => void;
}

function ConditionalVisibilityPanel({
  open,
  onOpenChange,
  field,
  otherFields,
  onChange,
}: ConditionalVisibilityPanelProps) {
  const [condition, setCondition] = React.useState<
    ConditionalVisibility | undefined
  >(field.conditionalVisibility);

  React.useEffect(() => {
    setCondition(field.conditionalVisibility);
  }, [field.conditionalVisibility]);

  const handleSave = () => {
    onChange(condition);
    onOpenChange(false);
  };

  const handleRemove = () => {
    onChange(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Conditional Visibility</DialogTitle>
          <DialogDescription>
            Show &quot;{field.label}&quot; only when certain conditions are met
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {otherFields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Add more fields to set up conditional visibility
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Show this field when</Label>
                <Select
                  value={condition?.fieldId || ""}
                  onValueChange={(value) =>
                    setCondition({
                      fieldId: value,
                      operator: condition?.operator || "equals",
                      value: condition?.value || "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a field" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherFields.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label || "Untitled Field"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Condition</Label>
                <Select
                  value={condition?.operator || "equals"}
                  onValueChange={(value: ConditionalVisibility["operator"]) =>
                    setCondition({
                      fieldId: condition?.fieldId || "",
                      operator: value,
                      value: condition?.value || "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="notEquals">Does not equal</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="greaterThan">Greater than</SelectItem>
                    <SelectItem value="lessThan">Less than</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  value={(condition?.value as string) || ""}
                  onChange={(e) =>
                    setCondition({
                      fieldId: condition?.fieldId || "",
                      operator: condition?.operator || "equals",
                      value: e.target.value,
                    })
                  }
                  placeholder="Enter value to compare"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {condition && (
            <Button variant="destructive" onClick={handleRemove}>
              Remove Condition
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!condition?.fieldId}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// FIELD TYPE PALETTE
// ============================================

interface FieldTypePaletteProps {
  onAddField: (type: FieldType) => void;
}

export function FieldTypePalette({ onAddField }: FieldTypePaletteProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground px-1">
        Add Field
      </h3>
      {/* Mobile: horizontal scroll, compact | Desktop: 2-col grid */}
      <div className="flex gap-2 overflow-x-auto pb-2 lg:grid lg:grid-cols-2 lg:overflow-visible lg:pb-0">
        {(Object.keys(FIELD_TYPE_CONFIG) as FieldType[]).map((type) => {
          const Icon = fieldTypeIcons[type];
          const config = FIELD_TYPE_CONFIG[type];
          return (
            <button
              key={type}
              onClick={() => onAddField(type)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 lg:p-4 rounded-xl border border-border/50",
                "bg-card hover:bg-muted/50 hover:border-border transition-all duration-200",
                "group cursor-pointer shrink-0 min-w-[80px] lg:min-w-0"
              )}
            >
              <div
                className={cn(
                  "h-8 w-8 lg:h-10 lg:w-10 rounded-lg flex items-center justify-center",
                  "bg-muted group-hover:bg-primary/10 transition-colors"
                )}
              >
                <Icon className="h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="text-center">
                <div className="text-xs lg:text-sm font-medium text-foreground">
                  {config.label}
                </div>
                <div className="hidden lg:block text-xs text-muted-foreground">
                  {config.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default FieldEditor;
