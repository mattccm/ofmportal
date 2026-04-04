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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

// ============================================
// TYPES
// ============================================

interface TemplateField {
  id: string;
  label: string;
  value: string;
  type: string;
  required: boolean;
  helpText?: string;
  richContent?: {
    description?: string;
    exampleText?: string;
    exampleImages?: { url: string; caption?: string }[];
    exampleVideoUrl?: string;
    referenceLinks?: { label: string; url: string }[];
  };
  acceptedFileTypes?: string[];
  maxFileSize?: number;
  maxFiles?: number;
  minFiles?: number;
}

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
  requirements: Record<string, string> | null;
  fields: TemplateField[] | null;
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
  const [fields, setFields] = React.useState<TemplateField[]>(request.fields || []);

  // UI state
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Track changes
  React.useEffect(() => {
    const hasFormChanges =
      title !== request.title ||
      description !== (request.description || "") ||
      dueDate !== (request.dueDate ? format(new Date(request.dueDate), "yyyy-MM-dd") : "") ||
      urgency !== request.urgency ||
      status !== request.status ||
      JSON.stringify(fields) !== JSON.stringify(request.fields || []);
    setHasChanges(hasFormChanges);
  }, [title, description, dueDate, urgency, status, fields, request]);

  // Field operations
  const addCustomField = () => {
    setFields([
      ...fields,
      {
        id: `field-${Date.now()}`,
        label: "",
        value: "",
        type: "text",
        required: false,
      },
    ]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const updateField = (id: string, updates: Partial<TemplateField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
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
                Define what information and files you need from the creator
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
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="p-4 border rounded-lg space-y-4 bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium">#{index + 1}</span>
                      <Badge variant="outline" className="text-xs">
                        {field.type}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeField(field.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Field Label</Label>
                      <Input
                        placeholder="e.g., Photo Caption, Content Theme"
                        value={field.label}
                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Field Type</Label>
                      <Select
                        value={field.type}
                        onValueChange={(v) => updateField(field.id, { type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="textarea">Long Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="select">Dropdown</SelectItem>
                          <SelectItem value="checkbox">Checkbox</SelectItem>
                          <SelectItem value="file">File Upload</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {field.type !== "file" && (
                    <div className="space-y-2">
                      <Label>Default Value (Optional)</Label>
                      <Input
                        placeholder="Pre-fill value for creator"
                        value={field.value}
                        onChange={(e) => updateField(field.id, { value: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Help Text / Instructions</Label>
                    <Textarea
                      placeholder="Instructions for the creator about this field..."
                      value={field.helpText || ""}
                      onChange={(e) => updateField(field.id, { helpText: e.target.value })}
                      rows={2}
                      className="text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`required-${field.id}`}
                      checked={field.required}
                      onCheckedChange={(checked) =>
                        updateField(field.id, { required: !!checked })
                      }
                    />
                    <Label htmlFor={`required-${field.id}`} className="text-sm cursor-pointer">
                      Required field
                    </Label>
                  </div>

                  {field.richContent && (
                    <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                      This field has examples/references from the template
                    </div>
                  )}
                </div>
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
