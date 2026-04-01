"use client";

import { useState, useEffect, Suspense, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Plus,
  X,
  Save,
  Users,
  User,
  FileText,
  Check,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatusBar } from "@/components/forms/autosave-indicator";
import { RecoveryDialog } from "@/components/forms/recovery-dialog";
import { clearFormData } from "@/lib/form-storage";
import { HelpLabel } from "@/components/help/contextual-help";
import { cn } from "@/lib/utils";
import { TemplateSelector } from "@/components/requests/template-selector";
import { TemplatePreviewCard } from "@/components/templates/template-preview-card";
import type { Template as FullTemplate } from "@/lib/template-types";

// ============================================
// TYPES
// ============================================

interface Creator {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

interface CreatorGroup {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  memberCount: number;
  members: Array<{
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  }>;
}

interface Template {
  id: string;
  name: string;
  description: string;
  fields: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    placeholder?: string;
    helpText?: string;
    options?: Array<{ id: string; label: string; value: string }>;
    defaultValue?: string | number | boolean;
    acceptedFileTypes?: string[];
    maxFileSize?: number;
    maxFiles?: number;
    validation?: Array<{ type: string; value: string | number | boolean; message?: string }>;
  }>;
  defaultDueDays: number;
  defaultUrgency: string;
  _count?: { requests: number };
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CustomField {
  id: string;
  label: string;
  value: string;
  type: string;
  required: boolean;
}

interface RequestFormData {
  creatorId: string;
  groupId: string;
  selectionMode: "individual" | "group";
  templateId: string;
  title: string;
  description: string;
  dueDate: string;
  urgency: string;
  sendNotification: boolean;
  requirements: {
    quantity: string;
    format: string;
    resolution: string;
    notes: string;
  };
  customFields: CustomField[];
  [key: string]: unknown;
}

type SelectionMode = "individual" | "group";
type Step = "template" | "creator" | "details";

// ============================================
// CONSTANTS
// ============================================

const FORM_ID = "new-request-form";

const STEPS: { id: Step; label: string; description: string }[] = [
  { id: "template", label: "Choose Template", description: "Select a request template" },
  { id: "creator", label: "Select Creator", description: "Who will fulfill this request" },
  { id: "details", label: "Request Details", description: "Fill in the specifics" },
];

const RECENT_TEMPLATES_KEY = "uploadportal_recent_templates";
const FAVORITE_TEMPLATES_KEY = "uploadportal_favorite_templates";

// ============================================
// HELPER FUNCTIONS
// ============================================

function getRecentTemplates(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_TEMPLATES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentTemplate(templateId: string) {
  if (typeof window === "undefined") return;
  try {
    const recent = getRecentTemplates();
    const updated = [templateId, ...recent.filter((id) => id !== templateId)].slice(0, 5);
    localStorage.setItem(RECENT_TEMPLATES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

function getFavoriteTemplates(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(FAVORITE_TEMPLATES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function toggleFavoriteTemplate(templateId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const favorites = getFavoriteTemplates();
    const updated = favorites.includes(templateId)
      ? favorites.filter((id) => id !== templateId)
      : [...favorites, templateId];
    localStorage.setItem(FAVORITE_TEMPLATES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

// ============================================
// STEP INDICATOR COMPONENT
// ============================================

interface StepIndicatorProps {
  currentStep: Step;
  completedSteps: Step[];
  onStepClick: (step: Step) => void;
}

function StepIndicator({ currentStep, completedSteps, onStepClick }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((step, index) => {
        const isActive = currentStep === step.id;
        const isCompleted = completedSteps.includes(step.id);
        const canNavigate = isCompleted || STEPS.findIndex((s) => s.id === currentStep) > index;

        return (
          <div key={step.id} className="flex items-center flex-1">
            <button
              onClick={() => canNavigate && onStepClick(step.id)}
              disabled={!canNavigate}
              className={cn(
                "flex items-center gap-3 transition-all duration-200",
                canNavigate && "cursor-pointer hover:opacity-80",
                !canNavigate && "cursor-default"
              )}
            >
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                  isActive && "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30",
                  isCompleted && !isActive && "bg-emerald-500 text-white",
                  !isActive && !isCompleted && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted && !isActive ? (
                  <Check className="h-5 w-5" />
                ) : (
                  index + 1
                )}
              </div>
              <div className="hidden sm:block text-left">
                <p
                  className={cn(
                    "text-sm font-medium transition-colors",
                    isActive && "text-indigo-600 dark:text-indigo-400",
                    isCompleted && !isActive && "text-emerald-600 dark:text-emerald-400",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </button>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-4 rounded transition-colors duration-300",
                  isCompleted
                    ? "bg-gradient-to-r from-emerald-500 to-indigo-500"
                    : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// CREATOR SELECTOR COMPONENT
// ============================================

interface CreatorSelectorProps {
  creators: Creator[];
  groups: CreatorGroup[];
  selectedCreatorId: string;
  selectedGroupId: string;
  selectionMode: SelectionMode;
  onSelectCreator: (creatorId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onSelectionModeChange: (mode: SelectionMode) => void;
  loading: boolean;
}

function CreatorSelectorComponent({
  creators,
  groups,
  selectedCreatorId,
  selectedGroupId,
  selectionMode,
  onSelectCreator,
  onSelectGroup,
  onSelectionModeChange,
  loading,
}: CreatorSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCreators = creators.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  return (
    <div className="space-y-6">
      {/* Selection Mode Toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={selectionMode === "individual" ? "default" : "outline"}
          size="sm"
          onClick={() => onSelectionModeChange("individual")}
          disabled={loading}
          className={selectionMode === "individual" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
        >
          <User className="mr-2 h-4 w-4" />
          Individual Creator
        </Button>
        <Button
          type="button"
          variant={selectionMode === "group" ? "default" : "outline"}
          size="sm"
          onClick={() => onSelectionModeChange("group")}
          disabled={loading || groups.length === 0}
          className={selectionMode === "group" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
        >
          <Users className="mr-2 h-4 w-4" />
          Creator Group
          {groups.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {groups.length}
            </Badge>
          )}
        </Button>
      </div>

      {groups.length === 0 && selectionMode === "individual" && (
        <p className="text-xs text-muted-foreground">
          <Link href="/dashboard/creators/groups" className="text-indigo-600 hover:underline">
            Create groups
          </Link>{" "}
          to send requests to multiple creators at once.
        </p>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Input
          placeholder={selectionMode === "individual" ? "Search creators..." : "Search groups..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Creator Grid */}
      {selectionMode === "individual" ? (
        <div className="space-y-3">
          {filteredCreators.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No creators found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your search terms
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCreators.map((creator) => (
                <CreatorCard
                  key={creator.id}
                  creator={creator}
                  isSelected={selectedCreatorId === creator.id}
                  onSelect={() => onSelectCreator(creator.id)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No groups found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {groups.length === 0 ? (
                  <>
                    <Link href="/dashboard/creators/groups" className="text-indigo-600 hover:underline">
                      Create a group
                    </Link>{" "}
                    to get started
                  </>
                ) : (
                  "Try adjusting your search terms"
                )}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  isSelected={selectedGroupId === group.id}
                  onSelect={() => onSelectGroup(group.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected Group Preview */}
      {selectionMode === "group" && selectedGroup && selectedGroup.memberCount > 0 && (
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 animate-in fade-in-50 duration-300">
          <div className="flex items-center gap-3">
            <AvatarGroup>
              {selectedGroup.members.slice(0, 4).map((member) => (
                <Avatar
                  key={member.id}
                  size="sm"
                  user={{
                    name: member.name,
                    image: member.avatar,
                  }}
                />
              ))}
              {selectedGroup.memberCount > 4 && (
                <AvatarGroupCount count={selectedGroup.memberCount - 4} size="sm" />
              )}
            </AvatarGroup>
            <div>
              <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                {selectedGroup.memberCount} creator{selectedGroup.memberCount !== 1 ? "s" : ""} will receive this request
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400">
                A separate request will be created for each member
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreatorCard({
  creator,
  isSelected,
  onSelect,
}: {
  creator: Creator;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200 w-full",
        "hover:border-indigo-300 hover:shadow-md",
        isSelected && "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20"
      )}
    >
      <div
        className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-colors",
          isSelected
            ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400"
            : "bg-muted text-muted-foreground"
        )}
      >
        <User className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{creator.name}</p>
        <p className="text-sm text-muted-foreground truncate">{creator.email}</p>
      </div>
      {isSelected && (
        <div className="h-6 w-6 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
          <Check className="h-4 w-4 text-white" />
        </div>
      )}
    </button>
  );
}

function GroupCard({
  group,
  isSelected,
  onSelect,
}: {
  group: CreatorGroup;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200 w-full",
        "hover:border-indigo-300 hover:shadow-md",
        isSelected && "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20"
      )}
    >
      <div
        className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: group.color || "#6366f1" }}
      >
        <Users className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{group.name}</p>
        <p className="text-sm text-muted-foreground">
          {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
        </p>
      </div>
      {isSelected && (
        <div className="h-6 w-6 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
          <Check className="h-4 w-4 text-white" />
        </div>
      )}
    </button>
  );
}

// ============================================
// MAIN FORM COMPONENT
// ============================================

function NewRequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCreatorId = searchParams.get("creatorId");
  const preselectedGroupId = searchParams.get("groupId");
  const preselectedTemplateId = searchParams.get("templateId");

  // Determine initial step based on preselections
  const getInitialStep = (): Step => {
    if (preselectedTemplateId && (preselectedCreatorId || preselectedGroupId)) return "details";
    if (preselectedTemplateId) return "creator";
    return "template";
  };

  const getInitialCompletedSteps = (): Step[] => {
    const steps: Step[] = [];
    if (preselectedTemplateId) steps.push("template");
    if (preselectedCreatorId || preselectedGroupId) steps.push("creator");
    return steps;
  };

  // State
  const [currentStep, setCurrentStep] = useState<Step>(getInitialStep);
  const [completedSteps, setCompletedSteps] = useState<Step[]>(getInitialCompletedSteps);
  const [loading, setLoading] = useState(false);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [groups, setGroups] = useState<CreatorGroup[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [recentTemplateIds, setRecentTemplateIds] = useState<string[]>([]);
  const [favoriteTemplateIds, setFavoriteTemplateIds] = useState<string[]>([]);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);

  const [selectionMode, setSelectionMode] = useState<SelectionMode>(
    preselectedGroupId ? "group" : "individual"
  );

  const [formData, setFormData] = useState({
    creatorId: preselectedCreatorId || "",
    groupId: preselectedGroupId || "",
    templateId: preselectedTemplateId || "",
    title: "",
    description: "",
    dueDate: "",
    urgency: "NORMAL",
    sendNotification: true,
  });

  const [requirements, setRequirements] = useState({
    quantity: "",
    format: "",
    resolution: "",
    notes: "",
  });

  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const selectedTemplate = templates.find((t) => t.id === formData.templateId);
  const selectedCreator = creators.find((c) => c.id === formData.creatorId);
  const selectedGroup = groups.find((g) => g.id === formData.groupId);

  const combinedFormData: RequestFormData = useMemo(
    () => ({
      ...formData,
      selectionMode,
      requirements,
      customFields,
    }),
    [formData, selectionMode, requirements, customFields]
  );

  const autosave = useAutosave<RequestFormData>({
    formId: FORM_ID,
    data: combinedFormData,
    debounceMs: 1500,
    enabled: !loadingData,
    onConflict: () => {
      setShowRecoveryDialog(true);
    },
  });

  const handleRestore = () => {
    const recovered = autosave.recover();
    if (recovered) {
      setSelectionMode(recovered.selectionMode || "individual");
      setFormData({
        creatorId: recovered.creatorId || preselectedCreatorId || "",
        groupId: recovered.groupId || preselectedGroupId || "",
        templateId: recovered.templateId || "",
        title: recovered.title || "",
        description: recovered.description || "",
        dueDate: recovered.dueDate || "",
        urgency: recovered.urgency || "NORMAL",
        sendNotification: recovered.sendNotification ?? true,
      });
      setRequirements(recovered.requirements || {
        quantity: "",
        format: "",
        resolution: "",
        notes: "",
      });
      setCustomFields(recovered.customFields || []);

      const newCompletedSteps: Step[] = [];
      if (recovered.templateId) newCompletedSteps.push("template");
      if (recovered.creatorId || recovered.groupId) newCompletedSteps.push("creator");
      setCompletedSteps(newCompletedSteps);

      if ((recovered.templateId) && (recovered.creatorId || recovered.groupId)) {
        setCurrentStep("details");
      } else if (recovered.templateId) {
        setCurrentStep("creator");
      }

      toast.success("Form data restored successfully");
    }
  };

  const handleDiscard = () => {
    autosave.dismissRecovery();
    toast.info("Previous data discarded");
  };

  const applyTemplate = useCallback((template: Template) => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + template.defaultDueDays);

    setFormData((prev) => ({
      ...prev,
      templateId: template.id,
      dueDate: format(dueDate, "yyyy-MM-dd"),
      urgency: template.defaultUrgency,
    }));

    setCustomFields(
      template.fields.map((field) => ({
        id: field.id,
        label: field.label,
        value: field.defaultValue !== undefined ? String(field.defaultValue) : "",
        type: field.type,
        required: field.required,
      }))
    );

    addRecentTemplate(template.id);
    setRecentTemplateIds(getRecentTemplates());
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const [creatorsRes, templatesRes, groupsRes] = await Promise.all([
          fetch("/api/creators"),
          fetch("/api/templates"),
          fetch("/api/creators/groups"),
        ]);

        if (creatorsRes.ok) {
          const creatorsData = await creatorsRes.json();
          // Handle both paginated response and raw array
          setCreators(Array.isArray(creatorsData) ? creatorsData : creatorsData.data || []);
        }
        if (templatesRes.ok) {
          const templatesRaw = await templatesRes.json();
          // Handle both paginated response and raw array
          const templatesData = Array.isArray(templatesRaw) ? templatesRaw : templatesRaw.data || [];
          setTemplates(templatesData);

          if (preselectedTemplateId) {
            const template = templatesData.find((t: Template) => t.id === preselectedTemplateId);
            if (template) {
              applyTemplate(template);
            }
          }
        }
        if (groupsRes.ok) {
          const groupsData = await groupsRes.json();
          // Handle both paginated response and raw array
          setGroups(Array.isArray(groupsData) ? groupsData : groupsData.data || []);
        }

        setRecentTemplateIds(getRecentTemplates());
        setFavoriteTemplateIds(getFavoriteTemplates());
      } catch (error) {
        console.error("Failed to load data:", error);
        toast.error("Failed to load data. Please refresh the page.");
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, [preselectedTemplateId, applyTemplate]);

  const handleTemplateSelect = (template: FullTemplate | null) => {
    if (template) {
      applyTemplate(template as unknown as Template);
      setShowTemplatePreview(true);
    } else {
      setFormData((prev) => ({ ...prev, templateId: "" }));
      setCustomFields([]);
      setShowTemplatePreview(false);
    }
  };

  const handleToggleFavorite = (templateId: string) => {
    const updated = toggleFavoriteTemplate(templateId);
    setFavoriteTemplateIds(updated);
  };

  const handleSelectionModeChange = (mode: SelectionMode) => {
    setSelectionMode(mode);
    if (mode === "individual") {
      setFormData((prev) => ({ ...prev, groupId: "" }));
    } else {
      setFormData((prev) => ({ ...prev, creatorId: "" }));
    }
  };

  const handleCreatorSelect = (creatorId: string) => {
    setFormData((prev) => ({ ...prev, creatorId }));
  };

  const handleGroupSelect = (groupId: string) => {
    setFormData((prev) => ({ ...prev, groupId }));
  };

  const handleNextStep = () => {
    const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCompletedSteps((prev) =>
        prev.includes(currentStep) ? prev : [...prev, currentStep]
      );
      setCurrentStep(STEPS[currentIndex + 1].id);
    }
  };

  const handlePrevStep = () => {
    const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
    }
  };

  const handleStepClick = (step: Step) => {
    setCurrentStep(step);
  };

  const handleChangeTemplate = () => {
    setShowTemplatePreview(false);
    setCurrentStep("template");
    setCompletedSteps((prev) => prev.filter((s) => s !== "template"));
  };

  const canProceedFromTemplate = formData.templateId !== "" || customFields.length > 0;
  const canProceedFromCreator = selectionMode === "individual"
    ? formData.creatorId !== ""
    : formData.groupId !== "";

  const recommendedTemplateIds = (formData.creatorId || formData.groupId)
    ? templates
        .filter((t) => (t._count?.requests || 0) > 0)
        .slice(0, 3)
        .map((t) => t.id)
    : [];

  const addCustomField = () => {
    setCustomFields([
      ...customFields,
      {
        id: `field-${Date.now()}`,
        label: "",
        value: "",
        type: "text",
        required: false,
      },
    ]);
  };

  const removeCustomField = (id: string) => {
    setCustomFields(customFields.filter((f) => f.id !== id));
  };

  const updateCustomField = (id: string, updates: Partial<CustomField>) => {
    setCustomFields(
      customFields.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const handleSubmit = async (e: React.FormEvent, saveAsDraft = false) => {
    e.preventDefault();
    setLoading(true);

    try {
      let creatorIds: string[] = [];

      if (selectionMode === "individual") {
        if (!formData.creatorId) {
          toast.error("Please select a creator");
          setLoading(false);
          return;
        }
        creatorIds = [formData.creatorId];
      } else {
        if (!formData.groupId || !selectedGroup) {
          toast.error("Please select a group");
          setLoading(false);
          return;
        }
        if (selectedGroup.memberCount === 0) {
          toast.error("The selected group has no members");
          setLoading(false);
          return;
        }
        creatorIds = selectedGroup.members.map((m) => m.id);
      }

      const requests = creatorIds.map((creatorId) => ({
        creatorId,
        templateId: formData.templateId || undefined,
        title: formData.title,
        description: formData.description,
        dueDate: formData.dueDate || undefined,
        urgency: formData.urgency,
        requirements,
        fields: customFields,
        saveAsDraft,
        sendNotification: saveAsDraft ? false : formData.sendNotification,
      }));

      const results = await Promise.all(
        requests.map((req) =>
          fetch("/api/requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req),
          }).then((res) => res.json())
        )
      );

      const failedCount = results.filter((r) => r.error).length;
      const successCount = results.length - failedCount;

      if (failedCount > 0 && successCount === 0) {
        toast.error("Failed to create requests");
        setLoading(false);
        return;
      }

      clearFormData(FORM_ID);

      if (failedCount > 0) {
        toast.warning(
          `Created ${successCount} request(s), but ${failedCount} failed`
        );
      } else if (selectionMode === "group") {
        toast.success(
          saveAsDraft
            ? `${successCount} requests saved as draft!`
            : `${successCount} content requests created successfully!`
        );
      } else {
        toast.success(
          saveAsDraft
            ? "Request saved as draft!"
            : "Content request created successfully!"
        );
      }

      if (selectionMode === "group") {
        router.push("/dashboard/requests");
      } else {
        const firstSuccess = results.find((r) => r.id);
        if (firstSuccess) {
          router.push(`/dashboard/requests/${firstSuccess.id}`);
        } else {
          router.push("/dashboard/requests");
        }
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const hasFormData = formData.title || formData.description || formData.creatorId || formData.groupId || customFields.length > 0;

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <RecoveryDialog
        open={showRecoveryDialog}
        onOpenChange={setShowRecoveryDialog}
        data={autosave.recoverableData}
        onRestore={handleRestore}
        onDiscard={handleDiscard}
        formName="content request"
        fieldLabels={{
          creatorId: "Creator",
          groupId: "Group",
          selectionMode: "Selection Mode",
          templateId: "Template",
          title: "Title",
          description: "Description",
          dueDate: "Due Date",
          urgency: "Urgency",
        }}
        excludeFields={["sendNotification"]}
      />

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/requests">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            New Content Request
          </h1>
          <p className="mt-1 text-muted-foreground">
            Request content from a creator using templates
          </p>
        </div>
      </div>

      <StepIndicator
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
      />

      <div className="min-h-[400px]">
        {currentStep === "template" && (
          <div className="space-y-6 animate-in fade-in-50 slide-in-from-right-10 duration-300">
            {showTemplatePreview && selectedTemplate ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Template Preview</h2>
                  <Button variant="outline" size="sm" onClick={handleChangeTemplate}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Change Template
                  </Button>
                </div>
                <TemplatePreviewCard
                  template={selectedTemplate as unknown as FullTemplate}
                  onUseTemplate={handleNextStep}
                  onClose={handleChangeTemplate}
                />
              </div>
            ) : (
              <>
                <TemplateSelector
                  templates={templates as unknown as FullTemplate[]}
                  selectedTemplateId={formData.templateId}
                  onSelectTemplate={handleTemplateSelect}
                  recentTemplateIds={recentTemplateIds}
                  favoriteTemplateIds={favoriteTemplateIds}
                  onToggleFavorite={handleToggleFavorite}
                  recommendedTemplateIds={recommendedTemplateIds}
                />

                <div className="text-center pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">
                    Or create a request without a template
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, templateId: "" }));
                      setCustomFields([]);
                      handleNextStep();
                    }}
                  >
                    Skip Template
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {currentStep === "creator" && (
          <div className="space-y-6 animate-in fade-in-50 slide-in-from-right-10 duration-300">
            {selectedTemplate && (
              <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <p className="font-medium">Using: {selectedTemplate.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedTemplate.fields.length} fields
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleChangeTemplate}>
                      Change
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <CreatorSelectorComponent
              creators={creators}
              groups={groups}
              selectedCreatorId={formData.creatorId}
              selectedGroupId={formData.groupId}
              selectionMode={selectionMode}
              onSelectCreator={handleCreatorSelect}
              onSelectGroup={handleGroupSelect}
              onSelectionModeChange={handleSelectionModeChange}
              loading={loading}
            />
          </div>
        )}

        {currentStep === "details" && (
          <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in-50 slide-in-from-right-10 duration-300">
            <div className="grid gap-4 sm:grid-cols-2">
              {selectedTemplate && (
                <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/10">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Template</p>
                        <p className="font-medium truncate">{selectedTemplate.name}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleChangeTemplate}>
                        Change
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              {(selectedCreator || selectedGroup) && (
                <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/10">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                        {selectionMode === "individual" ? (
                          <User className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        ) : (
                          <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">
                          {selectionMode === "individual" ? "Creator" : "Group"}
                        </p>
                        <p className="font-medium truncate">
                          {selectionMode === "individual"
                            ? selectedCreator?.name
                            : `${selectedGroup?.name} (${selectedGroup?.memberCount} members)`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentStep("creator")}
                      >
                        Change
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Request Details</CardTitle>
                <CardDescription>
                  Provide the details for your content request
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <HelpLabel
                    label="Request Title"
                    helpKey="form.request-title"
                    htmlFor="title"
                    required
                  />
                  <Input
                    id="title"
                    placeholder="e.g., Weekly Feed Content, PPV Bundle, Custom Request"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <HelpLabel
                    label="Description"
                    helpKey="form.request-description"
                    htmlFor="description"
                  />
                  <Textarea
                    id="description"
                    placeholder="Describe what content you need..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                    disabled={loading}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <HelpLabel
                      label="Due Date"
                      helpKey="form.request-due-date"
                      htmlFor="dueDate"
                    />
                    <Input
                      id="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) =>
                        setFormData({ ...formData, dueDate: e.target.value })
                      }
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <HelpLabel
                      label="Urgency"
                      helpKey="form.request-priority"
                      htmlFor="urgency"
                    />
                    <Select
                      value={formData.urgency}
                      onValueChange={(value) =>
                        setFormData({ ...formData, urgency: value })
                      }
                    >
                      <SelectTrigger disabled={loading}>
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

            <Card>
              <CardHeader>
                <CardTitle>Content Requirements</CardTitle>
                <CardDescription>
                  Specify what you need from the creator
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      placeholder="e.g., 10 photos, 3 videos"
                      value={requirements.quantity}
                      onChange={(e) =>
                        setRequirements({ ...requirements, quantity: e.target.value })
                      }
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="format">Format</Label>
                    <Input
                      id="format"
                      placeholder="e.g., JPG, MP4"
                      value={requirements.format}
                      onChange={(e) =>
                        setRequirements({ ...requirements, format: e.target.value })
                      }
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="resolution">Resolution</Label>
                    <Input
                      id="resolution"
                      placeholder="e.g., 1080p, 4K"
                      value={requirements.resolution}
                      onChange={(e) =>
                        setRequirements({ ...requirements, resolution: e.target.value })
                      }
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any specific requirements or notes for the creator..."
                    value={requirements.notes}
                    onChange={(e) =>
                      setRequirements({ ...requirements, notes: e.target.value })
                    }
                    rows={2}
                    disabled={loading}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Custom Fields</CardTitle>
                    <CardDescription>
                      {selectedTemplate
                        ? "Fields from your selected template"
                        : "Add custom fields for the creator to fill out"}
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCustomField}
                    disabled={loading}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Field
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {customFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No custom fields added. Click &quot;Add Field&quot; to add fields like captions, pricing, tags, etc.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {customFields.map((field) => (
                      <div
                        key={field.id}
                        className="flex items-start gap-4 p-4 border rounded-lg"
                      >
                        <div className="flex-1 grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Field Label</Label>
                            <Input
                              placeholder="e.g., Caption, PPV Price"
                              value={field.label}
                              onChange={(e) =>
                                updateCustomField(field.id, { label: e.target.value })
                              }
                              disabled={loading}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Default Value (Optional)</Label>
                            <Input
                              placeholder="Pre-fill value"
                              value={field.value}
                              onChange={(e) =>
                                updateCustomField(field.id, { value: e.target.value })
                              }
                              disabled={loading}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`required-${field.id}`}
                              checked={field.required}
                              onCheckedChange={(checked) =>
                                updateCustomField(field.id, { required: !!checked })
                              }
                              disabled={loading}
                            />
                            <Label htmlFor={`required-${field.id}`} className="text-sm">
                              Required
                            </Label>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCustomField(field.id)}
                            disabled={loading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="sendNotification"
                    checked={formData.sendNotification}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, sendNotification: !!checked })
                    }
                    disabled={loading}
                  />
                  <div>
                    <Label htmlFor="sendNotification" className="font-medium">
                      Send notification to creator{selectionMode === "group" ? "s" : ""}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {selectionMode === "group"
                        ? "All creators in the group will receive an email about this content request"
                        : "The creator will receive an email about this content request"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </form>
        )}
      </div>

      {currentStep !== "details" && (
        <div className="flex items-center justify-between pt-6 border-t">
          <Button
            variant="outline"
            onClick={handlePrevStep}
            disabled={currentStep === "template"}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={handleNextStep}
            disabled={
              (currentStep === "template" && !canProceedFromTemplate && !showTemplatePreview) ||
              (currentStep === "creator" && !canProceedFromCreator)
            }
            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
          >
            Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {currentStep === "details" && (
        <div className="fixed bottom-4 left-0 right-0 px-4 z-40">
          <div className="max-w-4xl mx-auto">
            <SaveStatusBar
              status={autosave.status}
              lastSavedText={autosave.lastSavedText}
              hasChanges={!!hasFormData && autosave.status !== "saved"}
              className="bg-background/95 backdrop-blur-sm"
            >
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep("creator")}
                  disabled={loading}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={(e) => handleSubmit(e as unknown as React.FormEvent, true)}
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Save as Draft
                </Button>
                <Button
                  type="submit"
                  onClick={(e) => handleSubmit(e as unknown as React.FormEvent, false)}
                  disabled={loading}
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {selectionMode === "group" && selectedGroup
                    ? `Create ${selectedGroup.memberCount} Request${selectedGroup.memberCount !== 1 ? "s" : ""}`
                    : "Create Request"}
                </Button>
              </div>
            </SaveStatusBar>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewRequestPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <NewRequestForm />
    </Suspense>
  );
}
