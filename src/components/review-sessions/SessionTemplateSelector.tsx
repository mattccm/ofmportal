"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Save,
  Trash2,
  Edit,
  MoreVertical,
  Clock,
  User,
  Settings,
  Plus,
  Check,
} from "lucide-react";
import {
  SessionTemplate,
  ReviewSessionSettings,
  CreateSessionTemplateRequest,
} from "@/types/review-session";
import { formatDistanceToNow } from "date-fns";

interface SessionTemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: SessionTemplate) => void;
  currentSettings?: ReviewSessionSettings;
  selectedUploadIds?: string[];
  selectedParticipantIds?: string[];
}

interface TemplateWithMeta extends SessionTemplate {
  createdByName?: string;
}

export function SessionTemplateSelector({
  isOpen,
  onClose,
  onSelectTemplate,
  currentSettings,
  selectedUploadIds,
  selectedParticipantIds,
}: SessionTemplateSelectorProps) {
  const [templates, setTemplates] = useState<TemplateWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Demo user
  const userId = "user_demo";
  const agencyId = "agency_demo";

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/review-sessions/templates", {
        headers: {
          "x-user-id": userId,
          "x-agency-id": agencyId,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error("Error fetching templates:", err);
      setError("Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      return;
    }

    setSavingTemplate(true);
    try {
      const templateRequest: CreateSessionTemplateRequest = {
        name: newTemplateName.trim(),
        description: newTemplateDescription.trim() || undefined,
        settings: currentSettings || {},
        defaultParticipantIds: selectedParticipantIds,
      };

      const response = await fetch("/api/review-sessions/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
          "x-agency-id": agencyId,
        },
        body: JSON.stringify(templateRequest),
      });

      if (!response.ok) {
        throw new Error("Failed to save template");
      }

      const data = await response.json();
      setTemplates([data.template, ...templates]);
      setShowSaveDialog(false);
      setNewTemplateName("");
      setNewTemplateDescription("");
    } catch (err) {
      console.error("Error saving template:", err);
      setError("Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/review-sessions/templates/${templateId}`, {
        method: "DELETE",
        headers: {
          "x-user-id": userId,
          "x-agency-id": agencyId,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete template");
      }

      setTemplates(templates.filter((t) => t.id !== templateId));
    } catch (err) {
      console.error("Error deleting template:", err);
      setError("Failed to delete template");
    }
  };

  const handleSelectTemplate = (template: TemplateWithMeta) => {
    setSelectedTemplateId(template.id);
    onSelectTemplate(template);
  };

  const getSettingsSummary = (settings: ReviewSessionSettings) => {
    const features: string[] = [];
    if (settings.allowChat) features.push("Chat");
    if (settings.allowVoiceNotes) features.push("Voice Notes");
    if (settings.allowAnnotations) features.push("Annotations");
    if (settings.autoAdvance) features.push("Auto-advance");
    if (settings.onlyHostCanNavigate) features.push("Host-controlled");
    return features;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Session Templates
            </DialogTitle>
            <DialogDescription>
              Use saved templates to quickly configure review sessions with your preferred settings.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                {error}
                <Button variant="link" onClick={fetchTemplates} className="ml-2">
                  Retry
                </Button>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No Templates Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Save your current session settings as a template for quick reuse.
                </p>
                {currentSettings && (
                  <Button onClick={() => setShowSaveDialog(true)} className="gap-2">
                    <Save className="h-4 w-4" />
                    Save Current Settings
                  </Button>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-4">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={`flex items-start gap-3 p-3 border rounded-lg hover:border-primary/50 cursor-pointer transition-colors ${
                        selectedTemplateId === template.id ? "border-primary bg-primary/5" : ""
                      }`}
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Settings className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{template.name}</h4>
                          {selectedTemplateId === template.id && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {template.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {getSettingsSummary(template.settings).map((feature) => (
                            <Badge key={feature} variant="secondary" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {template.createdByName || "Unknown"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(template.updatedAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="flex-shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectTemplate(template);
                            }}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Use Template
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(template.id);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <DialogFooter className="flex-row justify-between">
            {currentSettings && templates.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Save Current Settings
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={onClose}
                disabled={!selectedTemplateId}
              >
                Apply Template
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              Save as Template
            </DialogTitle>
            <DialogDescription>
              Save your current session configuration for quick reuse.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name *</Label>
              <Input
                id="template-name"
                placeholder="e.g., Weekly Review Settings"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-description">Description (optional)</Label>
              <Textarea
                id="template-description"
                placeholder="Describe what this template is for..."
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                rows={2}
              />
            </div>

            {currentSettings && (
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="text-sm font-medium mb-2">Settings to Save:</h4>
                <div className="flex flex-wrap gap-1">
                  {getSettingsSummary(currentSettings).map((feature) => (
                    <Badge key={feature} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                  {getSettingsSummary(currentSettings).length === 0 && (
                    <span className="text-xs text-muted-foreground">Default settings</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={!newTemplateName.trim() || savingTemplate}
              className="gap-2"
            >
              {savingTemplate ? (
                "Saving..."
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SessionTemplateSelector;
