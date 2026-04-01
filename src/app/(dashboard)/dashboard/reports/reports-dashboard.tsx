"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  FileText,
  Download,
  Mail,
  Clock,
  Save,
  Loader2,
  BarChart3,
  TrendingUp,
  Users,
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
  FileBarChart,
  Activity,
  RefreshCw,
  Bookmark,
  Trash2,
  Play,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { ShareDialog } from "@/components/share/share-dialog";

interface Creator {
  id: string;
  name: string;
  email: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ReportsDashboardProps {
  creators: Creator[];
  teamMembers: TeamMember[];
}

interface SavedReport {
  id: string;
  name: string;
  reportType: string;
  dateRange: string;
  groupBy: string;
  filters: {
    creatorIds?: string[];
    teamMemberIds?: string[];
  };
  schedule?: {
    enabled: boolean;
    frequency: "daily" | "weekly" | "monthly";
    recipients: string[];
  };
  createdAt: string;
  updatedAt: string;
}

type ReportType = "creator_performance" | "content_delivery" | "request_summary" | "team_activity";
type DateRangePreset = "this_week" | "this_month" | "this_quarter" | "this_year" | "custom";
type GroupBy = "day" | "week" | "month";

interface ReportSummary {
  totalCreators?: number;
  totalUploads?: number;
  avgApprovalRate?: number;
  avgResponseHours?: number;
  topPerformer?: string;
  totalRequests?: number;
  completedRequests?: number;
  completionRate?: number;
  onTimeRate?: number;
  avgDeliveryHours?: number;
  fastestDelivery?: number;
  slowestDelivery?: number;
  byStatus?: Array<{ status: string; count: number; percentage: number }>;
  byUrgency?: Array<{ urgency: string; count: number; percentage: number }>;
  byPeriod?: Array<{ period: string; count: number }>;
  totalTeamMembers?: number;
  totalActions?: number;
  avgActionsPerMember?: number;
  mostActiveUser?: string;
}

interface ReportDataType {
  data: Record<string, unknown>[];
  summary: ReportSummary;
  meta: {
    reportType: string;
    dateRange: {
      preset: string;
      start: string;
      end: string;
    };
    groupBy: string;
    generatedAt: string;
  };
}

const REPORT_TYPES = [
  {
    value: "creator_performance" as ReportType,
    label: "Creator Performance Report",
    description: "Metrics per creator including uploads, approval rates, response times",
    icon: Users,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
  },
  {
    value: "content_delivery" as ReportType,
    label: "Content Delivery Report",
    description: "Delivery times, completion rates, on-time performance",
    icon: Clock,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    value: "request_summary" as ReportType,
    label: "Request Summary Report",
    description: "Requests by status, type, and time period",
    icon: FileBarChart,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    value: "team_activity" as ReportType,
    label: "Team Activity Report",
    description: "Staff actions and productivity metrics",
    icon: Activity,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
];

const DATE_RANGE_PRESETS = [
  { value: "this_week" as DateRangePreset, label: "This Week" },
  { value: "this_month" as DateRangePreset, label: "This Month" },
  { value: "this_quarter" as DateRangePreset, label: "This Quarter" },
  { value: "this_year" as DateRangePreset, label: "This Year" },
  { value: "custom" as DateRangePreset, label: "Custom Range" },
];

const GROUP_BY_OPTIONS = [
  { value: "day" as GroupBy, label: "Day" },
  { value: "week" as GroupBy, label: "Week" },
  { value: "month" as GroupBy, label: "Month" },
];

export function ReportsDashboard({ creators, teamMembers }: ReportsDashboardProps) {
  // Report builder state
  const [reportType, setReportType] = useState<ReportType>("creator_performance");
  const [dateRange, setDateRange] = useState<DateRangePreset>("this_month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("week");
  const [selectedCreators, setSelectedCreators] = useState<string[]>([]);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Report data state
  const [reportData, setReportData] = useState<ReportDataType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Saved reports state
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [reportName, setReportName] = useState("");
  const [scheduleFrequency, setScheduleFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [scheduleRecipients, setScheduleRecipients] = useState("");
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Load saved reports on mount
  useEffect(() => {
    fetchSavedReports();
  }, []);

  const fetchSavedReports = async () => {
    try {
      const res = await fetch("/api/reports/saved");
      if (res.ok) {
        const data = await res.json();
        setSavedReports(data.savedReports || []);
      }
    } catch {
      console.error("Failed to fetch saved reports");
    }
  };

  const generateReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType,
          dateRange,
          startDate: dateRange === "custom" ? customStartDate : undefined,
          endDate: dateRange === "custom" ? customEndDate : undefined,
          groupBy,
          filters: {
            creatorIds: selectedCreators.length > 0 ? selectedCreators : undefined,
            teamMemberIds: selectedTeamMembers.length > 0 ? selectedTeamMembers : undefined,
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate report");
      }

      const data = await res.json();
      setReportData(data);
      toast.success("Report generated successfully");
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setIsLoading(false);
    }
  }, [reportType, dateRange, customStartDate, customEndDate, groupBy, selectedCreators, selectedTeamMembers]);

  const exportReport = async (format: "csv" | "pdf") => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType,
          dateRange,
          startDate: dateRange === "custom" ? customStartDate : undefined,
          endDate: dateRange === "custom" ? customEndDate : undefined,
          format,
          creatorIds: selectedCreators.length > 0 ? selectedCreators : undefined,
          teamMemberIds: selectedTeamMembers.length > 0 ? selectedTeamMembers : undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to export report");
      }

      // Download the file
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${reportType}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Report exported successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export report");
    } finally {
      setIsExporting(false);
    }
  };

  const saveReport = async () => {
    if (!reportName.trim()) {
      toast.error("Please enter a report name");
      return;
    }

    try {
      const res = await fetch("/api/reports/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: reportName,
          reportType,
          dateRange,
          groupBy,
          filters: {
            creatorIds: selectedCreators.length > 0 ? selectedCreators : undefined,
            teamMemberIds: selectedTeamMembers.length > 0 ? selectedTeamMembers : undefined,
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save report");
      }

      await fetchSavedReports();
      setIsSaveDialogOpen(false);
      setReportName("");
      toast.success("Report saved successfully");
    } catch {
      toast.error("Failed to save report");
    }
  };

  const loadSavedReport = (report: SavedReport) => {
    setReportType(report.reportType as ReportType);
    setDateRange(report.dateRange as DateRangePreset);
    setGroupBy(report.groupBy as GroupBy);
    setSelectedCreators(report.filters.creatorIds || []);
    setSelectedTeamMembers(report.filters.teamMemberIds || []);
    toast.success(`Loaded report: ${report.name}`);
  };

  const deleteSavedReport = async (id: string) => {
    try {
      const res = await fetch(`/api/reports/saved?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete report");
      }

      await fetchSavedReports();
      toast.success("Report deleted");
    } catch {
      toast.error("Failed to delete report");
    }
  };

  const scheduleReport = async () => {
    const recipients = scheduleRecipients
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e);

    if (recipients.length === 0) {
      toast.error("Please enter at least one recipient email");
      return;
    }

    // For now, we'll just show a placeholder message
    toast.success(`Report scheduled ${scheduleFrequency} to ${recipients.length} recipient(s)`);
    setIsScheduleDialogOpen(false);
    setScheduleRecipients("");
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const getSortedData = (data: Record<string, unknown>[]): Record<string, unknown>[] => {
    if (!sortColumn) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal || "");
      const bStr = String(bVal || "");
      return sortDirection === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  };

  const reportConfig = REPORT_TYPES.find((r) => r.value === reportType);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Performance Reports
          </h1>
          <p className="text-muted-foreground">
            Generate detailed analytics and exportable reports
          </p>
        </div>
      </div>

      {/* Main content */}
      <Tabs defaultValue="builder" className="space-y-6">
        <TabsList>
          <TabsTrigger value="builder">Report Builder</TabsTrigger>
          <TabsTrigger value="saved">Saved Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-6">
          {/* Report Type Selection */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Select Report Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {REPORT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setReportType(type.value)}
                    className={cn(
                      "relative p-4 rounded-xl border-2 text-left transition-all",
                      "hover:border-primary/50 hover:shadow-md",
                      reportType === type.value
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    )}
                  >
                    <div
                      className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center mb-3",
                        type.bgColor
                      )}
                    >
                      <type.icon className={cn("h-5 w-5", type.color)} />
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{type.label}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {type.description}
                    </p>
                    {reportType === type.value && (
                      <div className="absolute top-3 right-3">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Report Builder Options */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Date Range & Grouping */}
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Date Range
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Time Period</Label>
                  <Select
                    value={dateRange}
                    onValueChange={(v) => setDateRange(v as DateRangePreset)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_RANGE_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {dateRange === "custom" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Group By</Label>
                  <Select
                    value={groupBy}
                    onValueChange={(v) => setGroupBy(v as GroupBy)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select grouping" />
                    </SelectTrigger>
                    <SelectContent>
                      {GROUP_BY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Filters */}
            <Card className="card-elevated lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Filter className="h-5 w-5 text-primary" />
                    Filters
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    {showFilters ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              {showFilters && (
                <CardContent className="space-y-4">
                  {(reportType === "creator_performance" ||
                    reportType === "content_delivery") && (
                    <div className="space-y-2">
                      <Label>Filter by Creator</Label>
                      <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-3">
                        {creators.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No creators found
                          </p>
                        ) : (
                          creators.map((creator) => (
                            <label
                              key={creator.id}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Checkbox
                                checked={selectedCreators.includes(creator.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedCreators([
                                      ...selectedCreators,
                                      creator.id,
                                    ]);
                                  } else {
                                    setSelectedCreators(
                                      selectedCreators.filter(
                                        (id) => id !== creator.id
                                      )
                                    );
                                  }
                                }}
                              />
                              <span className="text-sm">{creator.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({creator.email})
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                      {selectedCreators.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCreators([])}
                        >
                          Clear selection
                        </Button>
                      )}
                    </div>
                  )}

                  {reportType === "team_activity" && (
                    <div className="space-y-2">
                      <Label>Filter by Team Member</Label>
                      <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-3">
                        {teamMembers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No team members found
                          </p>
                        ) : (
                          teamMembers.map((member) => (
                            <label
                              key={member.id}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Checkbox
                                checked={selectedTeamMembers.includes(member.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedTeamMembers([
                                      ...selectedTeamMembers,
                                      member.id,
                                    ]);
                                  } else {
                                    setSelectedTeamMembers(
                                      selectedTeamMembers.filter(
                                        (id) => id !== member.id
                                      )
                                    );
                                  }
                                }}
                              />
                              <span className="text-sm">{member.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {member.role}
                              </Badge>
                            </label>
                          ))
                        )}
                      </div>
                      {selectedTeamMembers.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedTeamMembers([])}
                        >
                          Clear selection
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={generateReport} disabled={isLoading} className="gap-2">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Generate Report
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => exportReport("csv")}
                disabled={isExporting || !reportData}
                className="gap-2"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export CSV
              </Button>

              <Button
                variant="outline"
                onClick={() => exportReport("pdf")}
                disabled={true}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                Export PDF
                <Badge variant="secondary" className="text-xs">
                  Soon
                </Badge>
              </Button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Save className="h-4 w-4" />
                    Save Report
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save Report Configuration</DialogTitle>
                    <DialogDescription>
                      Save this report configuration to quickly access it later.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Report Name</Label>
                      <Input
                        placeholder="e.g., Monthly Creator Performance"
                        value={reportName}
                        onChange={(e) => setReportName(e.target.value)}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>This will save:</p>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Report type: {reportConfig?.label}</li>
                        <li>
                          Date range:{" "}
                          {DATE_RANGE_PRESETS.find((p) => p.value === dateRange)?.label}
                        </li>
                        <li>Group by: {GROUP_BY_OPTIONS.find((g) => g.value === groupBy)?.label}</li>
                        <li>Applied filters</li>
                      </ul>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={saveReport}>Save Report</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setIsShareDialogOpen(true)}
                disabled={!reportData}
              >
                <Link2 className="h-4 w-4" />
                Share Report
              </Button>

              <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Clock className="h-4 w-4" />
                    Schedule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule Recurring Report</DialogTitle>
                    <DialogDescription>
                      Automatically generate and email this report on a schedule.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select
                        value={scheduleFrequency}
                        onValueChange={(v) =>
                          setScheduleFrequency(v as "daily" | "weekly" | "monthly")
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
                      <Label>Email Recipients</Label>
                      <Input
                        placeholder="email1@example.com, email2@example.com"
                        value={scheduleRecipients}
                        onChange={(e) => setScheduleRecipients(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Separate multiple emails with commas
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={scheduleReport} className="gap-2">
                      <Mail className="h-4 w-4" />
                      Schedule Report
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Report Preview */}
          {reportData && (
            <ReportPreview
              data={reportData}
              reportType={reportType}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
              getSortedData={getSortedData}
            />
          )}
        </TabsContent>

        <TabsContent value="saved" className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Bookmark className="h-5 w-5 text-primary" />
                Saved Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              {savedReports.length === 0 ? (
                <div className="text-center py-8">
                  <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No saved reports</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Save a report configuration to quickly access it later
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedReports.map((report) => {
                    const config = REPORT_TYPES.find((r) => r.value === report.reportType);
                    return (
                      <div
                        key={report.id}
                        className="flex items-center gap-4 p-4 border rounded-xl hover:bg-muted/50 transition-colors"
                      >
                        {config && (
                          <div
                            className={cn(
                              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                              config.bgColor
                            )}
                          >
                            <config.icon className={cn("h-5 w-5", config.color)} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{report.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {config?.label} - {DATE_RANGE_PRESETS.find((p) => p.value === report.dateRange)?.label}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {report.schedule?.enabled && (
                            <Badge variant="secondary" className="gap-1">
                              <Clock className="h-3 w-3" />
                              {report.schedule.frequency}
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadSavedReport(report)}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteSavedReport(report.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Share Dialog */}
      <ShareDialog
        open={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        resourceType="REPORT"
        resourceId={`${reportType}-${dateRange}`}
        resourceTitle={`${REPORT_TYPES.find((r) => r.value === reportType)?.label || "Report"} - ${DATE_RANGE_PRESETS.find((p) => p.value === dateRange)?.label || dateRange}`}
      />
    </div>
  );
}

interface ReportPreviewProps {
  data: ReportDataType;
  reportType: ReportType;
  sortColumn: string | null;
  sortDirection: "asc" | "desc";
  onSort: (column: string) => void;
  getSortedData: (data: Record<string, unknown>[]) => Record<string, unknown>[];
}

function ReportPreview({
  data,
  reportType,
  sortColumn,
  sortDirection,
  onSort,
  getSortedData,
}: ReportPreviewProps) {
  const { summary, meta } = data;
  const tableData = getSortedData(data.data);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {reportType === "creator_performance" && summary && (
          <>
            <SummaryCard
              icon={Users}
              label="Total Creators"
              value={summary.totalCreators?.toString() || "0"}
              color="text-violet-500"
              bgColor="bg-violet-500/10"
            />
            <SummaryCard
              icon={FileText}
              label="Total Uploads"
              value={summary.totalUploads?.toString() || "0"}
              color="text-blue-500"
              bgColor="bg-blue-500/10"
            />
            <SummaryCard
              icon={TrendingUp}
              label="Avg Approval Rate"
              value={`${summary.avgApprovalRate || 0}%`}
              color="text-emerald-500"
              bgColor="bg-emerald-500/10"
            />
            <SummaryCard
              icon={Clock}
              label="Avg Response Time"
              value={`${summary.avgResponseHours || 0}h`}
              color="text-amber-500"
              bgColor="bg-amber-500/10"
            />
          </>
        )}

        {reportType === "content_delivery" && summary && (
          <>
            <SummaryCard
              icon={FileText}
              label="Total Requests"
              value={summary.totalRequests?.toString() || "0"}
              color="text-violet-500"
              bgColor="bg-violet-500/10"
            />
            <SummaryCard
              icon={TrendingUp}
              label="Completion Rate"
              value={`${summary.completionRate || 0}%`}
              color="text-emerald-500"
              bgColor="bg-emerald-500/10"
            />
            <SummaryCard
              icon={Clock}
              label="On-Time Rate"
              value={`${summary.onTimeRate || 0}%`}
              color="text-blue-500"
              bgColor="bg-blue-500/10"
            />
            <SummaryCard
              icon={Activity}
              label="Avg Delivery Time"
              value={`${summary.avgDeliveryHours || 0}h`}
              color="text-amber-500"
              bgColor="bg-amber-500/10"
            />
          </>
        )}

        {reportType === "request_summary" && summary && (
          <>
            <SummaryCard
              icon={FileText}
              label="Total Requests"
              value={summary.totalRequests?.toString() || "0"}
              color="text-violet-500"
              bgColor="bg-violet-500/10"
            />
            <SummaryCard
              icon={BarChart3}
              label="Status Types"
              value={(summary.byStatus?.length || 0).toString()}
              color="text-blue-500"
              bgColor="bg-blue-500/10"
            />
            <SummaryCard
              icon={Activity}
              label="Periods Covered"
              value={(summary.byPeriod?.length || 0).toString()}
              color="text-emerald-500"
              bgColor="bg-emerald-500/10"
            />
            <SummaryCard
              icon={TrendingUp}
              label="Urgency Types"
              value={(summary.byUrgency?.length || 0).toString()}
              color="text-amber-500"
              bgColor="bg-amber-500/10"
            />
          </>
        )}

        {reportType === "team_activity" && summary && (
          <>
            <SummaryCard
              icon={Users}
              label="Team Members"
              value={summary.totalTeamMembers?.toString() || "0"}
              color="text-violet-500"
              bgColor="bg-violet-500/10"
            />
            <SummaryCard
              icon={Activity}
              label="Total Actions"
              value={summary.totalActions?.toString() || "0"}
              color="text-blue-500"
              bgColor="bg-blue-500/10"
            />
            <SummaryCard
              icon={TrendingUp}
              label="Avg Actions/Member"
              value={summary.avgActionsPerMember?.toString() || "0"}
              color="text-emerald-500"
              bgColor="bg-emerald-500/10"
            />
            <SummaryCard
              icon={BarChart3}
              label="Most Active"
              value={summary.mostActiveUser || "N/A"}
              color="text-amber-500"
              bgColor="bg-amber-500/10"
            />
          </>
        )}
      </div>

      {/* Charts Section */}
      {reportType === "request_summary" && summary.byStatus && summary.byStatus.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution Chart */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Requests by Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {summary.byStatus.map((item) => (
                  <div key={item.status} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{item.status}</span>
                      <span className="text-muted-foreground">
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Period Distribution Chart */}
          {summary.byPeriod && summary.byPeriod.length > 0 && (
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Requests Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-end gap-2">
                  {summary.byPeriod.map((item, index) => {
                    const maxCount = Math.max(...summary.byPeriod!.map((p) => p.count));
                    const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                    return (
                      <div
                        key={item.period}
                        className="flex-1 flex flex-col items-center gap-1"
                      >
                        <div
                          className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                          style={{ height: `${height}%`, minHeight: item.count > 0 ? "4px" : "0" }}
                          title={`${item.period}: ${item.count}`}
                        />
                        <span className="text-[10px] text-muted-foreground rotate-[-45deg] whitespace-nowrap">
                          {item.period}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Data Table */}
      <Card className="card-elevated">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Detailed Data
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Generated: {new Date(meta.generatedAt).toLocaleString()} |{" "}
              {meta.dateRange.start} to {meta.dateRange.end}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {tableData.length > 0 &&
                    Object.keys(tableData[0]).map((key) => (
                      <th
                        key={key}
                        className="text-left p-2 font-semibold cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => onSort(key)}
                      >
                        <div className="flex items-center gap-1">
                          {formatColumnName(key)}
                          {sortColumn === key && (
                            <span className="text-primary">
                              {sortDirection === "asc" ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, index) => (
                  <tr
                    key={index}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    {Object.entries(row).map(([key, value], cellIndex) => (
                      <td key={cellIndex} className="p-2">
                        {formatCellValue(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {tableData.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No data available for this report
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface SummaryCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
  bgColor: string;
}

function SummaryCard({ icon: Icon, label, value, color, bgColor }: SummaryCardProps) {
  return (
    <Card className="card-elevated">
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
              bgColor
            )}
          >
            <Icon className={cn("h-5 w-5", color)} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-lg font-bold truncate">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatColumnName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .replace(/Id$/, "ID")
    .trim();
}

function formatCellValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toFixed(1);
  }
  return String(value);
}
