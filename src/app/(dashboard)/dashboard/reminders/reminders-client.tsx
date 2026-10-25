"use client";

import Link from "next/link";

import { useState, useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Bell,
  Plus,
  Search,
  Mail,
  MessageSquare,
  Calendar,
  Clock,
  Send,
  X,
  Trash2,
  Edit,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// TYPES

interface ReminderTemplate {
  id: string;
  agencyId: string;
  name: string;
  daysBefore: number[];
  escalateDaysOverdue: number | null;
  sendEmail: boolean;
  sendSms: boolean;
  emailSubject: string | null;
  emailBody: string | null;
  smsBody: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface Reminder {
  id: string;
  requestId: string;
  type: "UPCOMING" | "DUE_TODAY" | "OVERDUE" | "ESCALATION";
  channel: "EMAIL" | "SMS";
  scheduledAt: Date | string;
  sentAt: Date | string | null;
  status: "PENDING" | "SENT" | "FAILED";
  error: string | null;
  createdAt: Date | string;
  request: {
    id: string;
    title: string;
    dueDate: Date | string | null;
    status: string;
    creator: {
      id: string;
      name: string;
      email: string;
    };
  };
}

interface Creator {
  id: string;
  name: string;
  email: string;
}

interface RemindersClientProps {
  initialTemplates: ReminderTemplate[];
  initialReminders: Reminder[];
  creators: Creator[];
  agencySettings: Record<string, unknown>;
}

// TEMPLATE VARIABLES HELP

const TEMPLATE_VARIABLES = [
  { variable: "{{creatorName}}", description: "Creator's name" },
  { variable: "{{requestTitle}}", description: "Title of the content request" },
  { variable: "{{dueDate}}", description: "Due date formatted as 'Month Day, Year'" },
  { variable: "{{daysUntilDue}}", description: "Number of days until/since due date" },
  { variable: "{{portalLink}}", description: "Link to the creator's portal" },
  { variable: "{{urgencyText}}", description: "Text like 'due in 3 days' or '2 days overdue'" },
];

// MAIN COMPONENT

export function RemindersClient({
  initialTemplates,
  initialReminders,
  creators,
  agencySettings: _agencySettings,
}: RemindersClientProps) {
  const [templates, setTemplates] = useState<ReminderTemplate[]>(initialTemplates);
  const [reminders, setReminders] = useState<Reminder[]>(initialReminders);
  const [selectedReminders, setSelectedReminders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReminderTemplate | null>(null);

  // Filter reminders
  const filteredReminders = useMemo(() => {
    return reminders.filter((reminder) => {
      if (statusFilter !== "all" && reminder.status !== statusFilter) return false;
      if (creatorFilter !== "all" && reminder.request.creator.id !== creatorFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          reminder.request.title.toLowerCase().includes(query) ||
          reminder.request.creator.name.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [reminders, statusFilter, creatorFilter, searchQuery]);

  // Separate reminders by status for tabs
  const pendingReminders = filteredReminders.filter((r) => r.status === "PENDING");
  const historyReminders = filteredReminders.filter((r) => r.status !== "PENDING");

  // API CALLS

  const refreshReminders = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/reminders?limit=100");
      if (response.ok) {
        const data = await response.json();
        setReminders(data.reminders);
      }
    } catch (error) {
      toast.error("Failed to refresh reminders");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTemplates = async () => {
    try {
      const response = await fetch("/api/reminders/templates?includeInactive=true");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      toast.error("Failed to refresh templates");
    }
  };

  const handleBulkAction = async (action: "cancel" | "reschedule" | "sendNow") => {
    if (selectedReminders.size === 0) {
      toast.error("No reminders selected");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reminderIds: Array.from(selectedReminders),
          ...(action === "reschedule" && { rescheduleDate: new Date().toISOString() }),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        setSelectedReminders(new Set());
        await refreshReminders();
      } else {
        const error = await response.json();
        toast.error(error.error || "Action failed");
      }
    } catch (error) {
      toast.error("Failed to perform action");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendReminder = async (reminderId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderId }),
      });

      if (response.ok) {
        toast.success("Reminder sent");
        await refreshReminders();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to send reminder");
      }
    } catch (error) {
      toast.error("Failed to send reminder");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/reminders/templates?id=${templateId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Template deleted");
        setTemplates(templates.filter((t) => t.id !== templateId));
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete template");
      }
    } catch (error) {
      toast.error("Failed to delete template");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTemplateActive = async (template: ReminderTemplate) => {
    try {
      const response = await fetch("/api/reminders/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: template.id,
          isActive: !template.isActive,
        }),
      });

      if (response.ok) {
        toast.success(template.isActive ? "Template deactivated" : "Template activated");
        await refreshTemplates();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update template");
      }
    } catch (error) {
      toast.error("Failed to update template");
    }
  };

  // RENDER

  return (
    <Tabs defaultValue="templates" className="space-y-6">
      <TabsList variant="line" className="w-full justify-start border-b">
        <TabsTrigger value="templates" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Templates
        </TabsTrigger>
        <TabsTrigger value="active" className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Active reminders
          {pendingReminders.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {pendingReminders.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="history" className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          History
        </TabsTrigger>
        <TabsTrigger value="settings" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Settings
        </TabsTrigger>
      </TabsList>

      {/* Templates Tab */}
      <TabsContent value="templates" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Reminder templates</h2>
            <p className="text-sm text-muted-foreground">
              Create reusable reminder configurations with custom schedules and messages
            </p>
          </div>
          <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
            <DialogTrigger asChild>
              <Button
                className=" bg-primary hover:bg-primary/90 "
                onClick={() => setEditingTemplate(null)}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <TemplateDialog
              template={editingTemplate}
              onClose={() => {
                setShowTemplateDialog(false);
                setEditingTemplate(null);
              }}
              onSave={async () => {
                await refreshTemplates();
                setShowTemplateDialog(false);
                setEditingTemplate(null);
              }}
            />
          </Dialog>
        </div>

        {templates.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Bell className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No reminder templates yet</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                  Create your first reminder template to automate content request notifications.
                </p>
                <Button
                  className="mt-6"
                  onClick={() => {
                    setEditingTemplate(null);
                    setShowTemplateDialog(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className={!template.isActive ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {template.isActive ? "Active" : "Inactive"}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-label={`More actions for ${template.name}`} variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingTemplate(template);
                            setShowTemplateDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleTemplateActive(template)}>
                          {template.isActive ? (
                            <>
                              <XCircle className="h-4 w-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-late"
                          onClick={() => handleDeleteTemplate(template.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Schedule */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Schedule</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[...template.daysBefore].sort((a, b) => b - a).map((days) => (
                        <Badge key={days} variant="secondary" className="text-xs">
                          {days === 0 ? "Due day" : `${days}d before`}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Escalation */}
                  {template.escalateDaysOverdue && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Escalation</p>
                      <Badge variant="outline" className="text-xs text-late border-late/30 bg-late/10">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Every {template.escalateDaysOverdue}d overdue
                      </Badge>
                    </div>
                  )}

                  {/* Channels */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Channels</p>
                    <div className="flex gap-2">
                      {template.sendEmail && (
                        <Badge variant="outline" className="text-xs">
                          <Mail className="h-3 w-3 mr-1" />
                          Email
                        </Badge>
                      )}
                      {template.sendSms && (
                        <Badge variant="outline" className="text-xs">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          SMS
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      {/* Active Reminders Tab */}
      <TabsContent value="active" className="space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by request or creator..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                  <SelectTrigger aria-label="Filter by creator" className="w-[180px]">
                    <SelectValue placeholder="All Creators" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Creators</SelectItem>
                    {creators.map((creator) => (
                      <SelectItem key={creator.id} value={creator.id}>
                        {creator.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button aria-label="Refresh reminders" variant="outline" size="icon" onClick={refreshReminders} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedReminders.size > 0 && (
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">
              {selectedReminders.size} reminder{selectedReminders.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleBulkAction("sendNow")}>
                <Send className="h-4 w-4 mr-1" />
                Send Now
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction("cancel")}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => setSelectedReminders(new Set())}
            >
              Clear Selection
            </Button>
          </div>
        )}

        {/* Reminders Table */}
        <Card>
          <CardHeader>
            <CardTitle>Scheduled Reminders</CardTitle>
            <CardDescription>
              {pendingReminders.length} pending reminder{pendingReminders.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingReminders.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No pending reminders</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox aria-label="Select all reminders"
                        checked={pendingReminders.every((r) => selectedReminders.has(r.id))}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedReminders(new Set(pendingReminders.map((r) => r.id)));
                          } else {
                            setSelectedReminders(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingReminders.map((reminder) => (
                    <TableRow key={reminder.id}>
                      <TableCell>
                        <Checkbox aria-label={`Select reminder for ${reminder.request.title}`}
                          checked={selectedReminders.has(reminder.id)}
                          onCheckedChange={(checked) => {
                            const newSelected = new Set(selectedReminders);
                            if (checked) {
                              newSelected.add(reminder.id);
                            } else {
                              newSelected.delete(reminder.id);
                            }
                            setSelectedReminders(newSelected);
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{reminder.request.title}</TableCell>
                      <TableCell>{reminder.request.creator.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {reminder.type.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {reminder.channel === "EMAIL" ? (
                          <Mail className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {format(new Date(reminder.scheduledAt), "MMM d, h:mm a")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-label={`More actions for reminder on ${reminder.request.title}`} variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleSendReminder(reminder.id)}>
                              <Send className="h-4 w-4 mr-2" />
                              Send Now
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-late"
                              onClick={() => {
                                setSelectedReminders(new Set([reminder.id]));
                                handleBulkAction("cancel");
                              }}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* History Tab */}
      <TabsContent value="history" className="space-y-6">
        {/* Status Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by request or creator..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger aria-label="Filter by status" className="w-[150px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                  <SelectTrigger aria-label="Filter by creator" className="w-[180px]">
                    <SelectValue placeholder="All Creators" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Creators</SelectItem>
                    {creators.map((creator) => (
                      <SelectItem key={creator.id} value={creator.id}>
                        {creator.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* History Table */}
        <Card>
          <CardHeader>
            <CardTitle>Reminder History</CardTitle>
            <CardDescription>
              {historyReminders.length} reminder{historyReminders.length !== 1 ? "s" : ""} in history
            </CardDescription>
          </CardHeader>
          <CardContent>
            {historyReminders.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No reminder history yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyReminders.map((reminder) => (
                    <TableRow key={reminder.id}>
                      <TableCell>
                        {reminder.status === "SENT" ? (
                          <Badge className="bg-success/10 text-success border-success/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Sent
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{reminder.request.title}</TableCell>
                      <TableCell>{reminder.request.creator.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {reminder.channel === "EMAIL" ? (
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm">{reminder.channel}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {reminder.sentAt ? (
                          <div className="text-sm">
                            {format(new Date(reminder.sentAt), "MMM d, h:mm a")}
                            <span className="block text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(reminder.sentAt), { addSuffix: true })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {reminder.error && (
                          <span className="text-xs text-late">{reminder.error}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Settings Tab: the real controls live in Reminder rules */}
      <TabsContent value="settings" className="space-y-6">
        <div className="max-w-[640px] rounded-[10px] bg-tile p-5">
          <h2 className="text-[17px] font-semibold text-ink">Schedules and quiet hours</h2>
          <p className="mt-1 text-sm text-ink-2">
            When reminders go out, which channel they use and each creator&apos;s quiet hours are set in Reminder rules,
            with a preview of the reminder as it lands on the creator&apos;s lock screen.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/dashboard/settings/reminder-rules">Open reminder rules</Link>
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}

// TEMPLATE DIALOG COMPONENT

interface TemplateDialogProps {
  template: ReminderTemplate | null;
  onClose: () => void;
  onSave: () => Promise<void>;
}

function TemplateDialog({ template, onClose, onSave }: TemplateDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: template?.name || "",
    daysBefore: template?.daysBefore || [7, 3, 1, 0],
    escalateDaysOverdue: template?.escalateDaysOverdue || null,
    sendEmail: template?.sendEmail ?? true,
    sendSms: template?.sendSms ?? false,
    emailSubject: template?.emailSubject || "Reminder: content {{urgencyText}}",
    emailBody:
      template?.emailBody ||
      `Hi {{creatorName}},

This is a friendly reminder that your content for "{{requestTitle}}" is {{urgencyText}}.

Due date: {{dueDate}}

Please upload your content here: {{portalLink}}

Thank you!`,
    smsBody:
      template?.smsBody ||
      "Hi {{creatorName}}, you have content {{urgencyText}}. View it here: {{portalLink}}",
    isActive: template?.isActive ?? true,
  });

  const [daysBeforeInput, setDaysBeforeInput] = useState(formData.daysBefore.join(", "));

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Template name is required");
      return;
    }

    // Parse days before
    const parsedDays = daysBeforeInput
      .split(",")
      .map((d) => parseInt(d.trim()))
      .filter((d) => !isNaN(d) && d >= 0);

    if (parsedDays.length === 0) {
      toast.error("At least one reminder day is required");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/reminders/templates", {
        method: template ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(template && { id: template.id }),
          name: formData.name,
          daysBefore: parsedDays,
          escalateDaysOverdue: formData.escalateDaysOverdue,
          sendEmail: formData.sendEmail,
          sendSms: formData.sendSms,
          emailSubject: formData.sendEmail ? formData.emailSubject : null,
          emailBody: formData.sendEmail ? formData.emailBody : null,
          smsBody: formData.sendSms ? formData.smsBody : null,
          isActive: formData.isActive,
        }),
      });

      if (response.ok) {
        toast.success(template ? "Template updated" : "Template created");
        await onSave();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save template");
      }
    } catch (error) {
      toast.error("Failed to save template");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{template ? "Edit Template" : "Create Reminder Template"}</DialogTitle>
        <DialogDescription>
          Configure when and how reminders are sent to creators
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Template Name *</Label>
          <Input
            id="name"
            placeholder="e.g., Standard Reminder Schedule"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        {/* Schedule */}
        <div className="space-y-2">
          <Label htmlFor="daysBefore">Reminder Schedule (days before due) *</Label>
          <Input
            id="daysBefore"
            placeholder="e.g., 7, 3, 1, 0"
            value={daysBeforeInput}
            onChange={(e) => setDaysBeforeInput(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Enter comma-separated numbers. Use 0 for the day of the due date.
          </p>
        </div>

        {/* Escalation */}
        <div className="space-y-2">
          <Label htmlFor="escalation">Escalation (days overdue)</Label>
          <Input
            id="escalation"
            type="number"
            min="1"
            placeholder="e.g., 3 (send every 3 days overdue)"
            value={formData.escalateDaysOverdue || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                escalateDaysOverdue: e.target.value ? parseInt(e.target.value) : null,
              })
            }
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to disable escalation reminders for overdue content
          </p>
        </div>

        {/* Channels */}
        <div className="space-y-4">
          <Label>Notification Channels</Label>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox aria-label="Email"
                id="sendEmail"
                checked={formData.sendEmail}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, sendEmail: Boolean(checked) })
                }
              />
              <Label htmlFor="sendEmail" className="font-normal">
                <Mail className="h-4 w-4 inline mr-1" />
                Email
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox aria-label="SMS"
                id="sendSms"
                checked={formData.sendSms}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, sendSms: Boolean(checked) })
                }
              />
              <Label htmlFor="sendSms" className="font-normal">
                <MessageSquare className="h-4 w-4 inline mr-1" />
                SMS
              </Label>
            </div>
          </div>
        </div>

        {/* Email Template */}
        {formData.sendEmail && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h4 className="font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Template
            </h4>
            <div className="space-y-2">
              <Label htmlFor="emailSubject">Subject</Label>
              <Input
                id="emailSubject"
                value={formData.emailSubject}
                onChange={(e) => setFormData({ ...formData, emailSubject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailBody">Body</Label>
              <Textarea
                id="emailBody"
                rows={6}
                value={formData.emailBody}
                onChange={(e) => setFormData({ ...formData, emailBody: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* SMS Template */}
        {formData.sendSms && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h4 className="font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              SMS Template
            </h4>
            <div className="space-y-2">
              <Label htmlFor="smsBody">Message</Label>
              <Textarea
                id="smsBody"
                rows={3}
                value={formData.smsBody}
                onChange={(e) => setFormData({ ...formData, smsBody: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Keep SMS messages under 160 characters for best delivery
              </p>
            </div>
          </div>
        )}

        {/* Template Variables */}
        <div className="p-4 rounded-lg bg-well">
          <h4 className="font-medium text-sm mb-2">Available Variables</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {TEMPLATE_VARIABLES.map(({ variable, description }) => (
              <div key={variable} className="flex items-start gap-2">
                <code className="bg-background px-1.5 py-0.5 rounded font-mono text-primary">
                  {variable}
                </code>
                <span className="text-muted-foreground">{description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Active Status */}
        <div className="flex items-center gap-2">
          <Checkbox aria-label="Template is active"
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: Boolean(checked) })}
          />
          <Label htmlFor="isActive" className="font-normal">
            Template is active
          </Label>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? "Saving..." : template ? "Update Template" : "Create Template"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
