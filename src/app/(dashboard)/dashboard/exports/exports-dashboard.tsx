"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Download,
  FileText,
  Clock,
  Save,
  Loader2,
  Users,
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileJson,
  File,
  Trash2,
  Play,
  Upload,
  BarChart3,
  Settings2,
  History,
  Zap,
  Plus,
  GripVertical,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { ExportBuilder } from "@/components/exports/export-builder";

interface Creator {
  id: string;
  name: string;
  email: string;
}

interface Request {
  id: string;
  title: string;
  status: string;
}

interface ExportsDashboardProps {
  creators: Creator[];
  requests: Request[];
}

interface ExportPreset {
  id: string;
  name: string;
  description: string;
  entity: EntityType;
  fields: string[];
  filters: ExportFilters;
  format: ExportFormat;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

interface ExportHistoryItem {
  id: string;
  name: string;
  entity: EntityType;
  format: ExportFormat;
  recordCount: number;
  fileSize: string;
  status: "completed" | "processing" | "failed";
  createdAt: string;
  downloadUrl?: string;
  expiresAt?: string;
}

interface ScheduledExport {
  id: string;
  name: string;
  entity: EntityType;
  format: ExportFormat;
  frequency: "daily" | "weekly" | "monthly";
  recipients: string[];
  nextRunAt: string;
  lastRunAt?: string;
  isActive: boolean;
}

interface ExportFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  creatorIds?: string[];
  statuses?: string[];
}

type EntityType = "creators" | "requests" | "uploads" | "analytics";
type ExportFormat = "csv" | "excel" | "json" | "pdf";

const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: "creators-list",
    name: "Creators List",
    description: "Export all creators with contact info and status",
    entity: "creators",
    fields: ["name", "email", "phone", "inviteStatus", "lastLoginAt", "createdAt"],
    filters: {},
    format: "csv",
    icon: Users,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
  },
  {
    id: "requests-summary",
    name: "Requests Summary",
    description: "Export all requests with status and due dates",
    entity: "requests",
    fields: ["title", "creatorName", "status", "urgency", "dueDate", "createdAt"],
    filters: {},
    format: "excel",
    icon: FileText,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    id: "uploads-history",
    name: "Uploads History",
    description: "Export upload records with file details and review status",
    entity: "uploads",
    fields: ["fileName", "creatorName", "requestTitle", "status", "fileSize", "uploadedAt"],
    filters: {},
    format: "csv",
    icon: Upload,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    id: "analytics-report",
    name: "Analytics Report",
    description: "Export performance metrics and statistics",
    entity: "analytics",
    fields: ["metric", "value", "period", "change"],
    filters: {},
    format: "pdf",
    icon: BarChart3,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
];

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { value: "csv", label: "CSV", icon: FileText, description: "Comma-separated values" },
  { value: "excel", label: "Excel", icon: FileSpreadsheet, description: "Microsoft Excel format" },
  { value: "json", label: "JSON", icon: FileJson, description: "JavaScript Object Notation" },
  { value: "pdf", label: "PDF", icon: File, description: "Portable Document Format" },
];

export function ExportsDashboard({ creators, requests }: ExportsDashboardProps) {
  // State
  const [activeTab, setActiveTab] = useState("presets");
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);
  const [scheduledExports, setScheduledExports] = useState<ScheduledExport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Custom export builder state
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderConfig, setBuilderConfig] = useState<{
    entity: EntityType;
    fields: string[];
    filters: ExportFilters;
    format: ExportFormat;
  } | null>(null);

  // Schedule dialog state
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState({
    name: "",
    frequency: "weekly" as "daily" | "weekly" | "monthly",
    recipients: "",
  });

  // Load export history on mount
  useEffect(() => {
    fetchExportHistory();
    fetchScheduledExports();
  }, []);

  const fetchExportHistory = async () => {
    try {
      const res = await fetch("/api/exports?type=history");
      if (res.ok) {
        const data = await res.json();
        setExportHistory(data.history || []);
      }
    } catch {
      console.error("Failed to fetch export history");
    }
  };

  const fetchScheduledExports = async () => {
    try {
      const res = await fetch("/api/exports?type=scheduled");
      if (res.ok) {
        const data = await res.json();
        setScheduledExports(data.scheduled || []);
      }
    } catch {
      console.error("Failed to fetch scheduled exports");
    }
  };

  const runPresetExport = async (preset: ExportPreset) => {
    setIsExporting(preset.id);
    try {
      const res = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: preset.entity,
          fields: preset.fields,
          filters: preset.filters,
          format: preset.format,
          name: preset.name,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate export");
      }

      // Download the file
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const extension = preset.format === "excel" ? "xlsx" : preset.format;
      a.download = `${preset.entity}-export-${new Date().toISOString().split("T")[0]}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Export downloaded successfully");
      fetchExportHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate export");
    } finally {
      setIsExporting(null);
    }
  };

  const handleCustomExport = async (config: {
    entity: EntityType;
    fields: string[];
    filters: ExportFilters;
    format: ExportFormat;
    name?: string;
  }) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate export");
      }

      // Download the file
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const extension = config.format === "excel" ? "xlsx" : config.format;
      a.download = `${config.entity}-custom-export-${new Date().toISOString().split("T")[0]}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Export downloaded successfully");
      setShowBuilder(false);
      fetchExportHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate export");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadExport = async (item: ExportHistoryItem) => {
    if (!item.downloadUrl) {
      toast.error("Download link has expired");
      return;
    }

    try {
      const res = await fetch(item.downloadUrl);
      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const extension = item.format === "excel" ? "xlsx" : item.format;
      a.download = `${item.name}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Export downloaded");
    } catch {
      toast.error("Failed to download export");
    }
  };

  const deleteScheduledExport = async (id: string) => {
    try {
      const res = await fetch(`/api/exports?id=${id}&type=scheduled`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      setScheduledExports((prev) => prev.filter((e) => e.id !== id));
      toast.success("Scheduled export deleted");
    } catch {
      toast.error("Failed to delete scheduled export");
    }
  };

  const toggleScheduledExport = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch("/api/exports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive }),
      });

      if (!res.ok) throw new Error("Failed to update");

      setScheduledExports((prev) =>
        prev.map((e) => (e.id === id ? { ...e, isActive } : e))
      );
      toast.success(isActive ? "Schedule activated" : "Schedule paused");
    } catch {
      toast.error("Failed to update schedule");
    }
  };

  const createScheduledExport = async () => {
    if (!scheduleConfig.name.trim()) {
      toast.error("Please enter a name for the scheduled export");
      return;
    }

    const recipients = scheduleConfig.recipients
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e);

    if (recipients.length === 0) {
      toast.error("Please enter at least one recipient email");
      return;
    }

    if (!builderConfig) {
      toast.error("Please configure an export first");
      return;
    }

    try {
      const res = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "schedule",
          name: scheduleConfig.name,
          entity: builderConfig.entity,
          fields: builderConfig.fields,
          filters: builderConfig.filters,
          format: builderConfig.format,
          frequency: scheduleConfig.frequency,
          recipients,
        }),
      });

      if (!res.ok) throw new Error("Failed to create schedule");

      toast.success("Scheduled export created");
      setIsScheduleDialogOpen(false);
      setScheduleConfig({ name: "", frequency: "weekly", recipients: "" });
      fetchScheduledExports();
    } catch {
      toast.error("Failed to create scheduled export");
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Data Export Center
          </h1>
          <p className="text-muted-foreground">
            Export your data in multiple formats with custom configurations
          </p>
        </div>
        <Button onClick={() => setShowBuilder(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Custom Export
        </Button>
      </div>

      {/* Export Builder Dialog */}
      {showBuilder && (
        <ExportBuilder
          creators={creators}
          requests={requests}
          onExport={handleCustomExport}
          onClose={() => setShowBuilder(false)}
          isLoading={isLoading}
          onConfigChange={setBuilderConfig}
        />
      )}

      {/* Main content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="presets" className="gap-2">
            <Zap className="h-4 w-4" />
            Quick Exports
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Export History
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-2">
            <Clock className="h-4 w-4" />
            Scheduled
          </TabsTrigger>
        </TabsList>

        {/* Quick Exports / Presets Tab */}
        <TabsContent value="presets" className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Export Presets
              </CardTitle>
              <CardDescription>
                One-click exports with pre-configured settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {EXPORT_PRESETS.map((preset) => (
                  <div
                    key={preset.id}
                    className="relative p-4 rounded-xl border-2 border-border hover:border-primary/50 hover:shadow-md transition-all"
                  >
                    <div
                      className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center mb-3",
                        preset.bgColor
                      )}
                    >
                      <preset.icon className={cn("h-6 w-6", preset.color)} />
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{preset.name}</h3>
                    <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                      {preset.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {preset.format.toUpperCase()}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => runPresetExport(preset)}
                        disabled={isExporting === preset.id}
                        className="gap-1"
                      >
                        {isExporting === preset.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        Export
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Format Guide */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                Export Formats
              </CardTitle>
              <CardDescription>
                Choose the best format for your needs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {FORMAT_OPTIONS.map((format) => (
                  <div
                    key={format.value}
                    className="p-4 rounded-xl bg-muted/50 border border-border"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center">
                        <format.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">{format.label}</h4>
                        <p className="text-xs text-muted-foreground">
                          .{format.value === "excel" ? "xlsx" : format.value}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Recent Exports
                  </CardTitle>
                  <CardDescription>
                    Download links expire after 24 hours
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchExportHistory}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {exportHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                    <History className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No export history</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your recent exports will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {exportHistory.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-4 border rounded-xl hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                          item.status === "completed"
                            ? "bg-emerald-500/10"
                            : item.status === "processing"
                            ? "bg-blue-500/10"
                            : "bg-red-500/10"
                        )}
                      >
                        {item.status === "completed" ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : item.status === "processing" ? (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{item.recordCount.toLocaleString()} records</span>
                          <span>-</span>
                          <span>{item.fileSize}</span>
                          <span>-</span>
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">
                          {item.format.toUpperCase()}
                        </Badge>
                        {item.status === "completed" && item.downloadUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadExport(item)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduled Exports Tab */}
        <TabsContent value="scheduled" className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Scheduled Exports
                  </CardTitle>
                  <CardDescription>
                    Automatically generate and email exports on a schedule
                  </CardDescription>
                </div>
                <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      New Schedule
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Scheduled Export</DialogTitle>
                      <DialogDescription>
                        Set up automatic exports delivered to your email
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Schedule Name</Label>
                        <Input
                          placeholder="e.g., Weekly Creator Report"
                          value={scheduleConfig.name}
                          onChange={(e) =>
                            setScheduleConfig((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Frequency</Label>
                        <Select
                          value={scheduleConfig.frequency}
                          onValueChange={(v) =>
                            setScheduleConfig((prev) => ({
                              ...prev,
                              frequency: v as "daily" | "weekly" | "monthly",
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Recipients</Label>
                        <Input
                          placeholder="email1@example.com, email2@example.com"
                          value={scheduleConfig.recipients}
                          onChange={(e) =>
                            setScheduleConfig((prev) => ({
                              ...prev,
                              recipients: e.target.value,
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Separate multiple emails with commas
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium mb-2">Configure Export First</p>
                        <p className="text-xs text-muted-foreground">
                          Use the Custom Export builder to configure your export, then create a schedule for it.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            setIsScheduleDialogOpen(false);
                            setShowBuilder(true);
                          }}
                        >
                          Open Export Builder
                        </Button>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={createScheduledExport} className="gap-2">
                        <Clock className="h-4 w-4" />
                        Create Schedule
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {scheduledExports.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                    <Clock className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No scheduled exports</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create a schedule to automatically receive exports
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {scheduledExports.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="flex items-center gap-4 p-4 border rounded-xl hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                          schedule.isActive ? "bg-emerald-500/10" : "bg-muted"
                        )}
                      >
                        <Clock
                          className={cn(
                            "h-5 w-5",
                            schedule.isActive ? "text-emerald-500" : "text-muted-foreground"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm truncate">{schedule.name}</h3>
                          {!schedule.isActive && (
                            <Badge variant="secondary" className="text-xs">
                              Paused
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="capitalize">{schedule.frequency}</span>
                          <span>-</span>
                          <span>{schedule.recipients.length} recipient(s)</span>
                          <span>-</span>
                          <span>Next: {new Date(schedule.nextRunAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">
                          {schedule.format.toUpperCase()}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleScheduledExport(schedule.id, !schedule.isActive)}
                        >
                          {schedule.isActive ? (
                            <AlertCircle className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteScheduledExport(schedule.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
