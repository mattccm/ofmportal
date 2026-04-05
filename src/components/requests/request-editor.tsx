"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Plus,
  X,
  Settings,
  FileText,
  Calendar,
  User,
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
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { FieldEditor, RichContentEditor } from "@/components/templates/field-editor";
import {
  TemplateField as FullTemplateField,
  createEmptyField,
  duplicateField,
  RichContent,
} from "@/lib/template-types";

// ============================================
// TYPES
// ============================================

interface Creator {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
}

interface Request {
  id: string;
  title: string;
  description: string | null;
  status: string;
  urgency: string;
  dueDate: Date | null;
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

// ============================================
// REQUEST EDITOR
// ============================================

export function RequestEditor({ request, onSave, onCancel }: RequestEditorProps) {
  const router = useRouter();

  // Form state
  const [title, setTitle] = React.useState(request.title);
  const [description, setDescription] = React.useState(request.description || "");
  const [dueDate, setDueDate] = React.useState(
    request.dueDate ? format(new Date(request.dueDate), "yyyy-MM-dd") : ""
  );
  const [urgency, setUrgency] = React.useState(request.urgency);
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
      dueDate !== (request.dueDate ? format(new Date(request.dueDate), "yyyy-MM-dd") : "") ||
      urgency !== request.urgency ||
      status !== request.status ||
      JSON.stringify(fields) !== JSON.stringify(request.fields || []) ||
      JSON.stringify(requestRichContent) !== JSON.stringify(request.requirements?._richContent || {});
    setHasChanges(hasFormChanges);
  }, [title, description, dueDate, urgency, status, fields, requestRichContent, request]);

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
          status,
          fields,
          richContent: requestRichContent,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update request");
      }

      toast.success("Request updated successfully");
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
      if (!confirm("You have unsaved changes. Are you sure you want to discard them?")) {
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
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Edit Request</h1>
          <p className="text-sm text-muted-foreground">
            Modify the request details and fields
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Creator & Template Info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/10">
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
          <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/10">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
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

      {/* Request Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Request Details
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
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="urgency">Urgency</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger>
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
            Request Examples & References
          </CardTitle>
          <CardDescription>
            Add example images, videos, and reference links to help the creator understand what you need
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RichContentEditor
            richContent={requestRichContent}
            onChange={(rc) => setRequestRichContent(rc || {})}
            title="Request Examples"
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
                Request Fields
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
          <div className="bg-background/95 backdrop-blur-sm border rounded-xl shadow-lg p-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {hasChanges ? (
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  You have unsaved changes
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  All changes saved
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
                className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RequestEditor;
