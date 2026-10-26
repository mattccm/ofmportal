"use client";

import * as React from "react";
import { dayKeyOf } from "@/lib/due";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Plus,
  Settings,
  FileText,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "sonner";
import { DueDateField } from "@/components/requests/deadline-picker";
import { FieldEditor, RichContentEditor } from "@/components/templates/field-editor";
import {
  TemplateField as FullTemplateField,
  createEmptyField,
  duplicateField,
  RichContent,
} from "@/lib/template-types";

// TYPES

interface Creator {
  id: string;
  name: string;
  email?: string;
  phone?: string | null;
  avatar?: string | null;
}

interface Request {
  id: string;
  title: string;
  description: string | null;
  status: string;
  urgency: string;
  /** The due day (DATE) everyone sees */
  dueOn?: Date | string | null;
  dueDate: Date | null;
  estimatedMinutes?: number | null;
  createdAt: Date;
  requirements: (Record<string, string> & { _richContent?: RichContent }) | null;
  fields: FullTemplateField[] | null;
  creator: Creator;
  template: {
    id: string;
    name: string;
  } | null;
}

interface RequestEditorProps {
  request: Request;
  onSave?: () => void;
  onCancel?: () => void;
}

// REQUEST EDITOR

export function RequestEditor({ request, onSave, onCancel }: RequestEditorProps) {
  const router = useRouter();

  // Form state
  const [title, setTitle] = React.useState(request.title);
  const [description, setDescription] = React.useState(request.description || "");
  const [dueDate, setDueDate] = React.useState(
    dayKeyOf(request.dueOn) ?? ""
  );
  const [urgency, setUrgency] = React.useState(request.urgency);
  const [estimatedMinutes, setEstimatedMinutes] = React.useState(
    request.estimatedMinutes != null ? String(request.estimatedMinutes) : ""
  );
  const [status, setStatus] = React.useState(request.status);
  const [fields, setFields] = React.useState<FullTemplateField[]>(request.fields || []);
  const [requestRichContent, setRequestRichContent] = React.useState<RichContent>(
    request.requirements?._richContent || {}
  );

  // UI state
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [expandedFields, setExpandedFields] = React.useState<Record<string, boolean>>({});

  // Track changes
  React.useEffect(() => {
    const hasFormChanges =
      title !== request.title ||
      description !== (request.description || "") ||
      dueDate !== (dayKeyOf(request.dueOn) ?? "") ||
      urgency !== request.urgency ||
      estimatedMinutes !== (request.estimatedMinutes != null ? String(request.estimatedMinutes) : "") ||
      status !== request.status ||
      JSON.stringify(fields) !== JSON.stringify(request.fields || []) ||
      JSON.stringify(requestRichContent) !== JSON.stringify(request.requirements?._richContent || {});
    setHasChanges(hasFormChanges);
  }, [title, description, dueDate, urgency, estimatedMinutes, status, fields, requestRichContent, request]);

  // Field operations
  const addCustomField = () => {
    const newField = createEmptyField("text");
    setFields([...fields, newField]);
    setExpandedFields({ ...expandedFields, [newField.id]: true });
  };

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
    const newExpanded = { ...expandedFields };
    delete newExpanded[id];
    setExpandedFields(newExpanded);
  };

  const handleDuplicateField = (id: string) => {
    const field = fields.find((f) => f.id === id);
    if (field) {
      const newField = duplicateField(field);
      const index = fields.findIndex((f) => f.id === id);
      const newFields = [...fields];
      newFields.splice(index + 1, 0, newField);
      setFields(newFields);
      setExpandedFields({ ...expandedFields, [newField.id]: true });
    }
  };

  const updateField = (updatedField: FullTemplateField) => {
    setFields(fields.map((f) => (f.id === updatedField.id ? updatedField : f)));
  };

  const toggleFieldExpanded = (id: string) => {
    setExpandedFields({ ...expandedFields, [id]: !expandedFields[id] });
  };

  // Save
  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          dueDate: dueDate || null,
          urgency,
          estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : null,
          status,
          fields,
          richContent: requestRichContent,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update request");
      }

      toast.success("Changes saved");
      setHasChanges(false);

      if (onSave) {
        onSave();
      } else {
        // Navigate back to detail view
        router.push(`/dashboard/requests/${request.id}`);
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update request");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (!confirm("Leave without saving? Your changes to this request will be lost.")) {
        return;
      }
    }

    if (onCancel) {
      onCancel();
    } else {
      router.push(`/dashboard/requests/${request.id}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button aria-label="Back" variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-[22px] font-bold leading-tight tracking-[-0.01em] sm:text-[26px]">Edit request</h1>
          <p className="text-sm text-muted-foreground">
            Changes show on the creator&apos;s phone as soon as you save. They are not notified.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="bg-raised-hi text-ink hover:bg-raised-hi"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save changes
          </Button>
        </div>
      </div>

      {/* Creator & Template Info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-line dark:border-line bg-tile-hi dark:bg-tile-hi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Avatar
                size="md"
                user={{
                  name: request.creator.name,
                  email: request.creator.email,
                  image: request.creator.avatar,
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Creator</p>
                <p className="font-medium truncate">{request.creator.name}</p>
                <p className="text-xs text-muted-foreground truncate">{request.creator.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {request.template && (
          <Card className="border-line dark:border-line bg-tile-hi dark:bg-tile-hi">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-tile-hi flex items-center justify-center">
                  <FileText className="h-5 w-5 text-foreground dark:text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Template</p>
                  <p className="font-medium truncate">{request.template.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Request title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description / Instructions</Label>
            <WysiwygEditor
              aria-label="Description / Instructions"
              value={description}
              onChange={setDescription}
              placeholder="Add description or instructions for the creator..."
              minHeight="120px"
              maxHeight="300px"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                  <SelectItem value="NEEDS_REVISION">Needs Revision</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-3">
              <p className="text-sm font-medium">Due</p>
              <DueDateField id="dueDate" value={dueDate} onChange={setDueDate} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedMinutes">Time it takes (minutes)</Label>
              <Input
                id="estimatedMinutes"
                type="number"
                min={0}
                step={5}
                placeholder="e.g. 30"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Shown to the creator as a guide for how long this should take.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="urgency">Priority</Label>
              <Select value={urgency} onValueChange={setUrgency}>
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
          </div>
        </CardContent>
      </Card>

      {/* Request-level Examples/Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Examples and references
          </CardTitle>
          <CardDescription>
            Add example images, videos, and reference links to help the creator understand what you need
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RichContentEditor
            richContent={requestRichContent}
            onChange={(rc) => setRequestRichContent(rc || {})}
            title="Examples"
            description="Add examples and references that apply to the entire request"
          />
        </CardContent>
      </Card>

      {/* Fields Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Fields
                <Badge variant="secondary">{fields.length}</Badge>
              </CardTitle>
              <CardDescription>
                Define what information and files you need from the creator. Click a field to expand and add examples.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addCustomField}>
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No fields added yet.</p>
              <p className="text-sm">Click &quot;Add Field&quot; to add fields for this request.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field) => (
                <FieldEditor
                  key={field.id}
                  field={field}
                  allFields={fields}
                  onChange={updateField}
                  onDelete={() => removeField(field.id)}
                  onDuplicate={() => handleDuplicateField(field.id)}
                  isExpanded={!!expandedFields[field.id]}
                  onToggleExpand={() => toggleFieldExpanded(field.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky Save Bar */}
      <div className="fixed bottom-4 left-0 right-0 px-4 z-40">
        <div className="max-w-4xl mx-auto">
          <div className="bg-raised rounded-[var(--tw-r-tile)] shadow-lg p-3 pl-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {hasChanges ? (
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-ink-2" />
                  Not saved yet
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Nothing to save
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="bg-raised-hi text-ink hover:bg-raised-hi"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RequestEditor;
