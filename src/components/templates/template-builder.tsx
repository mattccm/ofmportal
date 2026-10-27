"use client";

import * as React from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Eye,
  EyeOff,
  Copy,
  Trash2,
  AlertTriangle,
  FileText,
  CheckCircle,
  Loader2,
  Undo2,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";
import { HtmlContent } from "@/components/ui/html-content";
import { cn } from "@/lib/utils";
import {
  TemplateField,
  FieldType,
  TemplateFormData,
  RichContent,
  validateTemplateFields,
  createEmptyField,
  duplicateField,
  getDefaultValues,
  isFieldVisible,
  ValidationError,
} from "@/lib/template-types";
import { FieldEditor, FieldTypePalette, RichContentEditor } from "./field-editor";
import { toast } from "sonner";
import { useAutosave } from "@/hooks/use-autosave";
import { AutosaveStatusBadge } from "@/components/forms/autosave-indicator";
import { RecoveryDialog } from "@/components/forms/recovery-dialog";
import { clearFormData } from "@/lib/form-storage";
import { useAccess } from "@/lib/access/client";
import type { MessagingPlan } from "@/lib/messaging";
import { PlanEditor, useAgencyMessaging } from "@/components/messaging/plan-editor";

// TYPES

interface TemplateCategory {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface TemplateBuilderProps {
  initialData?: TemplateFormData & { categoryId?: string | null };
  templateId?: string;
  usageCount?: number;
  onSave: (data: TemplateFormData & { categoryId?: string | null }, isDraft: boolean) => Promise<void>;
  onDuplicate?: () => Promise<void>;
  onDelete?: () => Promise<void>;
}

// SORTABLE FIELD ITEM

interface SortableFieldItemProps {
  field: TemplateField;
  allFields: TemplateField[];
  onChange: (field: TemplateField) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function SortableFieldItem({
  field,
  allFields,
  onChange,
  onDelete,
  onDuplicate,
  isExpanded,
  onToggleExpand,
}: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-50")}
    >
      <FieldEditor
        field={field}
        allFields={allFields}
        onChange={onChange}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

// PREVIEW FIELD

interface PreviewFieldProps {
  field: TemplateField;
  value: unknown;
  onChange: (value: unknown) => void;
}

function PreviewField({ field, value, onChange }: PreviewFieldProps) {
  const renderField = () => {
    switch (field.type) {
      case "text":
        return (
          <Input
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        );
      case "textarea":
        return (
          <Textarea
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={(value as number) ?? ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
            placeholder={field.placeholder}
          />
        );
      case "date":
        return (
          <Input
            type="date"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "select":
        return (
          <Select
            value={(value as string) || ""}
            onValueChange={onChange}
          >
            <SelectTrigger aria-label={field.label || "Select an option"}>
              <SelectValue placeholder={field.placeholder || "Select an option"} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.id} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "checkbox":
        return (
          <div className="flex items-center gap-2">
            <Checkbox aria-label={field.label || "Yes"}
              id={`preview-${field.id}`}
              checked={(value as boolean) || false}
              onCheckedChange={onChange}
            />
            <Label htmlFor={`preview-${field.id}`}>Yes</Label>
          </div>
        );
      case "file":
        return (
          <div className="border-2 border-dashed rounded-lg p-6 text-center bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Drag and drop files here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {field.acceptedFileTypes?.join(", ")} - Max{" "}
              {Math.round((field.maxFileSize || 0) / (1024 * 1024))}MB
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-destructive">*</span>}
      </Label>
      {renderField()}
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
    </div>
  );
}

// TEMPLATE BUILDER

// Generate form ID for autosave
const getTemplateFormId = (templateId?: string) =>
  templateId ? `template-editor-${templateId}` : "template-editor-new";

export function TemplateBuilder({
  initialData,
  templateId,
  usageCount = 0,
  onSave,
  onDuplicate,
  onDelete,
}: TemplateBuilderProps) {
  // Form state
  const [name, setName] = React.useState(initialData?.name || "");
  const [description, setDescription] = React.useState(
    initialData?.description || ""
  );
  const [richContent, setRichContent] = React.useState<RichContent | undefined>(
    initialData?.richContent
  );
  const [fields, setFields] = React.useState<TemplateField[]>(
    initialData?.fields || []
  );
  const [defaultDueDays, setDefaultDueDays] = React.useState(
    initialData?.defaultDueDays || 7
  );
  const [defaultUrgency, setDefaultUrgency] = React.useState<
    "LOW" | "NORMAL" | "HIGH" | "URGENT"
  >(initialData?.defaultUrgency || "NORMAL");
  const [isActive, setIsActive] = React.useState(initialData?.isActive ?? true);
  const [categoryId, setCategoryId] = React.useState<string | null>(
    initialData?.categoryId || null
  );
  // Creator messages for requests made from this template (null = agency defaults)
  const { can } = useAccess();
  const canEditMessaging = can("templates.edit");
  const [messaging, setMessaging] = React.useState<MessagingPlan | null>(initialData?.messaging ?? null);
  const agencyMessaging = useAgencyMessaging(canEditMessaging);
  const [categories, setCategories] = React.useState<TemplateCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = React.useState(true);

  // Fetch categories on mount
  React.useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch("/api/template-categories");
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || []);
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      } finally {
        setCategoriesLoading(false);
      }
    }
    fetchCategories();
  }, []);

  // UI state
  const [isPreviewMode, setIsPreviewMode] = React.useState(false);
  const [expandedFieldId, setExpandedFieldId] = React.useState<string | null>(
    null
  );
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [previewValues, setPreviewValues] = React.useState<
    Record<string, unknown>
  >({});
  const [validationErrors, setValidationErrors] = React.useState<
    ValidationError[]
  >([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = React.useState(false);

  // History for undo
  const [history, setHistory] = React.useState<TemplateField[][]>([]);
  const [historyIndex, setHistoryIndex] = React.useState(-1);

  // Combine all form data for autosave
  const formId = getTemplateFormId(templateId);
  const combinedFormData = React.useMemo(
    () => ({
      name,
      description,
      richContent,
      fields,
      defaultDueDays,
      defaultUrgency,
      isActive,
      categoryId,
      messaging,
    }),
    [name, description, richContent, fields, defaultDueDays, defaultUrgency, isActive, categoryId, messaging]
  );

  // Initialize autosave
  const autosave = useAutosave<TemplateFormData>({
    formId,
    data: combinedFormData,
    debounceMs: 2000,
    enabled: true,
    onConflict: () => {
      setShowRecoveryDialog(true);
    },
  });

  // Handle recovery
  const handleRestore = () => {
    const recovered = autosave.recover();
    if (recovered) {
      setName(recovered.name || "");
      setDescription(recovered.description || "");
      setRichContent(recovered.richContent);
      setFields(recovered.fields || []);
      setDefaultDueDays(recovered.defaultDueDays || 7);
      setDefaultUrgency(recovered.defaultUrgency || "NORMAL");
      setIsActive(recovered.isActive ?? true);
      if (recovered.messaging !== undefined) setMessaging(recovered.messaging ?? null);
      toast.success("Draft restored");
    }
  };

  const handleDiscard = () => {
    autosave.dismissRecovery();
    toast.info("Previous data discarded");
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Reset preview values when fields change
  React.useEffect(() => {
    setPreviewValues(getDefaultValues({ fields }));
  }, [fields]);

  // Track changes
  React.useEffect(() => {
    if (initialData) {
      const hasFormChanges =
        name !== initialData.name ||
        description !== (initialData.description || "") ||
        JSON.stringify(richContent) !== JSON.stringify(initialData.richContent) ||
        defaultDueDays !== initialData.defaultDueDays ||
        defaultUrgency !== initialData.defaultUrgency ||
        isActive !== initialData.isActive ||
        JSON.stringify(messaging) !== JSON.stringify(initialData.messaging ?? null) ||
        JSON.stringify(fields) !== JSON.stringify(initialData.fields);
      setHasChanges(hasFormChanges);
    } else {
      setHasChanges(name !== "" || fields.length > 0);
    }
  }, [name, description, richContent, fields, defaultDueDays, defaultUrgency, isActive, messaging, initialData]);

  // Save to history
  const saveToHistory = (newFields: TemplateField[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(fields);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setFields(newFields);
  };

  // Undo
  const handleUndo = () => {
    if (historyIndex >= 0) {
      setFields(history[historyIndex]);
      setHistoryIndex(historyIndex - 1);
    }
  };

  // Field operations
  const handleAddField = (type: FieldType) => {
    const newField = createEmptyField(type);
    saveToHistory([...fields, newField]);
    setExpandedFieldId(newField.id);
  };

  const handleUpdateField = (updatedField: TemplateField) => {
    saveToHistory(
      fields.map((f) => (f.id === updatedField.id ? updatedField : f))
    );
  };

  const handleDeleteField = (fieldId: string) => {
    saveToHistory(fields.filter((f) => f.id !== fieldId));
    if (expandedFieldId === fieldId) {
      setExpandedFieldId(null);
    }
  };

  const handleDuplicateField = (field: TemplateField) => {
    const newField = duplicateField(field);
    const index = fields.findIndex((f) => f.id === field.id);
    const newFields = [...fields];
    newFields.splice(index + 1, 0, newField);
    saveToHistory(newFields);
    setExpandedFieldId(newField.id);
  };

  // Drag and drop
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);
      saveToHistory(arrayMove(fields, oldIndex, newIndex));
    }

    setActiveId(null);
  };

  // Validation
  const validate = (): boolean => {
    const errors: ValidationError[] = [];

    if (!name.trim()) {
      errors.push({ field: "name", message: "Template name is required" });
    }

    const fieldErrors = validateTemplateFields(fields);
    errors.push(...fieldErrors);

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Save
  const handleSave = async (isDraft: boolean) => {
    if (!isDraft && !validate()) {
      toast.error("Please fix validation errors before publishing");
      return;
    }

    setIsSaving(true);

    try {
      await onSave(
        {
          name,
          description,
          richContent,
          fields,
          defaultDueDays,
          defaultUrgency,
          isActive: isDraft ? false : isActive,
          categoryId,
          // Left out for people who can't edit templates' messages: unchanged
          ...(canEditMessaging ? { messaging } : {}),
        },
        isDraft
      );
      setHasChanges(false);
      // Clear autosaved data on successful save
      clearFormData(formId);
      toast.success(isDraft ? "Draft saved" : "Template published");
    } catch (error) {
      toast.error("Failed to save template");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  // Active field for drag overlay
  const activeField = activeId
    ? fields.find((f) => f.id === activeId)
    : undefined;

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-full">
      {/* Main Builder Area */}
      {/* Recovery Dialog */}
      <RecoveryDialog
        open={showRecoveryDialog}
        onOpenChange={setShowRecoveryDialog}
        data={autosave.recoverableData}
        onRestore={handleRestore}
        onDiscard={handleDiscard}
        formName="template"
        fieldLabels={{
          name: "Template Name",
          description: "Description",
          richContent: "Examples & Reference Materials",
          fields: "Fields",
          defaultDueDays: "Default Due Days",
          defaultUrgency: "Default Urgency",
        }}
      />

      <div className="flex-1 min-w-0 space-y-4 lg:space-y-6 overflow-auto pb-6">
        {/* Header - Responsive layout for mobile */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1
              className={cn(
                "line-clamp-2 font-extrabold leading-none tracking-[-0.035em] [overflow-wrap:anywhere]",
                (name || "").length > 24 ? "text-[30px]" : "text-[38px] sm:text-[44px]",
                !name.trim() && "text-ink-2"
              )}
            >
              {name.trim() || (templateId ? "Untitled template" : "New template")}
            </h1>
            <p className="text-[15px] text-ink">
              {templateId
                ? usageCount > 0
                  ? `Used for ${usageCount} ${usageCount === 1 ? "request" : "requests"}. Changes apply to new requests only.`
                  : "Not used yet. Changes apply the next time you send it."
                : "The fields, due date and priority a request starts from."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Autosave Status - Hidden on mobile to save space */}
            <div className="hidden sm:block">
              <AutosaveStatusBadge
                status={autosave.status}
                lastSavedText={autosave.lastSavedText}
              />
            </div>
            {historyIndex >= 0 && (
              <Button variant="ghost" size="sm" onClick={handleUndo} aria-label="Undo">
                <Undo2 className="h-4 w-4 sm:mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">Undo</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              aria-label={isPreviewMode ? "Edit" : "Preview"}
            >
              {isPreviewMode ? (
                <>
                  <EyeOff className="h-4 w-4 sm:mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Edit</span>
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 sm:mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Preview</span>
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className=" bg-primary hover:bg-primary/90 "
              aria-label={templateId ? "Save template" : "Save and switch on"}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle className="h-4 w-4 sm:mr-2" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{templateId ? "Save template" : "Save and switch on"}</span>
            </Button>
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div role="alert" className="space-y-1 rounded-[var(--tw-r-ctl)] bg-tile px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="size-4 text-late" aria-hidden="true" />
              Before it can be saved:
            </p>
            <ul className="list-none space-y-0.5 text-sm text-late">
              {validationErrors.map((error, index) => (
                <li key={index}>{error.message}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Template Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[17px]">Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Monthly set"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Note to the creator</Label>
              <WysiwygEditor
                aria-label="Note to the creator"
                value={description}
                onChange={setDescription}
                placeholder="Add a description or instructions for creators. This appears at the top of the request form."
                minHeight="80px"
                maxHeight="200px"
              />
              <p className="text-xs text-muted-foreground">
                Shown at the top of every request sent from this template. You can change it per request.
              </p>
            </div>

            {/* Template-Level Rich Content & Examples */}
            <RichContentEditor
              richContent={richContent}
              onChange={setRichContent}
              title="Examples and references"
              description="Example photos, a video or links for the whole request. Field-level examples live on each field."
            />

            {/* Group (stored as the template's category) */}
            {!categoriesLoading && (
              <div className="space-y-2">
                <Label>Group</Label>
                {categories.length > 0 ? (
                  <>
                    <Select
                      value={categoryId || "uncategorized"}
                      onValueChange={(v) => setCategoryId(v === "uncategorized" ? null : v)}
                    >
                      <SelectTrigger aria-label="Group">
                        <SelectValue placeholder="Pick a group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uncategorized">
                          <div className="flex items-center gap-2">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                            Ungrouped
                          </div>
                        </SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              {cat.color && (
                                <div
                                  className="h-3 w-3 rounded-full"
                                  style={{ backgroundColor: cat.color }}
                                />
                              )}
                              {cat.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Groups put templates on their own shelf and decide which team members can use them.{" "}
                      <Link
                        href="/dashboard/templates"
                        target="_blank"
                        className="text-ink underline"
                      >
                        Manage groups
                      </Link>
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No groups yet.{" "}
                    <Link
                      href="/dashboard/templates"
                      target="_blank"
                      className="text-ink underline"
                    >
                      Make a group
                    </Link>{" "}
                    on the Templates page, such as Socials or Monthly sets, to sort your templates onto shelves.
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="due-days">Due after (days)</Label>
                <Input
                  id="due-days"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={defaultDueDays}
                  onChange={(e) => setDefaultDueDays(parseInt(e.target.value) || 7)}
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={defaultUrgency}
                  onValueChange={(v) =>
                    setDefaultUrgency(v as typeof defaultUrgency)
                  }
                >
                  <SelectTrigger aria-label="Priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3 sm:pt-6">
                <Label htmlFor="isActive" className="cursor-pointer flex-col items-start gap-0">
                  Switched on
                  <span className="block text-[13px] font-normal text-ink-2">
                    {isActive ? "Shown on the new-request form" : "Hidden from the new-request form"}
                  </span>
                </Label>
                <Switch aria-label="Switched on"
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={(checked) => setIsActive(!!checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reminders and messages: this template's own plan, or the agency defaults */}
        {canEditMessaging && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[17px]">
                <h2 id="tpl-messages">Reminders and messages</h2>
              </CardTitle>
              <p className="text-sm text-ink-2">
                When creators are reminded about requests made from this template, and whether each message goes by email or text. Requests already sent keep the plan they were sent with.
              </p>
            </CardHeader>
            <CardContent>
              <PlanEditor value={messaging} onChange={setMessaging} agency={agencyMessaging} scope="template" idPrefix="tpl-plan" />
            </CardContent>
          </Card>
        )}

        {/* Fields Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">
              Fields
              <span className="ml-3 text-sm font-normal text-ink-2">
                {fields.length ? `${fields.length} · drag to reorder` : "none yet"}
              </span>
            </h2>
          </div>

          {isPreviewMode ? (
            /* Preview Mode */
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-[22px] font-bold">{name || "Untitled template"}</CardTitle>
                {description && (
                  <HtmlContent
                    html={description}
                    className="text-sm text-muted-foreground"
                  />
                )}
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {fields.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">
                      No fields added yet. Switch to edit mode to add fields.
                    </p>
                  </div>
                ) : (
                  fields
                    .filter((field) => isFieldVisible(field, previewValues))
                    .map((field) => (
                      <PreviewField
                        key={field.id}
                        field={field}
                        value={previewValues[field.id]}
                        onChange={(value) =>
                          setPreviewValues({
                            ...previewValues,
                            [field.id]: value,
                          })
                        }
                      />
                    ))
                )}
              </CardContent>
            </Card>
          ) : (
            /* Edit Mode */
            <>
              {fields.length === 0 ? (
                <div className="rounded-[var(--tw-r-tile)] bg-tile-dim px-5 py-6">
                  <h3 className="font-semibold">No fields yet</h3>
                  <p className="mt-1 max-w-[56ch] text-sm text-ink-2">
                    Each field is one thing the creator sends: a cover photo, a teaser clip, caption ideas.
                    Add one from {""}
                    <span className="lg:hidden">the list above</span>
                    <span className="hidden lg:inline">the list on the right</span>.
                  </p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={fields.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {fields.map((field) => (
                        <SortableFieldItem
                          key={field.id}
                          field={field}
                          allFields={fields}
                          onChange={handleUpdateField}
                          onDelete={() => handleDeleteField(field.id)}
                          onDuplicate={() => handleDuplicateField(field)}
                          isExpanded={expandedFieldId === field.id}
                          onToggleExpand={() =>
                            setExpandedFieldId(
                              expandedFieldId === field.id ? null : field.id
                            )
                          }
                        />
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay>
                    {activeField && (
                      <div className="opacity-80">
                        <FieldEditor
                          field={activeField}
                          allFields={fields}
                          onChange={() => {}}
                          onDelete={() => {}}
                          onDuplicate={() => {}}
                          isExpanded={false}
                          onToggleExpand={() => {}}
                          isDragging
                        />
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>
              )}
            </>
          )}
        </div>

        {/* Template Actions */}
        {templateId && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <div className="flex items-center gap-2">
              {onDuplicate && (
                <Button variant="outline" onClick={onDuplicate}>
                  <Copy className="h-4 w-4 mr-2" />
                  Make a copy
                </Button>
              )}
            </div>
            {onDelete && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete template
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Sidebar - Responsive: full width on mobile, fixed width on desktop */}
      {!isPreviewMode && (
        <div className="w-full lg:w-72 lg:shrink-0 space-y-4 lg:space-y-6 order-first lg:order-last">
          <div className="lg:sticky lg:top-0 space-y-4 lg:space-y-6">
            <FieldTypePalette onAddField={handleAddField} />

            {/* Quick Tips - Hidden on mobile to save space */}
            <div className="hidden space-y-1.5 px-1 text-[13px] text-ink-2 lg:block">
              <p>Drag a field by its handle to move it; with the keyboard, focus the handle and press Space.</p>
              <p>Open a field to set its examples, limits and when it shows.</p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {name || "this template"}?</DialogTitle>
            <DialogDescription>
              {usageCount > 0 ? (
                <>
                  This template is used by {usageCount} content request
                  {usageCount > 1 ? "s" : ""}. Deleting it will not affect
                  existing requests, but you won&apos;t be able to use it for new
                  ones.
                </>
              ) : (
                "It goes for good. Requests already sent are not affected."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete?.();
                setShowDeleteConfirm(false);
              }}
            >
              Delete template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TemplateBuilder;
