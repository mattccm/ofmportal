"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Download,
  FileText,
  Loader2,
  Users,
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileJson,
  File,
  Play,
  Upload,
  BarChart3,
  GripVertical,
  X,
  Plus,
  Trash2,
  Eye,
  ArrowRight,
  Check,
} from "lucide-react";

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

interface ExportBuilderProps {
  creators: Creator[];
  requests: Request[];
  onExport: (config: ExportConfig) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
  onConfigChange?: (config: ExportConfig | null) => void;
}

interface ExportConfig {
  entity: EntityType;
  fields: string[];
  filters: ExportFilters;
  format: ExportFormat;
  name?: string;
}

interface ExportFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  creatorIds?: string[];
  statuses?: string[];
  conditions?: FilterCondition[];
}

interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

type EntityType = "creators" | "requests" | "uploads" | "analytics";
type ExportFormat = "csv" | "excel" | "json" | "pdf";
type FilterOperator = "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";

// Field definitions for each entity
const ENTITY_FIELDS: Record<EntityType, { key: string; label: string; type: "string" | "number" | "date" | "boolean" }[]> = {
  creators: [
    { key: "id", label: "ID", type: "string" },
    { key: "name", label: "Name", type: "string" },
    { key: "email", label: "Email", type: "string" },
    { key: "phone", label: "Phone", type: "string" },
    { key: "inviteStatus", label: "Invite Status", type: "string" },
    { key: "preferredContact", label: "Preferred Contact", type: "string" },
    { key: "timezone", label: "Timezone", type: "string" },
    { key: "lastLoginAt", label: "Last Login", type: "date" },
    { key: "createdAt", label: "Created At", type: "date" },
    { key: "updatedAt", label: "Updated At", type: "date" },
    { key: "totalRequests", label: "Total Requests", type: "number" },
    { key: "totalUploads", label: "Total Uploads", type: "number" },
  ],
  requests: [
    { key: "id", label: "ID", type: "string" },
    { key: "title", label: "Title", type: "string" },
    { key: "description", label: "Description", type: "string" },
    { key: "creatorName", label: "Creator Name", type: "string" },
    { key: "creatorEmail", label: "Creator Email", type: "string" },
    { key: "status", label: "Status", type: "string" },
    { key: "urgency", label: "Urgency", type: "string" },
    { key: "dueDate", label: "Due Date", type: "date" },
    { key: "submittedAt", label: "Submitted At", type: "date" },
    { key: "reviewedAt", label: "Reviewed At", type: "date" },
    { key: "createdAt", label: "Created At", type: "date" },
    { key: "updatedAt", label: "Updated At", type: "date" },
    { key: "uploadCount", label: "Upload Count", type: "number" },
    { key: "commentCount", label: "Comment Count", type: "number" },
  ],
  uploads: [
    { key: "id", label: "ID", type: "string" },
    { key: "fileName", label: "File Name", type: "string" },
    { key: "originalName", label: "Original Name", type: "string" },
    { key: "fileType", label: "File Type", type: "string" },
    { key: "fileSize", label: "File Size", type: "number" },
    { key: "creatorName", label: "Creator Name", type: "string" },
    { key: "creatorEmail", label: "Creator Email", type: "string" },
    { key: "requestTitle", label: "Request Title", type: "string" },
    { key: "uploadStatus", label: "Upload Status", type: "string" },
    { key: "approvalStatus", label: "Approval Status", type: "string" },
    { key: "reviewNote", label: "Review Note", type: "string" },
    { key: "rating", label: "Rating", type: "number" },
    { key: "uploadedAt", label: "Uploaded At", type: "date" },
    { key: "createdAt", label: "Created At", type: "date" },
  ],
  analytics: [
    { key: "period", label: "Period", type: "string" },
    { key: "totalRequests", label: "Total Requests", type: "number" },
    { key: "completedRequests", label: "Completed Requests", type: "number" },
    { key: "pendingRequests", label: "Pending Requests", type: "number" },
    { key: "totalUploads", label: "Total Uploads", type: "number" },
    { key: "approvedUploads", label: "Approved Uploads", type: "number" },
    { key: "rejectedUploads", label: "Rejected Uploads", type: "number" },
    { key: "avgResponseTime", label: "Avg Response Time (hrs)", type: "number" },
    { key: "avgApprovalRate", label: "Avg Approval Rate (%)", type: "number" },
    { key: "activeCreators", label: "Active Creators", type: "number" },
    { key: "newCreators", label: "New Creators", type: "number" },
  ],
};

const ENTITY_OPTIONS: { value: EntityType; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { value: "creators", label: "Creators", icon: Users, description: "Creator profiles and contact info" },
  { value: "requests", label: "Requests", icon: FileText, description: "Content requests and their status" },
  { value: "uploads", label: "Uploads", icon: Upload, description: "Uploaded files and review status" },
  { value: "analytics", label: "Analytics", icon: BarChart3, description: "Performance metrics and stats" },
];

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { value: "csv", label: "CSV", icon: FileText, description: "Best for spreadsheets" },
  { value: "excel", label: "Excel", icon: FileSpreadsheet, description: "Rich formatting support" },
  { value: "json", label: "JSON", icon: FileJson, description: "Best for developers" },
  { value: "pdf", label: "PDF", icon: File, description: "Best for sharing" },
];

const FILTER_OPERATORS: { value: FilterOperator; label: string; types: ("string" | "number" | "date" | "boolean")[] }[] = [
  { value: "equals", label: "Equals", types: ["string", "number", "date", "boolean"] },
  { value: "not_equals", label: "Not Equals", types: ["string", "number", "date", "boolean"] },
  { value: "contains", label: "Contains", types: ["string"] },
  { value: "greater_than", label: "Greater Than", types: ["number", "date"] },
  { value: "less_than", label: "Less Than", types: ["number", "date"] },
  { value: "is_empty", label: "Is Empty", types: ["string", "number", "date"] },
  { value: "is_not_empty", label: "Is Not Empty", types: ["string", "number", "date"] },
];

const STATUS_OPTIONS = [
  "DRAFT", "PENDING", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "NEEDS_REVISION", "APPROVED", "CANCELLED", "ARCHIVED"
];

export function ExportBuilder({
  creators,
  requests,
  onExport,
  onClose,
  isLoading,
  onConfigChange,
}: ExportBuilderProps) {
  // Current step
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Configuration state
  const [entity, setEntity] = useState<EntityType>("creators");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [selectedCreators, setSelectedCreators] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);

  // Drag state for field reordering
  const [draggedField, setDraggedField] = useState<string | null>(null);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);

  // Available fields for current entity
  const availableFields = useMemo(() => ENTITY_FIELDS[entity], [entity]);

  // Initialize with some default fields when entity changes
  useEffect(() => {
    const defaultFields = availableFields.slice(0, 5).map((f) => f.key);
    setSelectedFields(defaultFields);
    setFilterConditions([]);
    setSelectedCreators([]);
    setSelectedStatuses([]);
  }, [entity, availableFields]);

  // Notify parent of config changes
  useEffect(() => {
    if (onConfigChange) {
      const config: ExportConfig = {
        entity,
        fields: selectedFields,
        filters: buildFilters(),
        format,
      };
      onConfigChange(config);
    }
  }, [entity, selectedFields, format, dateRangeStart, dateRangeEnd, selectedCreators, selectedStatuses, filterConditions]);

  const buildFilters = (): ExportFilters => {
    const filters: ExportFilters = {};

    if (dateRangeStart || dateRangeEnd) {
      filters.dateRange = {
        start: dateRangeStart,
        end: dateRangeEnd,
      };
    }

    if (selectedCreators.length > 0) {
      filters.creatorIds = selectedCreators;
    }

    if (selectedStatuses.length > 0) {
      filters.statuses = selectedStatuses;
    }

    if (filterConditions.length > 0) {
      filters.conditions = filterConditions;
    }

    return filters;
  };

  const handleFieldToggle = (fieldKey: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldKey)
        ? prev.filter((f) => f !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  const handleFieldDragStart = (fieldKey: string) => {
    setDraggedField(fieldKey);
  };

  const handleFieldDragOver = (e: React.DragEvent, targetFieldKey: string) => {
    e.preventDefault();
    if (!draggedField || draggedField === targetFieldKey) return;

    const newFields = [...selectedFields];
    const draggedIndex = newFields.indexOf(draggedField);
    const targetIndex = newFields.indexOf(targetFieldKey);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      newFields.splice(draggedIndex, 1);
      newFields.splice(targetIndex, 0, draggedField);
      setSelectedFields(newFields);
    }
  };

  const handleFieldDragEnd = () => {
    setDraggedField(null);
  };

  const addFilterCondition = () => {
    const newCondition: FilterCondition = {
      id: crypto.randomUUID(),
      field: availableFields[0]?.key || "",
      operator: "equals",
      value: "",
    };
    setFilterConditions((prev) => [...prev, newCondition]);
  };

  const updateFilterCondition = (id: string, updates: Partial<FilterCondition>) => {
    setFilterConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const removeFilterCondition = (id: string) => {
    setFilterConditions((prev) => prev.filter((c) => c.id !== id));
  };

  const getFieldType = (fieldKey: string): "string" | "number" | "date" | "boolean" => {
    const field = availableFields.find((f) => f.key === fieldKey);
    return field?.type || "string";
  };

  const handleExport = async () => {
    const config: ExportConfig = {
      entity,
      fields: selectedFields,
      filters: buildFilters(),
      format,
    };
    await onExport(config);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!entity;
      case 2:
        return selectedFields.length > 0;
      case 3:
        return true; // Filters are optional
      case 4:
        return !!format;
      default:
        return false;
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3, 4].map((step) => (
        <React.Fragment key={step}>
          <button
            onClick={() => setCurrentStep(step as 1 | 2 | 3 | 4)}
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium transition-all",
              currentStep === step
                ? "bg-primary text-primary-foreground"
                : currentStep > step
                ? "bg-emerald-500 text-white"
                : "bg-muted text-muted-foreground"
            )}
          >
            {currentStep > step ? <Check className="h-5 w-5" /> : step}
          </button>
          {step < 4 && (
            <div
              className={cn(
                "h-0.5 w-8",
                currentStep > step ? "bg-emerald-500" : "bg-muted"
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">Select Data Type</h3>
        <p className="text-sm text-muted-foreground">
          Choose what type of data you want to export
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {ENTITY_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setEntity(option.value)}
            className={cn(
              "p-4 rounded-xl border-2 text-left transition-all",
              "hover:border-primary/50 hover:shadow-md",
              entity === option.value
                ? "border-primary bg-primary/5"
                : "border-border"
            )}
          >
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <option.icon className="h-6 w-6 text-primary" />
            </div>
            <h4 className="font-semibold text-sm">{option.label}</h4>
            <p className="text-xs text-muted-foreground mt-1">
              {option.description}
            </p>
            {entity === option.value && (
              <div className="absolute top-3 right-3">
                <div className="h-2 w-2 rounded-full bg-primary" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">Select Fields</h3>
        <p className="text-sm text-muted-foreground">
          Choose and reorder the fields to include in your export
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Fields */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Available Fields</Label>
          <div className="border rounded-lg p-3 max-h-[300px] overflow-y-auto space-y-2">
            {availableFields.map((field) => {
              const isSelected = selectedFields.includes(field.key);
              return (
                <label
                  key={field.key}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                    isSelected ? "bg-primary/10" : "hover:bg-muted"
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleFieldToggle(field.key)}
                  />
                  <span className="flex-1 text-sm">{field.label}</span>
                  <Badge variant="outline" className="text-xs">
                    {field.type}
                  </Badge>
                </label>
              );
            })}
          </div>
        </div>

        {/* Selected Fields (Reorderable) */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            Selected Fields ({selectedFields.length})
          </Label>
          <div className="border rounded-lg p-3 max-h-[300px] overflow-y-auto">
            {selectedFields.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No fields selected
              </div>
            ) : (
              <div className="space-y-2">
                {selectedFields.map((fieldKey, index) => {
                  const field = availableFields.find((f) => f.key === fieldKey);
                  if (!field) return null;
                  return (
                    <div
                      key={fieldKey}
                      draggable
                      onDragStart={() => handleFieldDragStart(fieldKey)}
                      onDragOver={(e) => handleFieldDragOver(e, fieldKey)}
                      onDragEnd={handleFieldDragEnd}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg bg-muted/50 cursor-move transition-colors",
                        draggedField === fieldKey && "opacity-50"
                      )}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground w-6">
                        {index + 1}.
                      </span>
                      <span className="flex-1 text-sm">{field.label}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleFieldToggle(fieldKey)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Drag fields to reorder. Order determines column order in export.
          </p>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">Apply Filters</h3>
        <p className="text-sm text-muted-foreground">
          Optionally filter the data to export
        </p>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Date Range
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Start Date</Label>
              <Input
                type="date"
                value={dateRangeStart}
                onChange={(e) => setDateRangeStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">End Date</Label>
              <Input
                type="date"
                value={dateRangeEnd}
                onChange={(e) => setDateRangeEnd(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Creator Filter (for requests/uploads) */}
      {(entity === "requests" || entity === "uploads") && creators.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Filter by Creator
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3">
            <div className="max-h-32 overflow-y-auto space-y-2">
              {creators.map((creator) => (
                <label
                  key={creator.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedCreators.includes(creator.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedCreators((prev) => [...prev, creator.id]);
                      } else {
                        setSelectedCreators((prev) =>
                          prev.filter((id) => id !== creator.id)
                        );
                      }
                    }}
                  />
                  <span className="text-sm">{creator.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({creator.email})
                  </span>
                </label>
              ))}
            </div>
            {selectedCreators.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setSelectedCreators([])}
              >
                Clear selection
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status Filter (for requests/uploads) */}
      {(entity === "requests" || entity === "uploads") && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              Filter by Status
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3">
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((status) => (
                <label
                  key={status}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors",
                    selectedStatuses.includes(status)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted"
                  )}
                >
                  <Checkbox
                    checked={selectedStatuses.includes(status)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedStatuses((prev) => [...prev, status]);
                      } else {
                        setSelectedStatuses((prev) =>
                          prev.filter((s) => s !== status)
                        );
                      }
                    }}
                    className="sr-only"
                  />
                  <span className="text-xs font-medium">{status}</span>
                </label>
              ))}
            </div>
            {selectedStatuses.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setSelectedStatuses([])}
              >
                Clear selection
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Custom Filter Conditions */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              Custom Conditions
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={addFilterCondition}
              className="gap-1"
            >
              <Plus className="h-3 w-3" />
              Add Condition
            </Button>
          </div>
        </CardHeader>
        {filterConditions.length > 0 && (
          <CardContent className="py-3 space-y-3">
            {filterConditions.map((condition, index) => (
              <div key={condition.id} className="flex items-center gap-2">
                {index > 0 && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    AND
                  </Badge>
                )}
                <Select
                  value={condition.field}
                  onValueChange={(v) =>
                    updateFilterCondition(condition.id, { field: v })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Field" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map((field) => (
                      <SelectItem key={field.key} value={field.key}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={condition.operator}
                  onValueChange={(v) =>
                    updateFilterCondition(condition.id, {
                      operator: v as FilterOperator,
                    })
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Operator" />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_OPERATORS.filter((op) =>
                      op.types.includes(getFieldType(condition.field))
                    ).map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!["is_empty", "is_not_empty"].includes(condition.operator) && (
                  <Input
                    value={condition.value}
                    onChange={(e) =>
                      updateFilterCondition(condition.id, {
                        value: e.target.value,
                      })
                    }
                    placeholder="Value"
                    className="flex-1"
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFilterCondition(condition.id)}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        )}
      </Card>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">Choose Format</h3>
        <p className="text-sm text-muted-foreground">
          Select your preferred export format
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {FORMAT_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setFormat(option.value)}
            className={cn(
              "p-4 rounded-xl border-2 text-left transition-all",
              "hover:border-primary/50 hover:shadow-md",
              format === option.value
                ? "border-primary bg-primary/5"
                : "border-border"
            )}
          >
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <option.icon className="h-6 w-6 text-primary" />
            </div>
            <h4 className="font-semibold text-sm">{option.label}</h4>
            <p className="text-xs text-muted-foreground mt-1">
              {option.description}
            </p>
            {format === option.value && (
              <div className="absolute top-3 right-3">
                <div className="h-2 w-2 rounded-full bg-primary" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Export Summary */}
      <Card className="mt-6">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">Export Summary</CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data Type:</span>
              <span className="font-medium capitalize">{entity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fields:</span>
              <span className="font-medium">{selectedFields.length} selected</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Filters:</span>
              <span className="font-medium">
                {filterConditions.length + (dateRangeStart ? 1 : 0) + (selectedCreators.length > 0 ? 1 : 0) + (selectedStatuses.length > 0 ? 1 : 0)} applied
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Format:</span>
              <span className="font-medium uppercase">{format}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Custom Export Builder</DialogTitle>
          <DialogDescription>
            Build your custom data export step by step
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {renderStepIndicator()}

          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button
                variant="outline"
                onClick={() => setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4)}
              >
                Back
              </Button>
            )}
            {currentStep < 4 ? (
              <Button
                onClick={() => setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4)}
                disabled={!canProceed()}
                className="gap-2"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleExport}
                disabled={isLoading || !canProceed()}
                className="gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export Now
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
