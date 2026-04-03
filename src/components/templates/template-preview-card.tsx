"use client";

import * as React from "react";
import {
  FileText,
  Type,
  AlignLeft,
  Hash,
  Calendar,
  ChevronDown,
  CheckSquare,
  Upload,
  Layers,
  Clock,
  AlertCircle,
  Sparkles,
  Check,
  Eye,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Template, TemplateField, FieldType } from "@/lib/template-types";

// ============================================
// HELPERS
// ============================================

// Helper function to strip HTML tags from text
function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// ============================================
// TYPES
// ============================================

interface TemplatePreviewCardProps {
  template: Template;
  onUseTemplate: () => void;
  onClose?: () => void;
  isLoading?: boolean;
  showFullPreview?: boolean;
  className?: string;
}

// ============================================
// FIELD TYPE CONFIGURATION
// ============================================

const FIELD_TYPE_CONFIG: Record<
  FieldType,
  {
    icon: React.ReactNode;
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  text: {
    icon: <Type className="h-4 w-4" />,
    label: "Text",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  textarea: {
    icon: <AlignLeft className="h-4 w-4" />,
    label: "Long Text",
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
    borderColor: "border-indigo-200 dark:border-indigo-800",
  },
  number: {
    icon: <Hash className="h-4 w-4" />,
    label: "Number",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    borderColor: "border-emerald-200 dark:border-emerald-800",
  },
  date: {
    icon: <Calendar className="h-4 w-4" />,
    label: "Date",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    borderColor: "border-orange-200 dark:border-orange-800",
  },
  select: {
    icon: <ChevronDown className="h-4 w-4" />,
    label: "Dropdown",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
  checkbox: {
    icon: <CheckSquare className="h-4 w-4" />,
    label: "Checkbox",
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-50 dark:bg-pink-950/30",
    borderColor: "border-pink-200 dark:border-pink-800",
  },
  file: {
    icon: <Upload className="h-4 w-4" />,
    label: "File Upload",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
};

const URGENCY_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  LOW: {
    label: "Low",
    color: "text-slate-600",
    bgColor: "bg-slate-100 dark:bg-slate-800",
  },
  NORMAL: {
    label: "Normal",
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/50",
  },
  HIGH: {
    label: "High",
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/50",
  },
  URGENT: {
    label: "Urgent",
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/50",
  },
};

// ============================================
// TEMPLATE PREVIEW CARD COMPONENT
// ============================================

export function TemplatePreviewCard({
  template,
  onUseTemplate,
  onClose,
  isLoading = false,
  showFullPreview = true,
  className,
}: TemplatePreviewCardProps) {
  const [expandedFieldId, setExpandedFieldId] = React.useState<string | null>(null);
  const requiredFields = template.fields.filter((f) => f.required);
  const optionalFields = template.fields.filter((f) => !f.required);
  const urgencyConfig = URGENCY_CONFIG[template.defaultUrgency] || URGENCY_CONFIG.NORMAL;

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className="h-2 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/50 dark:to-violet-900/50 flex items-center justify-center">
              <FileText className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-lg">{template.name}</CardTitle>
              {template.description && (
                <CardDescription className="mt-0.5">
                  {stripHtml(template.description)}
                </CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Eye className="h-3 w-3" />
              Preview
            </Badge>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="flex items-center gap-1.5 text-sm">
            <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
              <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{template.fields.length}</span> fields
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <div className="h-7 w-7 rounded-lg bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center">
              <Clock className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{template.defaultDueDays}</span> day default
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", urgencyConfig.bgColor)}>
              <AlertCircle className={cn("h-4 w-4", urgencyConfig.color)} />
            </div>
            <span className="text-muted-foreground">
              <span className={cn("font-medium", urgencyConfig.color)}>{urgencyConfig.label}</span> urgency
            </span>
          </div>
          {template._count?.requests ? (
            <div className="flex items-center gap-1.5 text-sm">
              <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{template._count.requests}</span> times used
              </span>
            </div>
          ) : null}
        </div>
      </CardHeader>

      {showFullPreview && (
        <CardContent className="space-y-4">
          {/* Required Fields Section */}
          {requiredFields.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">
                  Required Fields
                </span>
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  {requiredFields.length}
                </Badge>
              </div>
              <div className="grid gap-2">
                {requiredFields.map((field) => (
                  <FieldPreviewItem
                    key={field.id}
                    field={field}
                    isExpanded={expandedFieldId === field.id}
                    onToggle={() =>
                      setExpandedFieldId(
                        expandedFieldId === field.id ? null : field.id
                      )
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Optional Fields Section */}
          {optionalFields.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Optional Fields
                </span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {optionalFields.length}
                </Badge>
              </div>
              <div className="grid gap-2">
                {optionalFields.map((field) => (
                  <FieldPreviewItem
                    key={field.id}
                    field={field}
                    isExpanded={expandedFieldId === field.id}
                    onToggle={() =>
                      setExpandedFieldId(
                        expandedFieldId === field.id ? null : field.id
                      )
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Field Type Legend */}
          <div className="pt-3 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Field Types
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(FIELD_TYPE_CONFIG).map(([type, config]) => {
                const count = template.fields.filter((f) => f.type === type).length;
                if (count === 0) return null;
                return (
                  <Badge
                    key={type}
                    variant="outline"
                    className={cn("gap-1 text-[10px]", config.color, config.borderColor)}
                  >
                    {config.icon}
                    {config.label}
                    <span className="ml-1 opacity-60">({count})</span>
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      )}

      {/* Footer with Actions */}
      <CardFooter className="flex-col gap-3 sm:flex-row">
        {onClose && (
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
        )}
        <Button
          onClick={onUseTemplate}
          disabled={isLoading}
          className="w-full sm:flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
        >
          <Check className="h-4 w-4 mr-2" />
          Use This Template
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
}

// ============================================
// FIELD PREVIEW ITEM
// ============================================

interface FieldPreviewItemProps {
  field: TemplateField;
  isExpanded: boolean;
  onToggle: () => void;
}

function FieldPreviewItem({ field, isExpanded, onToggle }: FieldPreviewItemProps) {
  const config = FIELD_TYPE_CONFIG[field.type];

  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-200 cursor-pointer",
        config.borderColor,
        isExpanded ? cn(config.bgColor, "ring-1", config.borderColor) : "hover:bg-muted/50"
      )}
      onClick={onToggle}
    >
      <div className="flex items-center gap-3 p-3">
        <div
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
            config.bgColor,
            config.color
          )}
        >
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{field.label}</p>
            {field.required && (
              <span className="text-red-500 text-xs">*</span>
            )}
            {field.quantity && field.quantity > 1 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                ×{field.quantity}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{config.label}</p>
        </div>
        {field.defaultValue !== undefined && field.defaultValue !== "" && (
          <Badge variant="secondary" className="text-[10px] shrink-0">
            Default set
          </Badge>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 space-y-2 text-sm animate-in slide-in-from-top-2 duration-200">
          {field.placeholder && (
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground text-xs shrink-0">Placeholder:</span>
              <span className="text-xs">{field.placeholder}</span>
            </div>
          )}
          {field.helpText && (
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground text-xs shrink-0">Help text:</span>
              <span className="text-xs">{field.helpText}</span>
            </div>
          )}
          {field.defaultValue !== undefined && field.defaultValue !== "" && (
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground text-xs shrink-0">Default:</span>
              <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                {String(field.defaultValue)}
              </span>
            </div>
          )}
          {field.type === "select" && field.options && field.options.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground text-xs shrink-0">Options:</span>
              <div className="flex flex-wrap gap-1">
                {field.options.map((opt) => (
                  <Badge
                    key={opt.id}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {opt.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {field.type === "file" && (
            <div className="space-y-1">
              {field.acceptedFileTypes && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">Accepted:</span>
                  <span className="text-xs">{field.acceptedFileTypes.join(", ")}</span>
                </div>
              )}
              {field.maxFiles && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">Max files:</span>
                  <span className="text-xs">{field.maxFiles}</span>
                </div>
              )}
              {field.maxFileSize && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">Max size:</span>
                  <span className="text-xs">{Math.round(field.maxFileSize / 1024 / 1024)}MB</span>
                </div>
              )}
            </div>
          )}
          {field.validation && field.validation.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground text-xs shrink-0">Validation:</span>
              <div className="flex flex-wrap gap-1">
                {field.validation.map((rule, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {rule.type}: {String(rule.value)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPACT TEMPLATE PREVIEW (for inline use)
// ============================================

interface CompactTemplatePreviewProps {
  template: Template;
  onUseTemplate?: () => void;
  className?: string;
}

export function CompactTemplatePreview({
  template,
  onUseTemplate,
  className,
}: CompactTemplatePreviewProps) {
  const urgencyConfig = URGENCY_CONFIG[template.defaultUrgency] || URGENCY_CONFIG.NORMAL;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/50 dark:to-violet-900/50 flex items-center justify-center">
          <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{template.name}</p>
          {template.description && (
            <p className="text-sm text-muted-foreground truncate">
              {template.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="gap-1">
          <Layers className="h-3 w-3" />
          {template.fields.length} fields
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          {template.defaultDueDays}d
        </Badge>
        <Badge className={cn("gap-1", urgencyConfig.bgColor, urgencyConfig.color)}>
          {urgencyConfig.label}
        </Badge>
      </div>

      <div className="flex items-center gap-1 pt-2 border-t">
        {template.fields.slice(0, 6).map((field) => {
          const config = FIELD_TYPE_CONFIG[field.type];
          return (
            <div
              key={field.id}
              className={cn(
                "h-7 w-7 rounded flex items-center justify-center",
                config.bgColor,
                config.color
              )}
              title={field.label}
            >
              {config.icon}
            </div>
          );
        })}
        {template.fields.length > 6 && (
          <div className="h-7 px-2 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
            +{template.fields.length - 6}
          </div>
        )}
      </div>

      {onUseTemplate && (
        <Button
          onClick={onUseTemplate}
          className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
          size="sm"
        >
          Use Template
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      )}
    </div>
  );
}

export default TemplatePreviewCard;
