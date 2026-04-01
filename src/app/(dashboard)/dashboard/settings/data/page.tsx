"use client";

import * as React from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Database,
  HardDrive,
  Clock,
  Trash2,
  Download,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  RefreshCw,
  Archive,
  Sparkles,
  FileDown,
  CheckCircle2,
  XCircle,
  Play,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  StorageUsage,
  type StorageStats,
} from "@/components/settings/storage-usage";
import {
  RetentionPolicyForm,
  type RetentionPolicy,
  type AffectedItem,
  type Creator,
  type Template,
} from "@/components/settings/retention-policy-form";

// Types
interface CleanupJob {
  id: string;
  type: "manual" | "scheduled" | "policy";
  status: "pending" | "running" | "completed" | "failed";
  itemsProcessed: number;
  itemsTotal: number;
  sizeFreed: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface ExportJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed" | "expired";
  requestedAt: string;
  completedAt?: string;
  expiresAt?: string;
  downloadUrl?: string;
  fileSize?: number;
  error?: string;
}

// Default retention policy
const defaultPolicy: RetentionPolicy = {
  enabled: false,
  retentionDays: 90,
  action: "archive",
  applyTo: {
    completedRequests: true,
    cancelledRequests: true,
    archivedRequests: false,
  },
  excludeCreators: [],
  excludeTemplates: [],
};

// Format bytes to human readable
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Format date
function formatDate(date: string | undefined): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DataManagementPage() {
  // State
  const [isLoading, setIsLoading] = React.useState(true);
  const [storageStats, setStorageStats] = React.useState<StorageStats | null>(null);
  const [retentionPolicy, setRetentionPolicy] = React.useState<RetentionPolicy>(defaultPolicy);
  const [creators, setCreators] = React.useState<Creator[]>([]);
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [affectedItems, setAffectedItems] = React.useState<AffectedItem[]>([]);
  const [affectedCount, setAffectedCount] = React.useState(0);
  const [affectedSize, setAffectedSize] = React.useState(0);
  const [cleanupJobs, setCleanupJobs] = React.useState<CleanupJob[]>([]);
  const [exportJobs, setExportJobs] = React.useState<ExportJob[]>([]);

  // Loading states
  const [isSavingPolicy, setIsSavingPolicy] = React.useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
  const [isRunningCleanup, setIsRunningCleanup] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Dialog states
  const [showCleanupDialog, setShowCleanupDialog] = React.useState(false);
  const [showExportDialog, setShowExportDialog] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");

  // Cleanup type selection
  const [cleanupType, setCleanupType] = React.useState<"old-uploads" | "failed-uploads" | "orphaned-files" | "all">("old-uploads");

  // Fetch initial data
  React.useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, policyRes, creatorsRes, templatesRes, jobsRes] = await Promise.all([
          fetch("/api/settings/data?type=storage"),
          fetch("/api/settings/data?type=policy"),
          fetch("/api/creators"),
          fetch("/api/templates"),
          fetch("/api/settings/data?type=jobs"),
        ]);

        if (statsRes.ok) {
          const data = await statsRes.json();
          setStorageStats(data);
        }

        if (policyRes.ok) {
          const data = await policyRes.json();
          if (data.policy) {
            setRetentionPolicy(data.policy);
          }
        }

        if (creatorsRes.ok) {
          const data = await creatorsRes.json();
          setCreators(data.creators || []);
        }

        if (templatesRes.ok) {
          const data = await templatesRes.json();
          setTemplates(data.templates || []);
        }

        if (jobsRes.ok) {
          const data = await jobsRes.json();
          setCleanupJobs(data.cleanupJobs || []);
          setExportJobs(data.exportJobs || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data management settings");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // Save retention policy
  const handleSavePolicy = async () => {
    setIsSavingPolicy(true);
    try {
      const response = await fetch("/api/settings/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "policy", policy: retentionPolicy }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save policy");
      }

      toast.success("Retention policy saved successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save policy");
    } finally {
      setIsSavingPolicy(false);
    }
  };

  // Preview retention policy
  const handlePreviewPolicy = async () => {
    setIsPreviewLoading(true);
    try {
      const response = await fetch("/api/settings/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "preview", policy: retentionPolicy }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to preview policy");
      }

      const data = await response.json();
      setAffectedItems(data.items || []);
      setAffectedCount(data.count || 0);
      setAffectedSize(data.size || 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to preview policy");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Run manual cleanup
  const handleRunCleanup = async () => {
    setIsRunningCleanup(true);
    try {
      const response = await fetch("/api/settings/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "cleanup", cleanupType }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start cleanup");
      }

      const data = await response.json();
      setCleanupJobs((prev) => [data.job, ...prev]);
      setShowCleanupDialog(false);
      toast.success("Cleanup job started successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start cleanup");
    } finally {
      setIsRunningCleanup(false);
    }
  };

  // Request data export
  const handleRequestExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/settings/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "export" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start export");
      }

      const data = await response.json();
      setExportJobs((prev) => [data.job, ...prev]);
      setShowExportDialog(false);
      toast.success("Export job started. You will be notified when it's ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start export");
    } finally {
      setIsExporting(false);
    }
  };

  // Delete all data
  const handleDeleteAllData = async () => {
    if (deleteConfirmText !== "DELETE ALL DATA") {
      toast.error("Please type the confirmation text exactly");
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch("/api/settings/data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText: deleteConfirmText }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete data");
      }

      toast.success("All data has been queued for deletion");
      setShowDeleteDialog(false);
      setDeleteConfirmText("");
      // Refresh storage stats
      const statsRes = await fetch("/api/settings/data?type=storage");
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStorageStats(data);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete data");
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle cleanup recommendation click
  const handleCleanupRecommendation = (action: string) => {
    setCleanupType(action as typeof cleanupType);
    setShowCleanupDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading data management settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 flex items-center justify-center">
            <Database className="h-6 w-6 text-rose-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Data Management</h1>
            <p className="text-muted-foreground">
              Manage storage, retention policies, and data exports
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <Card className="card-elevated overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500" />
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <HardDrive className="h-6 w-6 text-violet-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Storage Used</p>
                <p className="font-semibold">
                  {storageStats ? formatBytes(storageStats.totalUsed) : "N/A"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Retention Policy</p>
                <p className="font-semibold">
                  {retentionPolicy.enabled
                    ? `${retentionPolicy.retentionDays} days`
                    : "Disabled"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <History className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Cleanup</p>
                <p className="font-semibold text-sm">
                  {cleanupJobs.length > 0
                    ? formatDate(cleanupJobs[0].completedAt || cleanupJobs[0].startedAt)
                    : "Never"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="storage" className="space-y-6">
        <TabsList variant="line">
          <TabsTrigger value="storage">
            <HardDrive className="h-4 w-4 mr-2" />
            Storage
          </TabsTrigger>
          <TabsTrigger value="retention">
            <Clock className="h-4 w-4 mr-2" />
            Retention
          </TabsTrigger>
          <TabsTrigger value="cleanup">
            <RefreshCw className="h-4 w-4 mr-2" />
            Cleanup
          </TabsTrigger>
          <TabsTrigger value="export">
            <Download className="h-4 w-4 mr-2" />
            Export
          </TabsTrigger>
        </TabsList>

        {/* Storage Tab */}
        <TabsContent value="storage" className="space-y-6">
          <StorageUsage
            stats={storageStats}
            isLoading={false}
            onCleanupClick={handleCleanupRecommendation}
          />
        </TabsContent>

        {/* Retention Tab */}
        <TabsContent value="retention" className="space-y-6">
          <RetentionPolicyForm
            policy={retentionPolicy}
            creators={creators}
            templates={templates}
            affectedItems={affectedItems}
            affectedCount={affectedCount}
            affectedSize={affectedSize}
            isLoading={false}
            isSaving={isSavingPolicy}
            isPreviewLoading={isPreviewLoading}
            onPolicyChange={setRetentionPolicy}
            onSave={handleSavePolicy}
            onPreview={handlePreviewPolicy}
          />
        </TabsContent>

        {/* Cleanup Tab */}
        <TabsContent value="cleanup" className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <RefreshCw className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <CardTitle>Manual Cleanup</CardTitle>
                    <CardDescription>
                      Run cleanup tasks to free up storage space
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={() => setShowCleanupDialog(true)}>
                  <Play className="h-4 w-4 mr-2" />
                  Run Cleanup
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {cleanupJobs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Size Freed</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cleanupJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium capitalize">
                          {job.type.replace("-", " ")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              job.status === "completed"
                                ? "text-emerald-500 border-emerald-500/30"
                                : job.status === "failed"
                                ? "text-red-500 border-red-500/30"
                                : job.status === "running"
                                ? "text-blue-500 border-blue-500/30"
                                : ""
                            }
                          >
                            {job.status === "completed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {job.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                            {job.status === "running" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {job.itemsProcessed} / {job.itemsTotal}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatBytes(job.sizeFreed)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(job.startedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No cleanup jobs have been run yet</p>
                  <p className="text-sm mt-1">
                    Run a cleanup to free up storage space
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="card-elevated border-red-500/20">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <CardTitle className="text-red-500">Danger Zone</CardTitle>
                  <CardDescription>
                    Irreversible and destructive actions
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-500">Delete All Data</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Permanently delete all requests, uploads, files, and associated data.
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete All
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <FileDown className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <CardTitle>Data Export</CardTitle>
                    <CardDescription>
                      Export all your data in a portable format
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={() => setShowExportDialog(true)}>
                  <Download className="h-4 w-4 mr-2" />
                  Request Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {exportJobs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Requested</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>File Size</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exportJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="text-muted-foreground">
                          {formatDate(job.requestedAt)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              job.status === "completed"
                                ? "text-emerald-500 border-emerald-500/30"
                                : job.status === "failed"
                                ? "text-red-500 border-red-500/30"
                                : job.status === "processing"
                                ? "text-blue-500 border-blue-500/30"
                                : job.status === "expired"
                                ? "text-amber-500 border-amber-500/30"
                                : ""
                            }
                          >
                            {job.status === "completed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {job.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                            {job.status === "processing" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {job.fileSize ? formatBytes(job.fileSize) : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {job.expiresAt ? formatDate(job.expiresAt) : "-"}
                        </TableCell>
                        <TableCell>
                          {job.status === "completed" && job.downloadUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                            >
                              <a href={job.downloadUrl} download>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No exports have been requested yet</p>
                  <p className="text-sm mt-1">
                    Export your data to download a backup
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export Info */}
          <Card className="card-elevated border-blue-500/20 bg-gradient-to-r from-blue-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:to-cyan-950/20 dark:border-blue-800/30">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-700 dark:text-blue-400">
                    What&apos;s Included in the Export
                  </h3>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                    <li>All content requests and their details</li>
                    <li>All uploaded files and media</li>
                    <li>Comments and annotations</li>
                    <li>Creator information</li>
                    <li>Templates and configurations</li>
                    <li>Activity logs and audit trails</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-3">
                    Exports are available for download for 7 days after completion.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Cleanup Dialog */}
      <Dialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Run Manual Cleanup
            </DialogTitle>
            <DialogDescription>
              Select the type of cleanup to perform.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cleanup Type</Label>
              <div className="space-y-2">
                {[
                  { value: "old-uploads", label: "Old Uploads", desc: "Remove uploads older than retention period" },
                  { value: "failed-uploads", label: "Failed Uploads", desc: "Clean up incomplete/failed uploads" },
                  { value: "orphaned-files", label: "Orphaned Files", desc: "Remove files without associated records" },
                  { value: "all", label: "Full Cleanup", desc: "Run all cleanup tasks" },
                ].map((option) => (
                  <div
                    key={option.value}
                    className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                      cleanupType === option.value
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => setCleanupType(option.value as typeof cleanupType)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-4 w-4 rounded-full border-2 ${
                        cleanupType === option.value
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      }`} />
                      <div>
                        <p className="font-medium">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCleanupDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRunCleanup}
              disabled={isRunningCleanup}
              className="btn-gradient"
            >
              {isRunningCleanup ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Start Cleanup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Request Data Export
            </DialogTitle>
            <DialogDescription>
              Export all your data to a downloadable archive.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl bg-muted/50">
              <h4 className="font-medium mb-2">Export Details</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Format: ZIP archive with JSON data</li>
                <li>Includes: All files, requests, comments</li>
                <li>Availability: 7 days after completion</li>
                <li>Estimated time: 5-30 minutes</li>
              </ul>
            </div>

            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  You will receive an email notification when your export is ready for download.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRequestExport}
              disabled={isExporting}
              className="btn-gradient"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Start Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Data Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Delete All Data
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
              <p className="text-sm text-red-500 font-medium mb-2">
                You are about to permanently delete:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>All content requests and their history</li>
                <li>All uploaded files and media</li>
                <li>All comments and annotations</li>
                <li>All creator records</li>
                <li>All templates and configurations</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                Type <span className="font-mono font-bold">DELETE ALL DATA</span> to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE ALL DATA"
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAllData}
              disabled={deleteConfirmText !== "DELETE ALL DATA" || isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
