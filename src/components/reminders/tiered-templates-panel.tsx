"use client";

import * as React from "react";
import {
  Plus,
  Loader2,
  Save,
  Trash2,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  Edit2,
  X,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

interface ReminderTemplate {
  id?: string;
  name: string;
  description?: string | null;
  tierType: "UPCOMING" | "DUE_TODAY" | "OVERDUE";
  daysMin: number;
  daysMax?: number | null;
  urgency?: "LOW" | "NORMAL" | "HIGH" | "URGENT" | null;
  emailSubject: string;
  emailBody: string;
  smsBody?: string | null;
  tone: "FRIENDLY" | "NORMAL" | "FIRM" | "URGENT";
  priority: number;
  isActive: boolean;
}

const TIER_CONFIG = {
  UPCOMING: {
    label: "Upcoming",
    icon: Clock,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    description: "Reminders sent before the due date",
  },
  DUE_TODAY: {
    label: "Due Today",
    icon: AlertTriangle,
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    description: "Reminders sent on the due date",
  },
  OVERDUE: {
    label: "Overdue",
    icon: AlertTriangle,
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    description: "Reminders sent after the due date",
  },
};

const TONE_CONFIG = {
  FRIENDLY: { label: "Friendly", description: "Gentle, casual tone" },
  NORMAL: { label: "Normal", description: "Professional, neutral tone" },
  FIRM: { label: "Firm", description: "More assertive, emphasizes deadline" },
  URGENT: { label: "Urgent", description: "Strong urgency, calls for immediate action" },
};

const URGENCY_CONFIG = {
  LOW: { label: "Low", color: "bg-gray-100 text-gray-700" },
  NORMAL: { label: "Normal", color: "bg-blue-100 text-blue-700" },
  HIGH: { label: "High", color: "bg-amber-100 text-amber-700" },
  URGENT: { label: "Urgent", color: "bg-red-100 text-red-700" },
};

const DEFAULT_TEMPLATES: Omit<ReminderTemplate, "id">[] = [
  {
    name: "Upcoming - 7+ days",
    tierType: "UPCOMING",
    daysMin: 7,
    daysMax: null,
    urgency: null,
    emailSubject: "Upcoming deadline for: {{requestTitle}}",
    emailBody: `Hi {{creatorName}},

Just a friendly heads up that your content request "{{requestTitle}}" is due on {{dueDate}}.

You have {{daysUntilDue}} days to complete this request. Take your time to create something great!

View Request: {{portalLink}}

Best,
{{agencyName}}`,
    smsBody: "Hi {{creatorName}}, reminder: {{requestTitle}} is due in {{daysUntilDue}} days. {{portalLink}}",
    tone: "FRIENDLY",
    priority: 0,
    isActive: true,
  },
  {
    name: "Upcoming - 3-6 days",
    tierType: "UPCOMING",
    daysMin: 3,
    daysMax: 6,
    urgency: null,
    emailSubject: "Deadline approaching: {{requestTitle}}",
    emailBody: `Hi {{creatorName}},

Your content request "{{requestTitle}}" is due on {{dueDate}} - that's just {{daysUntilDue}} days away.

Please make sure to submit your content on time.

View Request: {{portalLink}}

Thanks,
{{agencyName}}`,
    smsBody: "{{creatorName}}, {{requestTitle}} is due in {{daysUntilDue}} days. Please submit soon. {{portalLink}}",
    tone: "NORMAL",
    priority: 1,
    isActive: true,
  },
  {
    name: "Upcoming - 1-2 days",
    tierType: "UPCOMING",
    daysMin: 1,
    daysMax: 2,
    urgency: null,
    emailSubject: "Deadline tomorrow: {{requestTitle}}",
    emailBody: `Hi {{creatorName}},

This is an important reminder that "{{requestTitle}}" is due {{#if daysUntilDue == 1}}tomorrow{{else}}in 2 days{{/if}}.

Please submit your content as soon as possible to avoid any delays.

View Request: {{portalLink}}

Thank you,
{{agencyName}}`,
    smsBody: "URGENT: {{requestTitle}} due in {{daysUntilDue}} day(s)! Please submit ASAP. {{portalLink}}",
    tone: "FIRM",
    priority: 2,
    isActive: true,
  },
  {
    name: "Due Today",
    tierType: "DUE_TODAY",
    daysMin: 0,
    daysMax: 0,
    urgency: null,
    emailSubject: "DUE TODAY: {{requestTitle}}",
    emailBody: `Hi {{creatorName}},

"{{requestTitle}}" is DUE TODAY.

Please submit your content immediately to meet the deadline.

View Request: {{portalLink}}

{{agencyName}}`,
    smsBody: "DUE TODAY: {{requestTitle}} - Please submit now! {{portalLink}}",
    tone: "URGENT",
    priority: 10,
    isActive: true,
  },
  {
    name: "Overdue - 1-3 days",
    tierType: "OVERDUE",
    daysMin: 1,
    daysMax: 3,
    urgency: null,
    emailSubject: "OVERDUE: {{requestTitle}}",
    emailBody: `Hi {{creatorName}},

"{{requestTitle}}" was due on {{dueDate}} and is now {{daysOverdue}} day(s) overdue.

Please submit your content immediately.

View Request: {{portalLink}}

{{agencyName}}`,
    smsBody: "OVERDUE: {{requestTitle}} is {{daysOverdue}} days late. Submit immediately! {{portalLink}}",
    tone: "FIRM",
    priority: 20,
    isActive: true,
  },
  {
    name: "Overdue - 4-7 days",
    tierType: "OVERDUE",
    daysMin: 4,
    daysMax: 7,
    urgency: null,
    emailSubject: "URGENT: {{requestTitle}} is severely overdue",
    emailBody: `{{creatorName}},

"{{requestTitle}}" is now {{daysOverdue}} days overdue. This is causing significant delays.

We need your immediate attention on this matter. Please submit your content TODAY or contact us if you're experiencing issues.

View Request: {{portalLink}}

{{agencyName}}`,
    smsBody: "URGENT: {{requestTitle}} is {{daysOverdue}} DAYS LATE. Contact us immediately. {{portalLink}}",
    tone: "URGENT",
    priority: 21,
    isActive: true,
  },
  {
    name: "Overdue - 8+ days",
    tierType: "OVERDUE",
    daysMin: 8,
    daysMax: null,
    urgency: null,
    emailSubject: "CRITICAL: {{requestTitle}} - {{daysOverdue}} days overdue",
    emailBody: `{{creatorName}},

This is a critical notice. "{{requestTitle}}" has been overdue for {{daysOverdue}} days.

Please respond immediately or contact us to discuss this request.

View Request: {{portalLink}}

{{agencyName}}`,
    smsBody: "CRITICAL: {{requestTitle}} {{daysOverdue}} days late. Immediate action required. {{portalLink}}",
    tone: "URGENT",
    priority: 22,
    isActive: true,
  },
];

// ============================================
// TEMPLATE EDITOR COMPONENT
// ============================================

function TemplateEditor({
  template,
  onChange,
  onSave,
  onCancel,
  onDelete,
  isNew,
  isSaving,
}: {
  template: ReminderTemplate;
  onChange: (updates: Partial<ReminderTemplate>) => void;
  onSave: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  isNew?: boolean;
  isSaving?: boolean;
}) {
  const tierConfig = TIER_CONFIG[template.tierType];
  const TierIcon = tierConfig.icon;

  return (
    <Card className="card-elevated">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", tierConfig.color)}>
              <TierIcon className="h-4 w-4" />
            </div>
            <div>
              <Input
                value={template.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="Template name"
                className="font-semibold text-base h-8 px-2 -ml-2"
              />
              <p className="text-xs text-muted-foreground mt-1">{tierConfig.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={template.isActive}
              onCheckedChange={(checked) => onChange({ isActive: checked })}
            />
            <span className="text-sm text-muted-foreground">
              {template.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Timing Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Tier Type</Label>
            <Select
              value={template.tierType}
              onValueChange={(v) => onChange({ tierType: v as ReminderTemplate["tierType"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIER_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <Badge className={config.color}>{config.label}</Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {template.tierType !== "DUE_TODAY" && (
            <>
              <div className="space-y-2">
                <Label>
                  {template.tierType === "UPCOMING" ? "Days before (min)" : "Days overdue (min)"}
                </Label>
                <Input
                  type="number"
                  min={template.tierType === "UPCOMING" ? 1 : 1}
                  value={template.daysMin}
                  onChange={(e) => onChange({ daysMin: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  {template.tierType === "UPCOMING" ? "Days before (max)" : "Days overdue (max)"}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Leave empty for no upper limit
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  type="number"
                  min={template.daysMin}
                  value={template.daysMax ?? ""}
                  onChange={(e) =>
                    onChange({ daysMax: e.target.value ? parseInt(e.target.value) : null })
                  }
                  placeholder="No limit"
                />
              </div>
            </>
          )}
        </div>

        {/* Urgency & Tone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Urgency Filter
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Only apply to requests with this urgency level, or all if empty
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Select
              value={template.urgency ?? "all"}
              onValueChange={(v) => onChange({ urgency: v === "all" ? null : v as ReminderTemplate["urgency"] })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All urgencies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Urgencies</SelectItem>
                {Object.entries(URGENCY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <Badge className={config.color}>{config.label}</Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tone</Label>
            <Select
              value={template.tone}
              onValueChange={(v) => onChange({ tone: v as ReminderTemplate["tone"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TONE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div>
                      <span className="font-medium">{config.label}</span>
                      <span className="text-muted-foreground text-xs ml-2">
                        - {config.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Email Template */}
        <div className="space-y-4 p-4 rounded-lg bg-muted/50">
          <h4 className="font-medium flex items-center gap-2">
            Email Template
          </h4>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={template.emailSubject}
              onChange={(e) => onChange({ emailSubject: e.target.value })}
              placeholder="Email subject line"
            />
          </div>
          <div className="space-y-2">
            <Label>Body</Label>
            <Textarea
              value={template.emailBody}
              onChange={(e) => onChange({ emailBody: e.target.value })}
              placeholder="Email body content"
              rows={8}
              className="font-mono text-sm"
            />
          </div>
        </div>

        {/* SMS Template */}
        <div className="space-y-4 p-4 rounded-lg bg-muted/50">
          <h4 className="font-medium">SMS Template (optional)</h4>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={template.smsBody ?? ""}
              onChange={(e) => onChange({ smsBody: e.target.value || null })}
              placeholder="SMS message (160 characters recommended)"
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {(template.smsBody?.length ?? 0)} characters
            </p>
          </div>
        </div>

        {/* Variable Help */}
        <div className="p-4 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30">
          <h4 className="font-medium text-sm mb-2">Available Variables</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {[
              "{{creatorName}}",
              "{{requestTitle}}",
              "{{dueDate}}",
              "{{daysUntilDue}}",
              "{{daysOverdue}}",
              "{{portalLink}}",
              "{{agencyName}}",
              "{{urgency}}",
            ].map((variable) => (
              <code key={variable} className="bg-muted px-2 py-1 rounded font-mono">
                {variable}
              </code>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onCancel && (
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button onClick={onSave} disabled={isSaving} size="sm">
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isNew ? "Create Template" : "Save Changes"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN PANEL COMPONENT
// ============================================

export function TieredTemplatesPanel() {
  const [templates, setTemplates] = React.useState<ReminderTemplate[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [newTemplate, setNewTemplate] = React.useState<ReminderTemplate | null>(null);
  const [expandedTiers, setExpandedTiers] = React.useState<Set<string>>(
    new Set(["UPCOMING", "DUE_TODAY", "OVERDUE"])
  );

  // Fetch templates on mount
  React.useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      setIsLoading(true);
      const response = await fetch("/api/reminder-templates?includeInactive=true");

      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }

      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Failed to load reminder templates");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveTemplate(template: ReminderTemplate) {
    try {
      setIsSaving(template.id || "new");

      const method = template.id ? "PUT" : "POST";
      const response = await fetch("/api/reminder-templates", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save template");
      }

      const savedTemplate = await response.json();

      if (template.id) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === template.id ? savedTemplate : t))
        );
      } else {
        setTemplates((prev) => [...prev, savedTemplate]);
        setNewTemplate(null);
      }

      toast.success("Template saved successfully");
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save template");
    } finally {
      setIsSaving(null);
    }
  }

  async function deleteTemplate(id: string) {
    try {
      const response = await fetch(`/api/reminder-templates?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete template");
      }

      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template deleted");
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    }
  }

  function updateTemplate(id: string, updates: Partial<ReminderTemplate>) {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }

  function addDefaultTemplates() {
    setNewTemplate(DEFAULT_TEMPLATES[0]);
  }

  function toggleTier(tier: string) {
    setExpandedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) {
        next.delete(tier);
      } else {
        next.add(tier);
      }
      return next;
    });
  }

  const groupedTemplates = React.useMemo(() => {
    const groups: Record<string, ReminderTemplate[]> = {
      UPCOMING: [],
      DUE_TODAY: [],
      OVERDUE: [],
    };

    templates.forEach((t) => {
      if (t.tierType && groups[t.tierType]) {
        groups[t.tierType].push(t);
      }
    });

    // Sort by priority within each group
    Object.values(groups).forEach((group) =>
      group.sort((a, b) => b.priority - a.priority)
    );

    return groups;
  }, [templates]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Tiered Message Templates</h3>
          <p className="text-sm text-muted-foreground">
            Customize reminder messages based on timing relative to the due date
          </p>
        </div>
        <Button onClick={() => setNewTemplate(DEFAULT_TEMPLATES[0])}>
          <Plus className="h-4 w-4 mr-2" />
          Add Template
        </Button>
      </div>

      {/* Info Card */}
      <Card className="card-elevated bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200/50 dark:border-blue-800/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p>
                <strong>How tiered templates work:</strong> When sending a reminder,
                the system finds the most specific matching template based on timing and urgency.
              </p>
              <p className="mt-2">
                Templates with higher priority are matched first. Use different messages for
                different stages: friendly reminders well before due date, firm reminders
                close to deadline, and urgent messages for overdue items.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Template Form */}
      {newTemplate && (
        <div className="animate-fade-in">
          <TemplateEditor
            template={newTemplate}
            onChange={(updates) => setNewTemplate({ ...newTemplate, ...updates })}
            onSave={() => saveTemplate(newTemplate)}
            onCancel={() => setNewTemplate(null)}
            isNew
            isSaving={isSaving === "new"}
          />
        </div>
      )}

      {/* Templates by Tier */}
      {Object.entries(TIER_CONFIG).map(([tierKey, tierConfig]) => {
        const tierTemplates = groupedTemplates[tierKey] || [];
        const TierIcon = tierConfig.icon;
        const isExpanded = expandedTiers.has(tierKey);

        return (
          <Collapsible key={tierKey} open={isExpanded} onOpenChange={() => toggleTier(tierKey)}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", tierConfig.color)}>
                    <TierIcon className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium">{tierConfig.label} Templates</h4>
                    <p className="text-xs text-muted-foreground">{tierConfig.description}</p>
                  </div>
                  <Badge variant="secondary">{tierTemplates.length}</Badge>
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              {tierTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No templates for this tier yet.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      const defaultForTier = DEFAULT_TEMPLATES.find(
                        (t) => t.tierType === tierKey
                      );
                      if (defaultForTier) {
                        setNewTemplate(defaultForTier);
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add {tierConfig.label} Template
                  </Button>
                </div>
              ) : (
                tierTemplates.map((template) => (
                  <TemplateEditor
                    key={template.id}
                    template={template}
                    onChange={(updates) => updateTemplate(template.id!, updates)}
                    onSave={() => saveTemplate(template)}
                    onDelete={() => deleteTemplate(template.id!)}
                    isSaving={isSaving === template.id}
                  />
                ))
              )}
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      {/* Empty State */}
      {templates.length === 0 && !newTemplate && (
        <Card className="card-elevated">
          <CardContent className="p-12">
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-muted mx-auto flex items-center justify-center">
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">No Tiered Templates</h3>
                <p className="text-muted-foreground mt-1">
                  Create templates to customize reminder messages based on timing.
                </p>
              </div>
              <Button onClick={addDefaultTemplates}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default TieredTemplatesPanel;
