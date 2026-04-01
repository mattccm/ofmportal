"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  Check,
  X,
  AlertCircle,
  Loader2,
  Download,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  SkipForward,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ColumnMapper,
  ColumnMapping,
  CreatorField,
  CREATOR_FIELDS,
  autoDetectMapping,
} from "./column-mapper";

// Wizard steps
const STEPS = [
  { id: 1, name: "Upload", description: "Upload CSV file" },
  { id: 2, name: "Map Columns", description: "Match columns to fields" },
  { id: 3, name: "Preview", description: "Review and validate" },
  { id: 4, name: "Import", description: "Import creators" },
] as const;

type Step = (typeof STEPS)[number]["id"];

interface ParsedData {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
}

interface ValidationResult {
  valid: boolean;
  row: number;
  data: Record<string, string>;
  errors: string[];
}

interface ImportResult {
  created: Array<{ name: string; email: string }>;
  updated: Array<{ name: string; email: string }>;
  skipped: Array<{ name: string; email: string; reason: string }>;
  errors: Array<{ row: number; name: string; email: string; error: string }>;
}

interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export function ImportWizard() {
  const router = useRouter();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Step 1: File upload state
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Step 2: Column mapping state
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});

  // Step 3: Validation state
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [duplicateHandling, setDuplicateHandling] = useState<"skip" | "update">("skip");
  const [sendInvites, setSendInvites] = useState(true);

  // Step 4: Import state
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setParseError(null);
    setParseLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/creators/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to parse CSV");
      }

      setParsedData(data);

      // Auto-detect column mapping
      const autoMapping = autoDetectMapping(data.headers);
      setColumnMapping(autoMapping);

      toast.success(`Successfully parsed ${data.rowCount} rows`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to parse CSV";
      setParseError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setParseLoading(false);
    }
  }, []);

  // Handle file drop
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile && (droppedFile.name.endsWith(".csv") || droppedFile.type === "text/csv")) {
        handleFileSelect(droppedFile);
      } else {
        toast.error("Please drop a CSV file");
      }
    },
    [handleFileSelect]
  );

  // Check if required fields are mapped
  const hasRequiredMappings = useMemo(() => {
    const mappedFields = new Set(Object.values(columnMapping).filter((v) => v !== ""));
    return CREATOR_FIELDS.filter((f) => f.required).every((f) => mappedFields.has(f.key));
  }, [columnMapping]);

  // Transform rows based on mapping
  const transformedRows = useMemo(() => {
    if (!parsedData) return [];

    return parsedData.rows.map((row) => {
      const transformed: Record<string, string> = {};

      for (const [sourceColumn, targetField] of Object.entries(columnMapping)) {
        if (targetField) {
          transformed[targetField] = row[sourceColumn] || "";
        }
      }

      return transformed;
    });
  }, [parsedData, columnMapping]);

  // Validate transformed rows
  const validateRows = useCallback(() => {
    const results: ValidationResult[] = transformedRows.map((row, index) => {
      const errors: string[] = [];

      // Validate name
      if (!row.name || row.name.trim().length < 2) {
        errors.push("Name must be at least 2 characters");
      }

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!row.email || !emailRegex.test(row.email.trim())) {
        errors.push("Invalid email address");
      }

      // Validate preferred contact if provided
      if (row.preferredContact && !["EMAIL", "SMS", "BOTH"].includes(row.preferredContact.toUpperCase())) {
        errors.push("Preferred contact must be EMAIL, SMS, or BOTH");
      }

      return {
        valid: errors.length === 0,
        row: index + 1,
        data: row,
        errors,
      };
    });

    setValidationResults(results);
    return results;
  }, [transformedRows]);

  // Handle step navigation
  const goToStep = (step: Step) => {
    if (step === 3 && parsedData) {
      // Validate when entering preview step
      validateRows();
    }
    setCurrentStep(step);
  };

  const canProceed = (step: Step): boolean => {
    switch (step) {
      case 1:
        return parsedData !== null && !parseLoading;
      case 2:
        return hasRequiredMappings;
      case 3:
        return validationResults.some((r) => r.valid);
      case 4:
        return true;
      default:
        return false;
    }
  };

  // Handle import
  const handleImport = async () => {
    const validRows = validationResults.filter((r) => r.valid);

    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setImporting(true);
    setImportProgress(0);

    try {
      // Transform data for API
      const creators = validRows.map((r) => ({
        name: r.data.name.trim(),
        email: r.data.email.trim().toLowerCase(),
        phone: r.data.phone?.trim() || null,
        preferredContact: (r.data.preferredContact?.toUpperCase() as "EMAIL" | "SMS" | "BOTH") || "EMAIL",
        notes: r.data.notes?.trim() || null,
      }));

      // Simulate progress for UX
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch("/api/creators/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creators,
          duplicateHandling,
          sendInvites,
        }),
      });

      clearInterval(progressInterval);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import failed");
      }

      setImportProgress(100);
      setImportResults(data.results);
      setImportSummary(data.summary);

      toast.success(`Successfully imported ${data.summary.created} creators`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Import failed";
      toast.error(errorMessage);
      setImportProgress(0);
    } finally {
      setImporting(false);
    }
  };

  // Download template
  const downloadTemplate = async () => {
    try {
      const response = await fetch("/api/creators/import");
      if (!response.ok) throw new Error("Failed to download template");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "creator_import_template.csv";
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success("Template downloaded");
    } catch {
      toast.error("Failed to download template");
    }
  };

  // Render step indicator
  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  currentStep === step.id
                    ? "bg-primary text-primary-foreground"
                    : currentStep > step.id
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {currentStep > step.id ? (
                  <Check className="w-5 h-5" />
                ) : (
                  step.id
                )}
              </div>
              <div className="mt-2 text-center">
                <p
                  className={cn(
                    "text-sm font-medium",
                    currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.name}
                </p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {step.description}
                </p>
              </div>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-12 sm:w-24 h-0.5 mx-2",
                  currentStep > step.id ? "bg-green-500" : "bg-muted"
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Render Step 1: Upload
  const renderUploadStep = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload CSV File</CardTitle>
          <CardDescription>
            Upload a CSV file containing creator information. Download the template for the correct format.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Download template */}
          <Button variant="outline" onClick={downloadTemplate} className="w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" />
            Download Template
          </Button>

          {/* File drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              parseLoading
                ? "border-primary bg-primary/5"
                : parseError
                ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                : parsedData
                ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                : "border-muted-foreground/25 hover:border-primary/50"
            )}
          >
            {parseLoading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Parsing CSV file...</p>
              </div>
            ) : parsedData ? (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">
                    {file?.name}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {parsedData.rowCount} rows found with {parsedData.headers.length} columns
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setParsedData(null);
                    setColumnMapping({});
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              </div>
            ) : parseError ? (
              <div className="flex flex-col items-center gap-3">
                <XCircle className="w-10 h-10 text-red-500" />
                <div>
                  <p className="font-medium text-red-700 dark:text-red-400">
                    Failed to parse file
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{parseError}</p>
                </div>
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Try Again
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0];
                      if (selectedFile) handleFileSelect(selectedFile);
                    }}
                  />
                </label>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 rounded-full bg-muted">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Drop your CSV file here or click to browse</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Maximum file size: 5MB
                    </p>
                  </div>
                </div>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (selectedFile) handleFileSelect(selectedFile);
                  }}
                />
              </label>
            )}
          </div>
        </CardContent>
      </Card>

      {/* File format info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSV Format Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <FileSpreadsheet className="w-4 h-4 mt-0.5 text-primary" />
              <span>First row must contain column headers</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 mt-0.5 text-green-500" />
              <span>Required fields: <strong>Name</strong> and <strong>Email</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 mt-0.5 text-green-500" />
              <span>Optional fields: Phone, Preferred Contact (EMAIL/SMS/BOTH), Notes</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 text-yellow-500" />
              <span>Duplicate emails in your agency will be skipped or updated based on your settings</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );

  // Render Step 2: Column Mapping
  const renderMappingStep = () => {
    if (!parsedData) return null;

    return (
      <ColumnMapper
        headers={parsedData.headers}
        sampleData={parsedData.rows.slice(0, 5)}
        mapping={columnMapping}
        onMappingChange={setColumnMapping}
      />
    );
  };

  // Render Step 3: Preview & Validate
  const renderPreviewStep = () => {
    const validCount = validationResults.filter((r) => r.valid).length;
    const invalidCount = validationResults.filter((r) => !r.valid).length;

    return (
      <div className="space-y-6">
        {/* Validation summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Validation Summary</CardTitle>
            <CardDescription>
              Review the validation results before importing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">{validCount}</p>
                  <p className="text-xs text-muted-foreground">Valid rows</p>
                </div>
              </div>
              {invalidCount > 0 && (
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-400">{invalidCount}</p>
                    <p className="text-xs text-muted-foreground">Invalid rows</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Import options */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="duplicate-handling">Duplicate Email Handling</Label>
              <Select
                value={duplicateHandling}
                onValueChange={(value: "skip" | "update") => setDuplicateHandling(value)}
              >
                <SelectTrigger className="w-full sm:w-[300px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">
                    <div className="flex items-center gap-2">
                      <SkipForward className="w-4 h-4" />
                      <span>Skip duplicates</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="update">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" />
                      <span>Update existing creators</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {duplicateHandling === "skip"
                  ? "Creators with emails that already exist will be skipped"
                  : "Existing creators will be updated with the new information"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="send-invites"
                checked={sendInvites}
                onCheckedChange={(checked) => setSendInvites(checked === true)}
              />
              <div>
                <Label htmlFor="send-invites" className="cursor-pointer">
                  Send invitation emails
                </Label>
                <p className="text-xs text-muted-foreground">
                  New creators will receive an email invitation to set up their portal
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Preview</CardTitle>
            <CardDescription>
              Showing first 10 rows. {invalidCount > 0 && "Invalid rows are highlighted in red."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-16">Status</TableHead>
                    {CREATOR_FIELDS.map((field) => (
                      <TableHead key={field.key}>{field.label}</TableHead>
                    ))}
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationResults.slice(0, 10).map((result) => (
                    <TableRow
                      key={result.row}
                      className={cn(!result.valid && "bg-red-50 dark:bg-red-900/20")}
                    >
                      <TableCell className="font-mono text-xs">{result.row}</TableCell>
                      <TableCell>
                        {result.valid ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </TableCell>
                      {CREATOR_FIELDS.map((field) => (
                        <TableCell key={field.key} className="max-w-[150px] truncate">
                          {result.data[field.key] || (
                            <span className="text-muted-foreground italic">-</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell>
                        {result.errors.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {result.errors.map((error, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-xs bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                              >
                                {error}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {validationResults.length > 10 && (
              <div className="p-3 text-center text-sm text-muted-foreground border-t">
                ... and {validationResults.length - 10} more rows
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Render Step 4: Import & Review
  const renderImportStep = () => {
    const validCount = validationResults.filter((r) => r.valid).length;

    if (importResults && importSummary) {
      // Import complete - show results
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle>Import Complete</CardTitle>
                  <CardDescription>
                    Successfully processed {importSummary.total} creators
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {importSummary.created}
                  </p>
                  <p className="text-sm text-muted-foreground">Created</p>
                </div>
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {importSummary.updated}
                  </p>
                  <p className="text-sm text-muted-foreground">Updated</p>
                </div>
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                    {importSummary.skipped}
                  </p>
                  <p className="text-sm text-muted-foreground">Skipped</p>
                </div>
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {importSummary.errors}
                  </p>
                  <p className="text-sm text-muted-foreground">Errors</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Created creators */}
          {importResults.created.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Created Creators ({importResults.created.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResults.created.slice(0, 10).map((creator, i) => (
                      <TableRow key={i}>
                        <TableCell>{creator.name}</TableCell>
                        <TableCell>{creator.email}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {importResults.created.length > 10 && (
                  <div className="p-3 text-center text-sm text-muted-foreground border-t">
                    ... and {importResults.created.length - 10} more
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Skipped creators */}
          {importResults.skipped.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <SkipForward className="w-5 h-5 text-yellow-500" />
                  Skipped Creators ({importResults.skipped.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResults.skipped.slice(0, 10).map((creator, i) => (
                      <TableRow key={i}>
                        <TableCell>{creator.name}</TableCell>
                        <TableCell>{creator.email}</TableCell>
                        <TableCell className="text-muted-foreground">{creator.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {importResults.skipped.length > 10 && (
                  <div className="p-3 text-center text-sm text-muted-foreground border-t">
                    ... and {importResults.skipped.length - 10} more
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Errors */}
          {importResults.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  Errors ({importResults.errors.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResults.errors.map((error, i) => (
                      <TableRow key={i}>
                        <TableCell>{error.row}</TableCell>
                        <TableCell>{error.name}</TableCell>
                        <TableCell>{error.email}</TableCell>
                        <TableCell className="text-red-600 dark:text-red-400">
                          {error.error}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={() => router.push("/dashboard/creators")}>
              <Users className="w-4 h-4 mr-2" />
              View All Creators
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCurrentStep(1);
                setFile(null);
                setParsedData(null);
                setColumnMapping({});
                setValidationResults([]);
                setImportResults(null);
                setImportSummary(null);
              }}
            >
              Import More
            </Button>
          </div>
        </div>
      );
    }

    // Import in progress or ready to import
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Ready to Import</CardTitle>
            <CardDescription>
              {validCount} creator{validCount !== 1 ? "s" : ""} will be imported
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {importing ? (
              <div className="space-y-4">
                <Progress value={importProgress}>
                  <ProgressLabel>Importing creators...</ProgressLabel>
                  <ProgressValue />
                </Progress>
                <p className="text-sm text-muted-foreground text-center">
                  Please wait while we import your creators...
                </p>
              </div>
            ) : (
              <>
                <div className="p-4 rounded-lg bg-muted">
                  <div className="flex items-center gap-3">
                    <Users className="w-8 h-8 text-primary" />
                    <div>
                      <p className="font-medium">{validCount} creators ready</p>
                      <p className="text-sm text-muted-foreground">
                        {duplicateHandling === "skip"
                          ? "Duplicates will be skipped"
                          : "Duplicates will be updated"}
                        {sendInvites && " | Invites will be sent"}
                      </p>
                    </div>
                  </div>
                </div>
                <Button onClick={handleImport} className="w-full" size="lg">
                  <Upload className="w-4 h-4 mr-2" />
                  Start Import
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderUploadStep();
      case 2:
        return renderMappingStep();
      case 3:
        return renderPreviewStep();
      case 4:
        return renderImportStep();
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step indicator */}
      {renderStepIndicator()}

      {/* Step content */}
      {renderStepContent()}

      {/* Navigation buttons */}
      {!importResults && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => goToStep((currentStep - 1) as Step)}
            disabled={currentStep === 1 || importing}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {currentStep < 4 && (
            <Button
              onClick={() => goToStep((currentStep + 1) as Step)}
              disabled={!canProceed(currentStep) || importing}
            >
              {currentStep === 3 ? "Proceed to Import" : "Next"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
