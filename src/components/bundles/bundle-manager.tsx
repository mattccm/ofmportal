"use client";

import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import { formatDistanceToNow, format, addDays } from "date-fns";
import {
  Package,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  Layers,
  Clock,
  CheckCircle,
  XCircle,
  GripVertical,
  Calendar,
  AlertTriangle,
  Zap,
  Users,
  Play,
  Settings2,
  Eye,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  RequestBundle,
  TemplateConfig,
  UrgencyLevel,
  BundlePreviewRequest,
} from "@/types/request-bundles";

// ============================================
// TYPES
// ============================================

interface Template {
  id: string;
  name: string;
  description?: string | null;
  fieldCount: number;
  defaultDueDays: number;
  defaultUrgency: UrgencyLevel;
  isActive: boolean;
}

interface BundleWithTemplates extends RequestBundle {
  templates: Template[];
}

interface BundleManagerProps {
  bundles: BundleWithTemplates[];
  availableTemplates: Template[];
  onCreateBundle: (bundle: Omit<RequestBundle, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdateBundle: (id: string, bundle: Partial<RequestBundle>) => Promise<void>;
  onDeleteBundle: (id: string) => Promise<void>;
  onDuplicateBundle: (id: string) => Promise<void>;
  onExecuteBundle?: (bundleId: string) => void;
  className?: string;
}

// ============================================
// URGENCY CONFIG
// ============================================

const URGENCY_CONFIG: Record<UrgencyLevel, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  LOW: { label: "Low", color: "text-slate-500", icon: Clock },
  NORMAL: { label: "Normal", color: "text-blue-500", icon: Clock },
  HIGH: { label: "High", color: "text-amber-500", icon: AlertTriangle },
  URGENT: { label: "Urgent", color: "text-red-500", icon: Zap },
};

// ============================================
// BUNDLE CARD COMPONENT
// ============================================

interface BundleCardProps {
  bundle: BundleWithTemplates;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExecute?: () => void;
}

function BundleCard({
  bundle,
  onEdit,
  onDuplicate,
  onDelete,
  onExecute,
}: BundleCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      toast.success("Bundle deleted");
      setShowDeleteConfirm(false);
    } catch {
      toast.error("Failed to delete bundle");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-border">
        {/* Bundle Type Indicator */}
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-1 transition-colors",
            bundle.isOnboardingBundle
              ? "bg-gradient-to-r from-violet-500 to-purple-500"
              : "bg-gradient-to-r from-blue-500 to-cyan-500"
          )}
        />

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center transition-colors",
                  bundle.isOnboardingBundle
                    ? "bg-violet-500/10 text-violet-500"
                    : "bg-blue-500/10 text-blue-500"
                )}
              >
                <Package className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base truncate">{bundle.name}</CardTitle>
                {bundle.description && (
                  <CardDescription className="truncate">
                    {bundle.description}
                  </CardDescription>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {bundle.isOnboardingBundle && (
                <Badge
                  variant="secondary"
                  className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800"
                >
                  <Users className="h-3 w-3 mr-1" />
                  Onboarding
                </Badge>
              )}

              {bundle.autoTrigger === "on_creator_create" && (
                <Badge
                  variant="secondary"
                  className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                >
                  <Zap className="h-3 w-3 mr-1" />
                  Auto
                </Badge>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {onExecute && (
                    <>
                      <DropdownMenuItem onClick={onExecute}>
                        <Play className="h-4 w-4 mr-2" />
                        Execute Bundle
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Bundle
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              <span>
                {bundle.templateIds.length} template{bundle.templateIds.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>
                {formatDistanceToNow(new Date(bundle.updatedAt), { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Template Preview */}
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-muted-foreground hover:text-foreground"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <span className="text-xs">View included templates</span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {isExpanded && (
              <div className="space-y-2 pt-2 border-t">
                {bundle.templates.map((template, index) => {
                  const config = bundle.templateConfigs.find(
                    (c) => c.templateId === template.id
                  );
                  const UrgencyIcon = URGENCY_CONFIG[config?.defaultUrgency || template.defaultUrgency].icon;

                  return (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-5">{index + 1}.</span>
                        <span className="font-medium truncate max-w-[200px]">
                          {template.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {(config?.staggerDays || 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />+{config?.staggerDays}d
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <UrgencyIcon className={cn("h-3 w-3", URGENCY_CONFIG[config?.defaultUrgency || template.defaultUrgency].color)} />
                          {config?.defaultDueDays || template.defaultDueDays}d
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        itemName={bundle.name}
        itemType="bundle"
        loading={isDeleting}
        onConfirm={handleDelete}
      />
    </>
  );
}

// ============================================
// BUNDLE EDITOR DIALOG
// ============================================

interface BundleEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundle?: BundleWithTemplates | null;
  availableTemplates: Template[];
  onSave: (bundle: Omit<RequestBundle, "id" | "createdAt" | "updatedAt">) => Promise<void>;
}

function BundleEditor({
  open,
  onOpenChange,
  bundle,
  availableTemplates,
  onSave,
}: BundleEditorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isOnboardingBundle, setIsOnboardingBundle] = useState(false);
  const [autoTrigger, setAutoTrigger] = useState<"on_creator_create" | "manual" | undefined>();
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [templateConfigs, setTemplateConfigs] = useState<TemplateConfig[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Reset form when dialog opens/closes or bundle changes
  React.useEffect(() => {
    if (open) {
      if (bundle) {
        setName(bundle.name);
        setDescription(bundle.description || "");
        setIsOnboardingBundle(bundle.isOnboardingBundle);
        setAutoTrigger(bundle.autoTrigger);
        setSelectedTemplates(bundle.templateIds);
        setTemplateConfigs(bundle.templateConfigs);
      } else {
        setName("");
        setDescription("");
        setIsOnboardingBundle(false);
        setAutoTrigger(undefined);
        setSelectedTemplates([]);
        setTemplateConfigs([]);
      }
    }
  }, [open, bundle]);

  const handleTemplateToggle = (templateId: string, checked: boolean) => {
    if (checked) {
      setSelectedTemplates((prev) => [...prev, templateId]);
      const template = availableTemplates.find((t) => t.id === templateId);
      if (template) {
        setTemplateConfigs((prev) => [
          ...prev,
          {
            templateId,
            defaultDueDays: template.defaultDueDays,
            defaultUrgency: template.defaultUrgency,
            autoAssign: true,
            staggerDays: 0,
          },
        ]);
      }
    } else {
      setSelectedTemplates((prev) => prev.filter((id) => id !== templateId));
      setTemplateConfigs((prev) => prev.filter((c) => c.templateId !== templateId));
    }
  };

  const handleConfigChange = (
    templateId: string,
    field: keyof TemplateConfig,
    value: number | string | boolean | undefined
  ) => {
    setTemplateConfigs((prev) =>
      prev.map((config) =>
        config.templateId === templateId ? { ...config, [field]: value } : config
      )
    );
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const newOrder = [...selectedTemplates];
    const [removed] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, removed);
    setSelectedTemplates(newOrder);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Bundle name is required");
      return;
    }

    if (selectedTemplates.length === 0) {
      toast.error("Select at least one template");
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        templateIds: selectedTemplates,
        templateConfigs,
        isOnboardingBundle,
        autoTrigger,
      });
      toast.success(bundle ? "Bundle updated" : "Bundle created");
      onOpenChange(false);
    } catch {
      toast.error(bundle ? "Failed to update bundle" : "Failed to create bundle");
    } finally {
      setIsSaving(false);
    }
  };

  // Generate preview requests
  const previewRequests = useMemo<BundlePreviewRequest[]>(() => {
    const baseDate = new Date();
    return selectedTemplates.map((templateId) => {
      const template = availableTemplates.find((t) => t.id === templateId);
      const config = templateConfigs.find((c) => c.templateId === templateId);

      if (!template) return null;

      const dueDays = config?.defaultDueDays ?? template.defaultDueDays;
      const staggerDays = config?.staggerDays ?? 0;
      const dueDate = addDays(addDays(baseDate, staggerDays), dueDays);

      return {
        templateId,
        templateName: template.name,
        title: `[Request] ${template.name}`,
        dueDate: format(dueDate, "MMM d, yyyy"),
        dueDays,
        urgency: config?.defaultUrgency ?? template.defaultUrgency,
        staggerDays,
        autoAssign: config?.autoAssign ?? true,
      };
    }).filter(Boolean) as BundlePreviewRequest[];
  }, [selectedTemplates, templateConfigs, availableTemplates]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{bundle ? "Edit Bundle" : "Create Bundle"}</DialogTitle>
          <DialogDescription>
            {bundle
              ? "Modify this bundle's templates and settings"
              : "Create a pre-configured set of templates to quickly create multiple requests"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bundle-name">Bundle Name</Label>
              <Input
                id="bundle-name"
                placeholder="e.g., New Creator Onboarding"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bundle-description">Description (Optional)</Label>
              <Textarea
                id="bundle-description"
                placeholder="Describe what this bundle is for..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Bundle Settings */}
          <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
            <h4 className="font-medium flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Bundle Settings
            </h4>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="onboarding-toggle" className="cursor-pointer">
                  Onboarding Bundle
                </Label>
                <p className="text-xs text-muted-foreground">
                  Show this bundle when onboarding new creators
                </p>
              </div>
              <Switch
                id="onboarding-toggle"
                checked={isOnboardingBundle}
                onCheckedChange={setIsOnboardingBundle}
              />
            </div>

            {isOnboardingBundle && (
              <div className="space-y-2">
                <Label htmlFor="auto-trigger">Auto Trigger</Label>
                <Select
                  value={autoTrigger || "manual"}
                  onValueChange={(v) =>
                    setAutoTrigger(v === "manual" ? undefined : (v as "on_creator_create"))
                  }
                >
                  <SelectTrigger id="auto-trigger">
                    <SelectValue placeholder="Select trigger" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual only</SelectItem>
                    <SelectItem value="on_creator_create">
                      Auto-run on creator creation
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Template Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Templates ({selectedTemplates.length} selected)
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs"
              >
                <Eye className="h-3 w-3 mr-1" />
                {showPreview ? "Hide" : "Show"} Preview
              </Button>
            </div>

            {/* Available Templates */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-lg p-2">
              {availableTemplates.filter((t) => t.isActive).map((template) => {
                const isSelected = selectedTemplates.includes(template.id);
                const config = templateConfigs.find((c) => c.templateId === template.id);
                const selectedIndex = selectedTemplates.indexOf(template.id);

                return (
                  <div
                    key={template.id}
                    className={cn(
                      "rounded-lg border p-3 transition-colors",
                      isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`template-${template.id}`}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleTemplateToggle(template.id, checked as boolean)
                        }
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <span className="text-xs font-medium text-primary">
                              #{selectedIndex + 1}
                            </span>
                          )}
                          <Label
                            htmlFor={`template-${template.id}`}
                            className="font-medium cursor-pointer"
                          >
                            {template.name}
                          </Label>
                        </div>
                        {template.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {template.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{template.fieldCount} fields</span>
                          <span>Due: {template.defaultDueDays} days</span>
                          <span>Urgency: {template.defaultUrgency}</span>
                        </div>

                        {/* Template Config Options */}
                        {isSelected && config && (
                          <div className="mt-3 pt-3 border-t grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Due Days</Label>
                              <Input
                                type="number"
                                min={1}
                                value={config.defaultDueDays ?? template.defaultDueDays}
                                onChange={(e) =>
                                  handleConfigChange(
                                    template.id,
                                    "defaultDueDays",
                                    parseInt(e.target.value) || template.defaultDueDays
                                  )
                                }
                                className="h-8 text-sm"
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Urgency</Label>
                              <Select
                                value={config.defaultUrgency ?? template.defaultUrgency}
                                onValueChange={(v) =>
                                  handleConfigChange(template.id, "defaultUrgency", v as UrgencyLevel)
                                }
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(URGENCY_CONFIG).map(([key, { label }]) => (
                                    <SelectItem key={key} value={key}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Stagger Days</Label>
                              <Input
                                type="number"
                                min={0}
                                value={config.staggerDays ?? 0}
                                onChange={(e) =>
                                  handleConfigChange(
                                    template.id,
                                    "staggerDays",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="h-8 text-sm"
                              />
                            </div>

                            <div className="flex items-end pb-1">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`autoassign-${template.id}`}
                                  checked={config.autoAssign ?? true}
                                  onCheckedChange={(checked) =>
                                    handleConfigChange(template.id, "autoAssign", checked as boolean)
                                  }
                                />
                                <Label htmlFor={`autoassign-${template.id}`} className="text-xs cursor-pointer">
                                  Auto-assign
                                </Label>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Reorder Controls */}
                      {isSelected && selectedTemplates.length > 1 && (
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={selectedIndex === 0}
                            onClick={() => handleReorder(selectedIndex, selectedIndex - 1)}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={selectedIndex === selectedTemplates.length - 1}
                            onClick={() => handleReorder(selectedIndex, selectedIndex + 1)}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {availableTemplates.filter((t) => t.isActive).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No active templates available</p>
                  <p className="text-xs mt-1">Create templates first to add them to bundles</p>
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          {showPreview && previewRequests.length > 0 && (
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <h4 className="font-medium flex items-center gap-2 text-sm">
                <Eye className="h-4 w-4" />
                Preview: Requests to be created
              </h4>
              <p className="text-xs text-muted-foreground">
                Based on today's date as the start date
              </p>

              <div className="space-y-2">
                {previewRequests.map((request, index) => {
                  const UrgencyIcon = URGENCY_CONFIG[request.urgency].icon;
                  return (
                    <div
                      key={request.templateId}
                      className="flex items-center justify-between p-3 rounded-lg bg-background border"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-6">
                          {index + 1}.
                        </span>
                        <div>
                          <p className="font-medium text-sm">{request.templateName}</p>
                          <p className="text-xs text-muted-foreground">
                            {request.staggerDays > 0 && (
                              <span className="mr-2">Creates in {request.staggerDays} day{request.staggerDays !== 1 ? "s" : ""}</span>
                            )}
                            Due: {request.dueDate}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn("text-xs", URGENCY_CONFIG[request.urgency].color)}
                        >
                          <UrgencyIcon className="h-3 w-3 mr-1" />
                          {URGENCY_CONFIG[request.urgency].label}
                        </Badge>
                        {request.autoAssign && (
                          <Badge variant="secondary" className="text-xs">
                            Auto-assign
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : bundle ? "Update Bundle" : "Create Bundle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// EMPTY STATE
// ============================================

function EmptyBundles({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="mx-auto h-20 w-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
        <Package className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">No bundles yet</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
        Create request bundles to quickly send multiple content requests at once.
        Perfect for onboarding new creators.
      </p>
      <Button onClick={onCreateClick} className="mt-6">
        <Plus className="h-4 w-4 mr-2" />
        Create Your First Bundle
      </Button>
    </div>
  );
}

// ============================================
// MAIN BUNDLE MANAGER COMPONENT
// ============================================

export function BundleManager({
  bundles,
  availableTemplates,
  onCreateBundle,
  onUpdateBundle,
  onDeleteBundle,
  onDuplicateBundle,
  onExecuteBundle,
  className,
}: BundleManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "onboarding" | "standard">("all");
  const [showEditor, setShowEditor] = useState(false);
  const [editingBundle, setEditingBundle] = useState<BundleWithTemplates | null>(null);

  // Filter bundles
  const filteredBundles = useMemo(() => {
    return bundles.filter((bundle) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !bundle.name.toLowerCase().includes(query) &&
          !bundle.description?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Type filter
      if (filterType === "onboarding" && !bundle.isOnboardingBundle) return false;
      if (filterType === "standard" && bundle.isOnboardingBundle) return false;

      return true;
    });
  }, [bundles, searchQuery, filterType]);

  const handleCreateClick = () => {
    setEditingBundle(null);
    setShowEditor(true);
  };

  const handleEditClick = (bundle: BundleWithTemplates) => {
    setEditingBundle(bundle);
    setShowEditor(true);
  };

  const handleSave = async (bundleData: Omit<RequestBundle, "id" | "createdAt" | "updatedAt">) => {
    if (editingBundle) {
      await onUpdateBundle(editingBundle.id, bundleData);
    } else {
      await onCreateBundle(bundleData);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search bundles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={filterType}
            onValueChange={(v) => setFilterType(v as typeof filterType)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bundles</SelectItem>
              <SelectItem value="onboarding">Onboarding</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleCreateClick}>
          <Plus className="h-4 w-4 mr-2" />
          New Bundle
        </Button>
      </div>

      {/* Bundle List */}
      {filteredBundles.length === 0 ? (
        bundles.length === 0 ? (
          <EmptyBundles onCreateClick={handleCreateClick} />
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No bundles match your filters</p>
          </div>
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredBundles.map((bundle) => (
            <BundleCard
              key={bundle.id}
              bundle={bundle}
              onEdit={() => handleEditClick(bundle)}
              onDuplicate={() => onDuplicateBundle(bundle.id)}
              onDelete={() => onDeleteBundle(bundle.id)}
              onExecute={onExecuteBundle ? () => onExecuteBundle(bundle.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* Editor Dialog */}
      <BundleEditor
        open={showEditor}
        onOpenChange={setShowEditor}
        bundle={editingBundle}
        availableTemplates={availableTemplates}
        onSave={handleSave}
      />
    </div>
  );
}

export default BundleManager;
