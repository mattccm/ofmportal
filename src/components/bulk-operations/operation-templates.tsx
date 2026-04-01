"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Save,
  FolderOpen,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit2,
  Copy,
  Clock,
  Star,
  Users,
  FileCheck,
  RefreshCw,
  Bell,
  Archive,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  type BulkOperationType,
  type BulkOperationTemplate,
  TEMPLATES_STORAGE_KEY,
  createTemplate,
  getOperationTypeLabel,
} from "@/lib/bulk-operations";

interface OperationTemplatesProps {
  operationType: BulkOperationType;
  currentConfig: Record<string, unknown>;
  onLoadTemplate: (config: Record<string, unknown>) => void;
  className?: string;
}

export function OperationTemplates({
  operationType,
  currentConfig,
  onLoadTemplate,
  className,
}: OperationTemplatesProps) {
  const [templates, setTemplates] = useState<BulkOperationTemplate[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BulkOperationTemplate | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Form states for save dialog
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");

  // Load templates from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (stored) {
        const allTemplates: BulkOperationTemplate[] = JSON.parse(stored);
        // Filter to only show templates for this operation type
        setTemplates(allTemplates.filter((t) => t.type === operationType));
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  }, [operationType]);

  // Save templates to localStorage
  const saveToStorage = useCallback((newTemplates: BulkOperationTemplate[]) => {
    try {
      // Get all templates first
      const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      let allTemplates: BulkOperationTemplate[] = stored ? JSON.parse(stored) : [];

      // Remove templates of this type and add new ones
      allTemplates = allTemplates.filter((t) => t.type !== operationType);
      allTemplates = [...allTemplates, ...newTemplates];

      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(allTemplates));
      setTemplates(newTemplates);
    } catch (error) {
      console.error("Failed to save templates:", error);
      toast.error("Failed to save templates");
    }
  }, [operationType]);

  // Save current config as new template
  const handleSaveTemplate = useCallback(() => {
    if (!templateName.trim()) {
      toast.error("Template name is required");
      return;
    }

    const newTemplate = createTemplate(
      templateName.trim(),
      templateDescription.trim(),
      operationType,
      currentConfig
    );

    const updated = [...templates, newTemplate];
    saveToStorage(updated);

    toast.success(`Template "${templateName}" saved`);
    setShowSaveDialog(false);
    setTemplateName("");
    setTemplateDescription("");
  }, [templateName, templateDescription, operationType, currentConfig, templates, saveToStorage]);

  // Update existing template
  const handleUpdateTemplate = useCallback(() => {
    if (!editingTemplate) return;
    if (!templateName.trim()) {
      toast.error("Template name is required");
      return;
    }

    const updated = templates.map((t) =>
      t.id === editingTemplate.id
        ? {
            ...t,
            name: templateName.trim(),
            description: templateDescription.trim(),
            config: currentConfig,
            updatedAt: new Date().toISOString(),
          }
        : t
    );

    saveToStorage(updated);
    toast.success(`Template "${templateName}" updated`);
    setShowSaveDialog(false);
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateDescription("");
  }, [editingTemplate, templateName, templateDescription, currentConfig, templates, saveToStorage]);

  // Load a template
  const handleLoadTemplate = useCallback((template: BulkOperationTemplate) => {
    // Update use count and last used
    const updated = templates.map((t) =>
      t.id === template.id
        ? {
            ...t,
            useCount: t.useCount + 1,
            lastUsedAt: new Date().toISOString(),
          }
        : t
    );
    saveToStorage(updated);

    onLoadTemplate(template.config);
    toast.success(`Loaded template "${template.name}"`);
    setShowLoadDialog(false);
  }, [templates, saveToStorage, onLoadTemplate]);

  // Delete a template
  const handleDeleteTemplate = useCallback(() => {
    if (!deleteTargetId) return;

    const template = templates.find((t) => t.id === deleteTargetId);
    const updated = templates.filter((t) => t.id !== deleteTargetId);
    saveToStorage(updated);

    toast.success(`Template "${template?.name}" deleted`);
    setShowDeleteConfirm(false);
    setDeleteTargetId(null);
  }, [deleteTargetId, templates, saveToStorage]);

  // Duplicate a template
  const handleDuplicateTemplate = useCallback((template: BulkOperationTemplate) => {
    const duplicate = createTemplate(
      `${template.name} (Copy)`,
      template.description,
      template.type,
      template.config
    );

    const updated = [...templates, duplicate];
    saveToStorage(updated);

    toast.success(`Template duplicated`);
  }, [templates, saveToStorage]);

  // Open edit dialog
  const openEditDialog = (template: BulkOperationTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateDescription(template.description);
    setShowSaveDialog(true);
  };

  // Get icon for operation type
  const getTypeIcon = (type: BulkOperationType) => {
    switch (type) {
      case "request_create":
        return <Users className="h-4 w-4" />;
      case "upload_review":
        return <FileCheck className="h-4 w-4" />;
      case "status_update":
        return <RefreshCw className="h-4 w-4" />;
      case "reminder_send":
        return <Bell className="h-4 w-4" />;
      case "archive":
        return <Archive className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn("flex gap-2", className)}>
      {/* Save Template Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setEditingTemplate(null);
          setTemplateName("");
          setTemplateDescription("");
          setShowSaveDialog(true);
        }}
      >
        <Save className="mr-2 h-4 w-4" />
        Save as Template
      </Button>

      {/* Load Template Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowLoadDialog(true)}
        disabled={templates.length === 0}
      >
        <FolderOpen className="mr-2 h-4 w-4" />
        Load Template
        {templates.length > 0 && (
          <Badge variant="secondary" className="ml-2">
            {templates.length}
          </Badge>
        )}
      </Button>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Update Template" : "Save as Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update this template with your current configuration."
                : "Save your current configuration as a reusable template."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name *</Label>
              <Input
                id="templateName"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Weekly Content Review"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="templateDescription">Description</Label>
              <Textarea
                id="templateDescription"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Describe when to use this template..."
                rows={3}
              />
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Current Configuration</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {getTypeIcon(operationType)}
                <span>{getOperationTypeLabel(operationType)}</span>
              </div>
              <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-24">
                {JSON.stringify(currentConfig, null, 2)}
              </pre>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={editingTemplate ? handleUpdateTemplate : handleSaveTemplate}>
              <Save className="mr-2 h-4 w-4" />
              {editingTemplate ? "Update" : "Save"} Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Load Template</DialogTitle>
            <DialogDescription>
              Select a saved template to load its configuration.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3 pr-4">
              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No saved templates</p>
                  <p className="text-sm mt-1">
                    Save your current configuration to create a template.
                  </p>
                </div>
              ) : (
                templates.map((template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleLoadTemplate(template)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(template.type)}
                            <h4 className="font-medium truncate">{template.name}</h4>
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {template.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Created {formatDistanceToNow(new Date(template.createdAt), { addSuffix: true })}
                            </span>
                            {template.useCount > 0 && (
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3" />
                                Used {template.useCount} time(s)
                              </span>
                            )}
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon-sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(template);
                              }}
                            >
                              <Edit2 className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateTemplate(template);
                              }}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTargetId(template.id);
                                setShowDeleteConfirm(true);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoadDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This template will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default OperationTemplates;
