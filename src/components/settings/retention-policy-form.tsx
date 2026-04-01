"use client";

import * as React from "react";
import {
  Calendar,
  Clock,
  Archive,
  Trash2,
  Users,
  FileText,
  AlertTriangle,
  Info,
  Loader2,
  CheckCircle2,
  Filter,
  Eye,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Types
export interface RetentionPolicy {
  enabled: boolean;
  retentionDays: number;
  action: "archive" | "delete";
  applyTo: {
    completedRequests: boolean;
    cancelledRequests: boolean;
    archivedRequests: boolean;
  };
  excludeCreators: string[];
  excludeTemplates: string[];
}

export interface AffectedItem {
  id: string;
  title: string;
  type: "request" | "upload";
  creator: string;
  completedAt: string;
  size?: number;
  status: string;
}

export interface Creator {
  id: string;
  name: string;
  email: string;
}

export interface Template {
  id: string;
  name: string;
}

interface RetentionPolicyFormProps {
  policy: RetentionPolicy;
  creators: Creator[];
  templates: Template[];
  affectedItems: AffectedItem[];
  affectedCount: number;
  affectedSize: number;
  isLoading: boolean;
  isSaving: boolean;
  isPreviewLoading: boolean;
  onPolicyChange: (policy: RetentionPolicy) => void;
  onSave: () => void;
  onPreview: () => void;
}

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
function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function RetentionPolicyForm({
  policy,
  creators,
  templates,
  affectedItems,
  affectedCount,
  affectedSize,
  isLoading,
  isSaving,
  isPreviewLoading,
  onPolicyChange,
  onSave,
  onPreview,
}: RetentionPolicyFormProps) {
  const [showPreviewDialog, setShowPreviewDialog] = React.useState(false);
  const [showExclusionsDialog, setShowExclusionsDialog] = React.useState(false);
  const [exclusionType, setExclusionType] = React.useState<"creators" | "templates">("creators");

  const handlePolicyUpdate = (updates: Partial<RetentionPolicy>) => {
    onPolicyChange({ ...policy, ...updates });
  };

  const handleApplyToUpdate = (key: keyof RetentionPolicy["applyTo"], value: boolean) => {
    handlePolicyUpdate({
      applyTo: { ...policy.applyTo, [key]: value },
    });
  };

  const handleExclusionToggle = (type: "creators" | "templates", id: string) => {
    const key = type === "creators" ? "excludeCreators" : "excludeTemplates";
    const current = policy[key];
    const updated = current.includes(id)
      ? current.filter((i) => i !== id)
      : [...current, id];
    handlePolicyUpdate({ [key]: updated });
  };

  const handlePreviewClick = () => {
    onPreview();
    setShowPreviewDialog(true);
  };

  if (isLoading) {
    return (
      <Card className="card-elevated">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Policy Card */}
      <Card className="card-elevated">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle>Retention Policy</CardTitle>
                <CardDescription>
                  Automatically clean up old completed requests
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={policy.enabled}
              onCheckedChange={(checked) => handlePolicyUpdate({ enabled: checked })}
            />
          </div>
        </CardHeader>
        <CardContent className={`space-y-6 ${!policy.enabled ? "opacity-50 pointer-events-none" : ""}`}>
          {/* Retention Period */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="retention-days">Auto-cleanup after</Label>
              <div className="flex gap-2">
                <Input
                  id="retention-days"
                  type="number"
                  min={7}
                  max={365}
                  value={policy.retentionDays}
                  onChange={(e) =>
                    handlePolicyUpdate({ retentionDays: parseInt(e.target.value) || 30 })
                  }
                  className="w-24"
                />
                <Select
                  value={policy.retentionDays.toString()}
                  onValueChange={(value) =>
                    handlePolicyUpdate({ retentionDays: parseInt(value) })
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Items older than {policy.retentionDays} days will be processed
              </p>
            </div>

            <div className="space-y-2">
              <Label>Action to perform</Label>
              <Select
                value={policy.action}
                onValueChange={(value: "archive" | "delete") =>
                  handlePolicyUpdate({ action: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="archive">
                    <div className="flex items-center gap-2">
                      <Archive className="h-4 w-4 text-blue-500" />
                      <span>Archive (Recoverable)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="delete">
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-red-500" />
                      <span>Delete Permanently</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {policy.action === "archive"
                  ? "Archived items can be restored within 30 days"
                  : "Deleted items cannot be recovered"}
              </p>
            </div>
          </div>

          {/* Apply To Checkboxes */}
          <div className="space-y-3">
            <Label>Apply to request status</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="apply-completed"
                  checked={policy.applyTo.completedRequests}
                  onCheckedChange={(checked) =>
                    handleApplyToUpdate("completedRequests", checked as boolean)
                  }
                />
                <Label htmlFor="apply-completed" className="font-normal cursor-pointer">
                  Completed requests (approved)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="apply-cancelled"
                  checked={policy.applyTo.cancelledRequests}
                  onCheckedChange={(checked) =>
                    handleApplyToUpdate("cancelledRequests", checked as boolean)
                  }
                />
                <Label htmlFor="apply-cancelled" className="font-normal cursor-pointer">
                  Cancelled requests
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="apply-archived"
                  checked={policy.applyTo.archivedRequests}
                  onCheckedChange={(checked) =>
                    handleApplyToUpdate("archivedRequests", checked as boolean)
                  }
                />
                <Label htmlFor="apply-archived" className="font-normal cursor-pointer">
                  Already archived requests
                </Label>
              </div>
            </div>
          </div>

          {/* Exclusions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Exclusions</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExclusionType("creators");
                    setShowExclusionsDialog(true);
                  }}
                >
                  <Users className="h-4 w-4 mr-1" />
                  Creators ({policy.excludeCreators.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExclusionType("templates");
                    setShowExclusionsDialog(true);
                  }}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Templates ({policy.excludeTemplates.length})
                </Button>
              </div>
            </div>
            {(policy.excludeCreators.length > 0 || policy.excludeTemplates.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {policy.excludeCreators.map((id) => {
                  const creator = creators.find((c) => c.id === id);
                  return creator ? (
                    <Badge key={id} variant="secondary" className="gap-1">
                      <Users className="h-3 w-3" />
                      {creator.name}
                    </Badge>
                  ) : null;
                })}
                {policy.excludeTemplates.map((id) => {
                  const template = templates.find((t) => t.id === id);
                  return template ? (
                    <Badge key={id} variant="secondary" className="gap-1">
                      <FileText className="h-3 w-3" />
                      {template.name}
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
          </div>

          {/* Warning for Delete */}
          {policy.action === "delete" && (
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-red-500">Permanent Deletion Warning</p>
                  <p className="text-muted-foreground mt-1">
                    Items will be permanently deleted and cannot be recovered. All associated
                    uploads and files will also be removed from storage.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Info for Archive */}
          {policy.action === "archive" && (
            <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-500">Archive Behavior</p>
                  <p className="text-muted-foreground mt-1">
                    Archived items will be moved to a separate archive storage. Files remain
                    accessible but won&apos;t count toward active storage limits. Archived items
                    can be restored within 30 days.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview and Save */}
      <Card className="card-elevated">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Eye className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <h4 className="font-semibold">Preview Changes</h4>
                <p className="text-sm text-muted-foreground">
                  See what items would be affected by this policy
                </p>
              </div>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <Button
                variant="outline"
                onClick={handlePreviewClick}
                disabled={!policy.enabled || isPreviewLoading}
                className="flex-1 md:flex-auto"
              >
                {isPreviewLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Filter className="h-4 w-4 mr-2" />
                )}
                Preview
              </Button>
              <Button
                onClick={onSave}
                disabled={isSaving}
                className="flex-1 md:flex-auto btn-gradient"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Save Policy
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Policy Preview
            </DialogTitle>
            <DialogDescription>
              These items would be affected by the current retention policy.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {isPreviewLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-xl">
                  <div>
                    <p className="text-sm text-muted-foreground">Items affected</p>
                    <p className="text-2xl font-bold">{affectedCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Storage to be freed</p>
                    <p className="text-2xl font-bold">{formatBytes(affectedSize)}</p>
                  </div>
                </div>

                {/* Items Table */}
                {affectedItems.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Creator</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Completed</TableHead>
                        <TableHead className="text-right">Size</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {affectedItems.slice(0, 10).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.title}</TableCell>
                          <TableCell className="text-muted-foreground">{item.creator}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.status}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(item.completedAt)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {item.size ? formatBytes(item.size) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No items match the current policy criteria</p>
                  </div>
                )}

                {affectedItems.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Showing 10 of {affectedCount} affected items
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setShowPreviewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exclusions Dialog */}
      <Dialog open={showExclusionsDialog} onOpenChange={setShowExclusionsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {exclusionType === "creators" ? (
                <Users className="h-5 w-5 text-primary" />
              ) : (
                <FileText className="h-5 w-5 text-primary" />
              )}
              Exclude {exclusionType === "creators" ? "Creators" : "Templates"}
            </DialogTitle>
            <DialogDescription>
              {exclusionType === "creators"
                ? "Select creators whose content should be excluded from the retention policy."
                : "Select templates whose requests should be excluded from the retention policy."}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[300px] overflow-auto space-y-2">
            {exclusionType === "creators" ? (
              creators.length > 0 ? (
                creators.map((creator) => (
                  <div
                    key={creator.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleExclusionToggle("creators", creator.id)}
                  >
                    <Checkbox checked={policy.excludeCreators.includes(creator.id)} />
                    <div>
                      <p className="font-medium">{creator.name}</p>
                      <p className="text-sm text-muted-foreground">{creator.email}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">No creators found</p>
              )
            ) : templates.length > 0 ? (
              templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleExclusionToggle("templates", template.id)}
                >
                  <Checkbox checked={policy.excludeTemplates.includes(template.id)} />
                  <p className="font-medium">{template.name}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">No templates found</p>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setShowExclusionsDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RetentionPolicyForm;
