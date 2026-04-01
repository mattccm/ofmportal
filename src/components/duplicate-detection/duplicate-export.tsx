"use client";

import * as React from "react";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Calendar,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { DuplicateAttempt } from "@/types/content-fingerprint";

// ============================================
// TYPES
// ============================================

interface DuplicateExportProps {
  // If provided, export only these attempts
  attempts?: DuplicateAttempt[];
  // Callback for when export completes
  onExport?: (filename: string, count: number) => void;
}

interface ExportOptions {
  format: "csv" | "json";
  dateRange: "all" | "7days" | "30days" | "90days" | "custom";
  startDate: string;
  endDate: string;
  includeFields: {
    creator: boolean;
    fileDetails: boolean;
    matchDetails: boolean;
    overrideInfo: boolean;
  };
  filterAction: "all" | "BLOCKED" | "WARNED" | "ALLOWED" | "OVERRIDDEN";
  filterMatchType: "all" | "EXACT" | "NEAR" | "SIMILAR";
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_OPTIONS: ExportOptions = {
  format: "csv",
  dateRange: "all",
  startDate: "",
  endDate: "",
  includeFields: {
    creator: true,
    fileDetails: true,
    matchDetails: true,
    overrideInfo: true,
  },
  filterAction: "all",
  filterMatchType: "all",
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDateForFilename(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDateForCSV(date: Date | string | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString();
}

function escapeCSVField(field: string | number | undefined | null): string {
  if (field === undefined || field === null) return "";
  const str = String(field);
  // Escape double quotes and wrap in quotes if contains comma, newline, or quote
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getDateRangeFilter(dateRange: ExportOptions["dateRange"]): { start?: Date; end?: Date } {
  const now = new Date();

  switch (dateRange) {
    case "7days":
      return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    case "30days":
      return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    case "90days":
      return { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
    default:
      return {};
  }
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

function generateCSVContent(
  attempts: DuplicateAttempt[],
  options: ExportOptions
): string {
  // Build header row
  const headers: string[] = ["Date", "Action", "Match Type", "Similarity"];

  if (options.includeFields.creator) {
    headers.push("Creator Name", "Creator Email");
  }

  if (options.includeFields.fileDetails) {
    headers.push(
      "Attempted File Name",
      "Attempted File Size (bytes)",
      "Attempted File Type",
      "Original File Name",
      "Original File Size (bytes)",
      "Original Upload Date"
    );
  }

  if (options.includeFields.matchDetails) {
    headers.push("Hash Match", "Perceptual Match", "Metadata Match");
  }

  if (options.includeFields.overrideInfo) {
    headers.push("Override Reason", "Override Date");
  }

  // Build data rows
  const rows: string[][] = attempts.map((attempt) => {
    const row: string[] = [
      formatDateForCSV(attempt.attemptedAt),
      attempt.action,
      attempt.matchType,
      String(attempt.similarity),
    ];

    if (options.includeFields.creator) {
      row.push(
        attempt.creator?.name || "",
        attempt.creator?.email || ""
      );
    }

    if (options.includeFields.fileDetails) {
      row.push(
        attempt.attemptedFileName,
        String(attempt.attemptedFileSize),
        attempt.attemptedFileType,
        attempt.originalFileName,
        String(attempt.originalFileSize),
        formatDateForCSV(attempt.originalUploadedAt)
      );
    }

    if (options.includeFields.matchDetails) {
      row.push(
        attempt.hashMatch ? "Yes" : "No",
        attempt.perceptualMatch ? "Yes" : "No",
        attempt.metadataMatch ? "Yes" : "No"
      );
    }

    if (options.includeFields.overrideInfo) {
      row.push(
        attempt.overrideReason || "",
        formatDateForCSV(attempt.overrideAt)
      );
    }

    return row;
  });

  // Combine headers and rows
  const csvRows = [
    headers.map(escapeCSVField).join(","),
    ...rows.map((row) => row.map(escapeCSVField).join(",")),
  ];

  return csvRows.join("\n");
}

function generateJSONContent(
  attempts: DuplicateAttempt[],
  options: ExportOptions
): string {
  const exportData = attempts.map((attempt) => {
    const item: Record<string, unknown> = {
      date: attempt.attemptedAt,
      action: attempt.action,
      matchType: attempt.matchType,
      similarity: attempt.similarity,
    };

    if (options.includeFields.creator && attempt.creator) {
      item.creator = {
        name: attempt.creator.name,
        email: attempt.creator.email,
      };
    }

    if (options.includeFields.fileDetails) {
      item.attemptedFile = {
        name: attempt.attemptedFileName,
        size: attempt.attemptedFileSize,
        type: attempt.attemptedFileType,
      };
      item.originalFile = {
        name: attempt.originalFileName,
        size: attempt.originalFileSize,
        uploadedAt: attempt.originalUploadedAt,
      };
    }

    if (options.includeFields.matchDetails) {
      item.matchDetails = {
        hashMatch: attempt.hashMatch,
        perceptualMatch: attempt.perceptualMatch,
        metadataMatch: attempt.metadataMatch,
      };
    }

    if (options.includeFields.overrideInfo && attempt.overrideReason) {
      item.override = {
        reason: attempt.overrideReason,
        date: attempt.overrideAt,
      };
    }

    return item;
  });

  return JSON.stringify(exportData, null, 2);
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DuplicateExportDialog({
  attempts: providedAttempts,
  onExport,
}: DuplicateExportProps) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<ExportOptions>(DEFAULT_OPTIONS);
  const [isExporting, setIsExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setSuccess(false);

    try {
      let attempts: DuplicateAttempt[];

      if (providedAttempts) {
        attempts = providedAttempts;
      } else {
        // Fetch all attempts based on filters
        const params = new URLSearchParams({
          limit: "10000",
        });

        if (options.filterAction !== "all") {
          params.set("action", options.filterAction);
        }

        if (options.filterMatchType !== "all") {
          params.set("matchType", options.filterMatchType);
        }

        const dateRange = getDateRangeFilter(options.dateRange);
        if (options.dateRange === "custom") {
          if (options.startDate) params.set("startDate", options.startDate);
          if (options.endDate) params.set("endDate", options.endDate);
        } else if (dateRange.start) {
          params.set("startDate", dateRange.start.toISOString().split("T")[0]);
        }

        const response = await fetch(`/api/duplicate-attempts?${params.toString()}`);

        if (!response.ok) {
          throw new Error("Failed to fetch duplicate attempts");
        }

        const data = await response.json();
        attempts = data.attempts || [];
      }

      // Apply client-side filters if using provided attempts
      let filteredAttempts = attempts;

      if (providedAttempts) {
        if (options.filterAction !== "all") {
          filteredAttempts = filteredAttempts.filter((a) => a.action === options.filterAction);
        }
        if (options.filterMatchType !== "all") {
          filteredAttempts = filteredAttempts.filter((a) => a.matchType === options.filterMatchType);
        }
      }

      if (filteredAttempts.length === 0) {
        setError("No data to export");
        return;
      }

      // Generate content
      const content =
        options.format === "csv"
          ? generateCSVContent(filteredAttempts, options)
          : generateJSONContent(filteredAttempts, options);

      // Generate filename
      const dateStr = formatDateForFilename(new Date());
      const filename = `duplicate-attempts-${dateStr}.${options.format}`;

      // Download
      const mimeType = options.format === "csv" ? "text/csv" : "application/json";
      downloadFile(content, filename, mimeType);

      setSuccess(true);
      onExport?.(filename, filteredAttempts.length);

      // Close dialog after short delay
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const updateIncludeField = (field: keyof ExportOptions["includeFields"], value: boolean) => {
    setOptions({
      ...options,
      includeFields: {
        ...options.includeFields,
        [field]: value,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-indigo-500" />
            Export Duplicate Attempts
          </DialogTitle>
          <DialogDescription>
            Configure export options for the duplicate attempts log
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select
              value={options.format}
              onValueChange={(value) =>
                setOptions({ ...options, format: value as "csv" | "json" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV (Excel compatible)
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    JSON
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Date Range
            </Label>
            <Select
              value={options.dateRange}
              onValueChange={(value) =>
                setOptions({ ...options, dateRange: value as ExportOptions["dateRange"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="90days">Last 90 Days</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {options.dateRange === "custom" && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Input
                  type="date"
                  value={options.startDate}
                  onChange={(e) => setOptions({ ...options, startDate: e.target.value })}
                  placeholder="Start date"
                />
                <Input
                  type="date"
                  value={options.endDate}
                  onChange={(e) => setOptions({ ...options, endDate: e.target.value })}
                  placeholder="End date"
                />
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              Filters
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={options.filterAction}
                onValueChange={(value) =>
                  setOptions({ ...options, filterAction: value as ExportOptions["filterAction"] })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                  <SelectItem value="WARNED">Warned</SelectItem>
                  <SelectItem value="ALLOWED">Allowed</SelectItem>
                  <SelectItem value="OVERRIDDEN">Overridden</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={options.filterMatchType}
                onValueChange={(value) =>
                  setOptions({ ...options, filterMatchType: value as ExportOptions["filterMatchType"] })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Match Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="EXACT">Exact</SelectItem>
                  <SelectItem value="NEAR">Near</SelectItem>
                  <SelectItem value="SIMILAR">Similar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Include Fields */}
          <div className="space-y-3">
            <Label>Include Fields</Label>
            <div className="space-y-2">
              {[
                { key: "creator", label: "Creator Information" },
                { key: "fileDetails", label: "File Details" },
                { key: "matchDetails", label: "Match Details" },
                { key: "overrideInfo", label: "Override Information" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={options.includeFields[key as keyof ExportOptions["includeFields"]]}
                    onCheckedChange={(checked) =>
                      updateIncludeField(key as keyof ExportOptions["includeFields"], !!checked)
                    }
                  />
                  <label
                    htmlFor={key}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-green-600 text-sm p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
              Export completed successfully!
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// QUICK EXPORT BUTTON (for inline use)
// ============================================

export function QuickExportButton({
  attempts,
  className,
}: {
  attempts: DuplicateAttempt[];
  className?: string;
}) {
  const [isExporting, setIsExporting] = React.useState(false);

  const handleQuickExport = async () => {
    if (attempts.length === 0) return;

    setIsExporting(true);

    try {
      const content = generateCSVContent(attempts, DEFAULT_OPTIONS);
      const filename = `duplicate-attempts-${formatDateForFilename(new Date())}.csv`;
      downloadFile(content, filename, "text/csv");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleQuickExport}
      disabled={isExporting || attempts.length === 0}
      className={cn("gap-2", className)}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Export CSV
    </Button>
  );
}

export default DuplicateExportDialog;
