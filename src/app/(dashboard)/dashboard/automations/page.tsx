"use client";

import { useState, useEffect } from "react";
import {
  Zap,
  Plus,
  Search,
  Filter,
  Play,
  Pause,
  Trash2,
  Edit,
  Copy,
  MoreVertical,
  Clock,
  Mail,
  MessageSquare,
  UserPlus,
  Tag,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Calendar,
  FileText,
  Upload,
  Bell,
  Users,
  X,
  ArrowRight,
  Settings,
  Eye,
  TestTube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

type TriggerType = "request_created" | "upload_submitted" | "due_date_approaching" | "status_changed";
type ActionType = "send_notification" | "send_email" | "send_sms" | "assign_team_member" | "update_status" | "add_tag";
type ConditionOperator = "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";

interface Condition {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: string;
}

interface Action {
  id: string;
  type: ActionType;
  config: Record<string, string | number | boolean>;
}

interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: {
    type: TriggerType;
    config: Record<string, string | number>;
  };
  conditions: Condition[];
  actions: Action[];
  isActive: boolean;
  lastTriggered: string | null;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  trigger: {
    type: TriggerType;
    config: Record<string, string | number>;
  };
  conditions: Condition[];
  actions: Action[];
}

// ============================================
// CONSTANTS
// ============================================

const TRIGGER_OPTIONS: { value: TriggerType; label: string; description: string; icon: React.ElementType }[] = [
  { value: "request_created", label: "Request Created", description: "When a new content request is created", icon: FileText },
  { value: "upload_submitted", label: "Upload Submitted", description: "When a creator submits content", icon: Upload },
  { value: "due_date_approaching", label: "Due Date Approaching", description: "When a deadline is coming up", icon: Calendar },
  { value: "status_changed", label: "Status Changed", description: "When a request status changes", icon: RefreshCw },
];

const ACTION_OPTIONS: { value: ActionType; label: string; description: string; icon: React.ElementType }[] = [
  { value: "send_notification", label: "Send Notification", description: "Send in-app notification", icon: Bell },
  { value: "send_email", label: "Send Email", description: "Send email to recipient", icon: Mail },
  { value: "send_sms", label: "Send SMS", description: "Send SMS message", icon: MessageSquare },
  { value: "assign_team_member", label: "Assign Team Member", description: "Auto-assign to team member", icon: UserPlus },
  { value: "update_status", label: "Update Status", description: "Change request status", icon: RefreshCw },
  { value: "add_tag", label: "Add Tag", description: "Add tag to request/upload", icon: Tag },
];

const CONDITION_FIELDS = [
  { value: "creator_name", label: "Creator Name" },
  { value: "creator_email", label: "Creator Email" },
  { value: "template_name", label: "Template Used" },
  { value: "urgency", label: "Urgency Level" },
  { value: "status", label: "Current Status" },
  { value: "days_until_due", label: "Days Until Due" },
  { value: "upload_count", label: "Upload Count" },
];

const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "greater_than", label: "is greater than" },
  { value: "less_than", label: "is less than" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "reminder-2-days",
    name: "Reminder 2 Days Before Due",
    description: "Send a reminder to creators 2 days before the deadline",
    icon: Clock,
    iconColor: "from-amber-500 to-orange-500",
    trigger: { type: "due_date_approaching", config: { daysBefore: 2 } },
    conditions: [],
    actions: [
      { id: "1", type: "send_notification", config: { message: "Reminder: Your content is due in 2 days" } },
      { id: "2", type: "send_email", config: { subject: "Deadline Reminder", template: "deadline_reminder" } },
    ],
  },
  {
    id: "auto-assign-urgent",
    name: "Auto-Assign Urgent Requests",
    description: "Automatically assign urgent requests to a senior team member",
    icon: UserPlus,
    iconColor: "from-red-500 to-rose-500",
    trigger: { type: "request_created", config: {} },
    conditions: [
      { id: "1", field: "urgency", operator: "equals", value: "URGENT" },
    ],
    actions: [
      { id: "1", type: "assign_team_member", config: { role: "ADMIN" } },
      { id: "2", type: "send_notification", config: { message: "Urgent request assigned to you" } },
    ],
  },
  {
    id: "notify-upload",
    name: "Notify on New Upload",
    description: "Send notification when creators upload new content",
    icon: Upload,
    iconColor: "from-emerald-500 to-teal-500",
    trigger: { type: "upload_submitted", config: {} },
    conditions: [],
    actions: [
      { id: "1", type: "send_notification", config: { message: "New content uploaded and ready for review" } },
    ],
  },
  {
    id: "overdue-escalation",
    name: "Overdue Escalation",
    description: "Escalate overdue requests to managers",
    icon: AlertTriangle,
    iconColor: "from-red-500 to-orange-500",
    trigger: { type: "due_date_approaching", config: { daysBefore: -1 } },
    conditions: [
      { id: "1", field: "status", operator: "not_equals", value: "APPROVED" },
    ],
    actions: [
      { id: "1", type: "update_status", config: { status: "NEEDS_REVISION" } },
      { id: "2", type: "add_tag", config: { tag: "overdue" } },
      { id: "3", type: "send_email", config: { subject: "Overdue Content Request", template: "overdue_escalation" } },
    ],
  },
  {
    id: "welcome-new-request",
    name: "Welcome New Requests",
    description: "Send a welcome notification for new requests",
    icon: FileText,
    iconColor: "from-violet-500 to-purple-500",
    trigger: { type: "request_created", config: {} },
    conditions: [],
    actions: [
      { id: "1", type: "send_notification", config: { message: "New content request created successfully" } },
    ],
  },
  {
    id: "status-change-notify",
    name: "Status Change Notifications",
    description: "Notify creators when request status changes",
    icon: RefreshCw,
    iconColor: "from-blue-500 to-cyan-500",
    trigger: { type: "status_changed", config: {} },
    conditions: [],
    actions: [
      { id: "1", type: "send_notification", config: { message: "Request status has been updated" } },
      { id: "2", type: "send_email", config: { subject: "Status Update", template: "status_change" } },
    ],
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function getTriggerInfo(type: TriggerType) {
  return TRIGGER_OPTIONS.find(t => t.value === type) || TRIGGER_OPTIONS[0];
}

function getActionInfo(type: ActionType) {
  return ACTION_OPTIONS.find(a => a.value === type) || ACTION_OPTIONS[0];
}

// ============================================
// COMPONENTS
// ============================================

function AutomationCard({
  automation,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
  onTest,
}: {
  automation: Automation;
  onToggle: (id: string, active: boolean) => void;
  onEdit: (automation: Automation) => void;
  onDelete: (id: string) => void;
  onDuplicate: (automation: Automation) => void;
  onTest: (id: string) => void;
}) {
  const triggerInfo = getTriggerInfo(automation.trigger.type);
  const TriggerIcon = triggerInfo.icon;

  return (
    <Card className={cn(
      "card-elevated transition-all duration-200",
      !automation.isActive && "opacity-60"
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className={cn(
              "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0",
              automation.isActive
                ? "bg-gradient-to-br from-primary to-violet-600 shadow-lg shadow-primary/25"
                : "bg-muted"
            )}>
              <TriggerIcon className={cn(
                "h-6 w-6",
                automation.isActive ? "text-white" : "text-muted-foreground"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground truncate">{automation.name}</h3>
                {automation.isActive ? (
                  <Badge className="badge-success text-xs">Active</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">Paused</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
                {automation.description || triggerInfo.description}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <TriggerIcon className="h-3 w-3 mr-1" />
                  {triggerInfo.label}
                </Badge>
                {automation.conditions.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {automation.conditions.length} condition{automation.conditions.length > 1 ? 's' : ''}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {automation.actions.length} action{automation.actions.length > 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-muted-foreground">Triggered</p>
              <p className="text-sm font-medium">{automation.triggerCount} times</p>
            </div>
            <Switch
              checked={automation.isActive}
              onCheckedChange={(checked) => onToggle(automation.id, checked)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onEdit(automation)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onTest(automation.id)}>
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Run
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(automation)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(automation.id)}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateCard({
  template,
  onSelect
}: {
  template: AutomationTemplate;
  onSelect: (template: AutomationTemplate) => void;
}) {
  const Icon = template.icon;

  return (
    <button
      onClick={() => onSelect(template)}
      className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/50 bg-card hover:bg-muted/30 transition-all duration-200 group"
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg flex-shrink-0",
          template.iconColor
        )}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
            {template.name}
          </h4>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {template.description}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-0.5" />
      </div>
    </button>
  );
}

function ConditionBuilder({
  conditions,
  onChange,
}: {
  conditions: Condition[];
  onChange: (conditions: Condition[]) => void;
}) {
  const addCondition = () => {
    onChange([
      ...conditions,
      { id: generateId(), field: "creator_name", operator: "equals", value: "" },
    ]);
  };

  const updateCondition = (id: string, updates: Partial<Condition>) => {
    onChange(
      conditions.map(c => c.id === id ? { ...c, ...updates } : c)
    );
  };

  const removeCondition = (id: string) => {
    onChange(conditions.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Conditions</Label>
        <Button variant="ghost" size="sm" onClick={addCondition} className="h-8 text-xs">
          <Plus className="h-3 w-3 mr-1" />
          Add Condition
        </Button>
      </div>
      {conditions.length === 0 ? (
        <div className="text-center py-4 text-sm text-muted-foreground rounded-lg border border-dashed">
          No conditions - automation will run for all matching triggers
        </div>
      ) : (
        <div className="space-y-2">
          {conditions.map((condition, index) => (
            <div key={condition.id} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              {index > 0 && (
                <span className="text-xs text-muted-foreground font-medium">AND</span>
              )}
              <Select
                value={condition.field}
                onValueChange={(value) => updateCondition(condition.id, { field: value })}
              >
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_FIELDS.map(field => (
                    <SelectItem key={field.value} value={field.value} className="text-xs">
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={condition.operator}
                onValueChange={(value) => updateCondition(condition.id, { operator: value as ConditionOperator })}
              >
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPERATORS.map(op => (
                    <SelectItem key={op.value} value={op.value} className="text-xs">
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!["is_empty", "is_not_empty"].includes(condition.operator) && (
                <Input
                  value={condition.value}
                  onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                  placeholder="Value"
                  className="flex-1 h-8 text-xs"
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-red-600"
                onClick={() => removeCondition(condition.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionBuilder({
  actions,
  onChange,
}: {
  actions: Action[];
  onChange: (actions: Action[]) => void;
}) {
  const addAction = () => {
    onChange([
      ...actions,
      { id: generateId(), type: "send_notification", config: {} },
    ]);
  };

  const updateAction = (id: string, updates: Partial<Action>) => {
    onChange(
      actions.map(a => a.id === id ? { ...a, ...updates } : a)
    );
  };

  const removeAction = (id: string) => {
    onChange(actions.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Actions</Label>
        <Button variant="ghost" size="sm" onClick={addAction} className="h-8 text-xs">
          <Plus className="h-3 w-3 mr-1" />
          Add Action
        </Button>
      </div>
      {actions.length === 0 ? (
        <div className="text-center py-4 text-sm text-muted-foreground rounded-lg border border-dashed">
          Add at least one action for this automation
        </div>
      ) : (
        <div className="space-y-2">
          {actions.map((action, index) => {
            const actionInfo = getActionInfo(action.type);
            const ActionIcon = actionInfo.icon;

            return (
              <div key={action.id} className="p-3 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium w-6">
                    {index + 1}.
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ActionIcon className="h-4 w-4 text-primary" />
                  </div>
                  <Select
                    value={action.type}
                    onValueChange={(value) => updateAction(action.id, { type: value as ActionType, config: {} })}
                  >
                    <SelectTrigger className="flex-1 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          <div className="flex items-center gap-2">
                            <opt.icon className="h-3 w-3" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-600"
                    onClick={() => removeAction(action.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                {/* Action-specific configuration */}
                {action.type === "send_notification" && (
                  <div className="pl-14">
                    <Input
                      value={String(action.config.message || "")}
                      onChange={(e) => updateAction(action.id, { config: { ...action.config, message: e.target.value } })}
                      placeholder="Notification message..."
                      className="h-8 text-xs"
                    />
                  </div>
                )}
                {action.type === "send_email" && (
                  <div className="pl-14 space-y-2">
                    <Input
                      value={String(action.config.subject || "")}
                      onChange={(e) => updateAction(action.id, { config: { ...action.config, subject: e.target.value } })}
                      placeholder="Email subject..."
                      className="h-8 text-xs"
                    />
                    <Textarea
                      value={String(action.config.body || "")}
                      onChange={(e) => updateAction(action.id, { config: { ...action.config, body: e.target.value } })}
                      placeholder="Email body..."
                      className="text-xs min-h-[60px]"
                    />
                  </div>
                )}
                {action.type === "send_sms" && (
                  <div className="pl-14">
                    <Textarea
                      value={String(action.config.message || "")}
                      onChange={(e) => updateAction(action.id, { config: { ...action.config, message: e.target.value } })}
                      placeholder="SMS message (160 chars max)..."
                      className="text-xs min-h-[60px]"
                      maxLength={160}
                    />
                  </div>
                )}
                {action.type === "update_status" && (
                  <div className="pl-14">
                    <Select
                      value={String(action.config.status || "")}
                      onValueChange={(value) => updateAction(action.id, { config: { ...action.config, status: value } })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING" className="text-xs">Pending</SelectItem>
                        <SelectItem value="IN_PROGRESS" className="text-xs">In Progress</SelectItem>
                        <SelectItem value="UNDER_REVIEW" className="text-xs">Under Review</SelectItem>
                        <SelectItem value="NEEDS_REVISION" className="text-xs">Needs Revision</SelectItem>
                        <SelectItem value="APPROVED" className="text-xs">Approved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {action.type === "add_tag" && (
                  <div className="pl-14">
                    <Input
                      value={String(action.config.tag || "")}
                      onChange={(e) => updateAction(action.id, { config: { ...action.config, tag: e.target.value } })}
                      placeholder="Tag name..."
                      className="h-8 text-xs"
                    />
                  </div>
                )}
                {action.type === "assign_team_member" && (
                  <div className="pl-14">
                    <Select
                      value={String(action.config.role || "")}
                      onValueChange={(value) => updateAction(action.id, { config: { ...action.config, role: value } })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OWNER" className="text-xs">Owner</SelectItem>
                        <SelectItem value="ADMIN" className="text-xs">Admin</SelectItem>
                        <SelectItem value="MANAGER" className="text-xs">Manager</SelectItem>
                        <SelectItem value="MEMBER" className="text-xs">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [filteredAutomations, setFilteredAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTriggerType, setFormTriggerType] = useState<TriggerType>("request_created");
  const [formTriggerConfig, setFormTriggerConfig] = useState<Record<string, string | number>>({});
  const [formConditions, setFormConditions] = useState<Condition[]>([]);
  const [formActions, setFormActions] = useState<Action[]>([]);

  // Fetch automations
  useEffect(() => {
    fetchAutomations();
  }, []);

  // Filter automations
  useEffect(() => {
    let filtered = automations;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(a =>
        statusFilter === "active" ? a.isActive : !a.isActive
      );
    }

    setFilteredAutomations(filtered);
  }, [automations, searchQuery, statusFilter]);

  async function fetchAutomations() {
    try {
      const response = await fetch("/api/automations");
      if (response.ok) {
        const data = await response.json();
        setAutomations(data.automations || []);
      }
    } catch (error) {
      console.error("Error fetching automations:", error);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormName("");
    setFormDescription("");
    setFormTriggerType("request_created");
    setFormTriggerConfig({});
    setFormConditions([]);
    setFormActions([]);
    setEditingAutomation(null);
  }

  function openCreateDialog() {
    resetForm();
    setShowCreateDialog(true);
  }

  function openEditDialog(automation: Automation) {
    setFormName(automation.name);
    setFormDescription(automation.description);
    setFormTriggerType(automation.trigger.type);
    setFormTriggerConfig(automation.trigger.config);
    setFormConditions(automation.conditions);
    setFormActions(automation.actions);
    setEditingAutomation(automation);
    setShowCreateDialog(true);
  }

  function handleTemplateSelect(template: AutomationTemplate) {
    setFormName(template.name);
    setFormDescription(template.description);
    setFormTriggerType(template.trigger.type);
    setFormTriggerConfig(template.trigger.config);
    setFormConditions(template.conditions);
    setFormActions(template.actions);
    setShowTemplatesDialog(false);
    setShowCreateDialog(true);
  }

  async function handleSave() {
    const automationData = {
      name: formName,
      description: formDescription,
      trigger: {
        type: formTriggerType,
        config: formTriggerConfig,
      },
      conditions: formConditions,
      actions: formActions,
    };

    try {
      let response;
      if (editingAutomation) {
        response = await fetch(`/api/automations/${editingAutomation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(automationData),
        });
      } else {
        response = await fetch("/api/automations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(automationData),
        });
      }

      if (response.ok) {
        await fetchAutomations();
        setShowCreateDialog(false);
        resetForm();
      }
    } catch (error) {
      console.error("Error saving automation:", error);
    }
  }

  async function handleToggle(id: string, active: boolean) {
    try {
      const response = await fetch(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: active }),
      });

      if (response.ok) {
        setAutomations(automations.map(a =>
          a.id === id ? { ...a, isActive: active } : a
        ));
      }
    } catch (error) {
      console.error("Error toggling automation:", error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this automation?")) return;

    try {
      const response = await fetch(`/api/automations/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setAutomations(automations.filter(a => a.id !== id));
      }
    } catch (error) {
      console.error("Error deleting automation:", error);
    }
  }

  function handleDuplicate(automation: Automation) {
    setFormName(`${automation.name} (Copy)`);
    setFormDescription(automation.description);
    setFormTriggerType(automation.trigger.type);
    setFormTriggerConfig(automation.trigger.config);
    setFormConditions(automation.conditions.map(c => ({ ...c, id: generateId() })));
    setFormActions(automation.actions.map(a => ({ ...a, id: generateId() })));
    setEditingAutomation(null);
    setShowCreateDialog(true);
  }

  async function handleTest(id: string) {
    setTestingId(id);
    setTestResult(null);

    try {
      const response = await fetch(`/api/automations/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });

      const data = await response.json();
      setTestResult({
        success: response.ok,
        message: data.message || (response.ok ? "Test completed successfully" : "Test failed"),
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: "Failed to run test",
      });
    }

    setTimeout(() => {
      setTestingId(null);
      setTestResult(null);
    }, 3000);
  }

  const activeCount = automations.filter(a => a.isActive).length;
  const totalTriggers = automations.reduce((sum, a) => sum + a.triggerCount, 0);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Sparkles className="h-4 w-4" />
            <span>Workflow Automation</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Automations
          </h1>
          <p className="text-muted-foreground mt-1">
            Create automated workflows to streamline your content operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowTemplatesDialog(true)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Templates
          </Button>
          <Button
            onClick={openCreateDialog}
            className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Automation
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{automations.length}</p>
              <p className="text-sm text-muted-foreground">Total Automations</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Play className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-sm text-muted-foreground">Active Automations</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <RefreshCw className="h-6 w-6 text-violet-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalTriggers}</p>
              <p className="text-sm text-muted-foreground">Total Triggers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search automations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Test Result Toast */}
      {testResult && (
        <div className={cn(
          "fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-lg border animate-in slide-in-from-bottom-4",
          testResult.success
            ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800"
            : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
        )}>
          <div className="flex items-center gap-3">
            {testResult.success ? (
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
            <p className={cn(
              "text-sm font-medium",
              testResult.success ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
            )}>
              {testResult.message}
            </p>
          </div>
        </div>
      )}

      {/* Automations List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-muted rounded" />
                    <div className="h-3 w-64 bg-muted rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAutomations.length === 0 ? (
        <Card className="card-elevated">
          <CardContent className="py-16 text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No automations yet</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              Create your first automation to streamline repetitive tasks and save time.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowTemplatesDialog(true)}>
                <FileText className="h-4 w-4 mr-2" />
                Browse Templates
              </Button>
              <Button onClick={openCreateDialog} className="btn-gradient">
                <Plus className="h-4 w-4 mr-2" />
                Create Automation
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAutomations.map(automation => (
            <AutomationCard
              key={automation.id}
              automation={automation}
              onToggle={handleToggle}
              onEdit={openEditDialog}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onTest={handleTest}
            />
          ))}
        </div>
      )}

      {/* Templates Dialog */}
      <Dialog open={showTemplatesDialog} onOpenChange={setShowTemplatesDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Automation Templates
            </DialogTitle>
            <DialogDescription>
              Start with a pre-built template and customize it to your needs
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 mt-4">
            {AUTOMATION_TEMPLATES.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={handleTemplateSelect}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {editingAutomation ? "Edit Automation" : "Create Automation"}
            </DialogTitle>
            <DialogDescription>
              {editingAutomation
                ? "Update your automation workflow"
                : "Build a new automated workflow for your content operations"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Reminder 2 Days Before Due"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe what this automation does..."
                  className="min-h-[60px]"
                />
              </div>
            </div>

            {/* Trigger */}
            <div className="space-y-3">
              <Label>Trigger</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {TRIGGER_OPTIONS.map(trigger => {
                  const Icon = trigger.icon;
                  const isSelected = formTriggerType === trigger.value;
                  return (
                    <button
                      key={trigger.value}
                      type="button"
                      onClick={() => setFormTriggerType(trigger.value)}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-xl border text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        isSelected ? "bg-primary text-white" : "bg-muted"
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-medium text-sm",
                          isSelected ? "text-primary" : "text-foreground"
                        )}>
                          {trigger.label}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {trigger.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Trigger-specific config */}
              {formTriggerType === "due_date_approaching" && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <Label className="text-xs">Days before due date</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="number"
                      value={formTriggerConfig.daysBefore ?? 2}
                      onChange={(e) => setFormTriggerConfig({ ...formTriggerConfig, daysBefore: parseInt(e.target.value) })}
                      className="w-24 h-8 text-sm"
                      min={-30}
                      max={30}
                    />
                    <span className="text-sm text-muted-foreground">
                      (negative = after due date)
                    </span>
                  </div>
                </div>
              )}

              {formTriggerType === "status_changed" && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <Label className="text-xs">From status (optional)</Label>
                  <Select
                    value={String(formTriggerConfig.fromStatus || "")}
                    onValueChange={(v) => setFormTriggerConfig({ ...formTriggerConfig, fromStatus: v })}
                  >
                    <SelectTrigger className="h-8 text-xs mt-2">
                      <SelectValue placeholder="Any status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" className="text-xs">Any status</SelectItem>
                      <SelectItem value="PENDING" className="text-xs">Pending</SelectItem>
                      <SelectItem value="IN_PROGRESS" className="text-xs">In Progress</SelectItem>
                      <SelectItem value="SUBMITTED" className="text-xs">Submitted</SelectItem>
                      <SelectItem value="UNDER_REVIEW" className="text-xs">Under Review</SelectItem>
                      <SelectItem value="NEEDS_REVISION" className="text-xs">Needs Revision</SelectItem>
                    </SelectContent>
                  </Select>
                  <Label className="text-xs mt-3 block">To status (optional)</Label>
                  <Select
                    value={String(formTriggerConfig.toStatus || "")}
                    onValueChange={(v) => setFormTriggerConfig({ ...formTriggerConfig, toStatus: v })}
                  >
                    <SelectTrigger className="h-8 text-xs mt-2">
                      <SelectValue placeholder="Any status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" className="text-xs">Any status</SelectItem>
                      <SelectItem value="PENDING" className="text-xs">Pending</SelectItem>
                      <SelectItem value="IN_PROGRESS" className="text-xs">In Progress</SelectItem>
                      <SelectItem value="SUBMITTED" className="text-xs">Submitted</SelectItem>
                      <SelectItem value="UNDER_REVIEW" className="text-xs">Under Review</SelectItem>
                      <SelectItem value="NEEDS_REVISION" className="text-xs">Needs Revision</SelectItem>
                      <SelectItem value="APPROVED" className="text-xs">Approved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Conditions */}
            <ConditionBuilder
              conditions={formConditions}
              onChange={setFormConditions}
            />

            {/* Actions */}
            <ActionBuilder
              actions={formActions}
              onChange={setFormActions}
            />
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formName || formActions.length === 0}
              className="btn-gradient"
            >
              {editingAutomation ? "Save Changes" : "Create Automation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
