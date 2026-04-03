"use client";

import * as React from "react";
import {
  Search,
  Grid3X3,
  List,
  Clock,
  Star,
  StarOff,
  Layers,
  BarChart3,
  Calendar,
  Filter,
  ChevronRight,
  FileText,
  Type,
  AlignLeft,
  Hash,
  ChevronDown,
  CheckSquare,
  Upload,
  Eye,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface TemplateSelectorProps {
  templates: Template[];
  selectedTemplateId?: string;
  onSelectTemplate: (template: Template | null) => void;
  recentTemplateIds?: string[];
  favoriteTemplateIds?: string[];
  onToggleFavorite?: (templateId: string) => void;
  recommendedTemplateIds?: string[];
  className?: string;
}

type ViewMode = "grid" | "list";
type CategoryFilter = "all" | "recent" | "favorites" | "popular";

// ============================================
// FIELD TYPE ICONS
// ============================================

const FIELD_ICONS: Record<FieldType, React.ReactNode> = {
  text: <Type className="h-3 w-3" />,
  textarea: <AlignLeft className="h-3 w-3" />,
  number: <Hash className="h-3 w-3" />,
  date: <Calendar className="h-3 w-3" />,
  select: <ChevronDown className="h-3 w-3" />,
  checkbox: <CheckSquare className="h-3 w-3" />,
  file: <Upload className="h-3 w-3" />,
};

// ============================================
// TEMPLATE SELECTOR COMPONENT
// ============================================

export function TemplateSelector({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  recentTemplateIds = [],
  favoriteTemplateIds = [],
  onToggleFavorite,
  recommendedTemplateIds = [],
  className,
}: TemplateSelectorProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<CategoryFilter>("all");
  const [hoveredTemplateId, setHoveredTemplateId] = React.useState<string | null>(null);
  const [previewPosition, setPreviewPosition] = React.useState<{ x: number; y: number } | null>(null);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Filter templates based on search and category
  const filteredTemplates = React.useMemo(() => {
    let result = templates.filter((t) => t.isActive);

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    switch (categoryFilter) {
      case "recent":
        result = result.filter((t) => recentTemplateIds.includes(t.id));
        // Sort by recent order
        result.sort(
          (a, b) =>
            recentTemplateIds.indexOf(a.id) - recentTemplateIds.indexOf(b.id)
        );
        break;
      case "favorites":
        result = result.filter((t) => favoriteTemplateIds.includes(t.id));
        break;
      case "popular":
        result = result.sort(
          (a, b) => (b._count?.requests || 0) - (a._count?.requests || 0)
        );
        break;
    }

    return result;
  }, [templates, searchQuery, categoryFilter, recentTemplateIds, favoriteTemplateIds]);

  // Get recommended templates
  const recommendedTemplates = React.useMemo(() => {
    if (recommendedTemplateIds.length === 0) return [];
    return templates.filter(
      (t) => t.isActive && recommendedTemplateIds.includes(t.id)
    );
  }, [templates, recommendedTemplateIds]);

  // Get recently used templates
  const recentTemplates = React.useMemo(() => {
    if (recentTemplateIds.length === 0) return [];
    return recentTemplateIds
      .map((id) => templates.find((t) => t.id === id))
      .filter((t): t is Template => t !== undefined && t.isActive)
      .slice(0, 3);
  }, [templates, recentTemplateIds]);

  // Handle hover preview
  const handleMouseEnter = (templateId: string, event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredTemplateId(templateId);
      setPreviewPosition({
        x: rect.right + 10,
        y: Math.min(rect.top, window.innerHeight - 400),
      });
    }, 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setHoveredTemplateId(null);
    setPreviewPosition(null);
  };

  const hoveredTemplate = hoveredTemplateId
    ? templates.find((t) => t.id === hoveredTemplateId)
    : null;

  const isFavorite = (templateId: string) => favoriteTemplateIds.includes(templateId);
  const selectedTemplate = selectedTemplateId
    ? templates.find((t) => t.id === selectedTemplateId)
    : null;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Search and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={categoryFilter}
            onValueChange={(value) => setCategoryFilter(value as CategoryFilter)}
          >
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Templates</SelectItem>
              <SelectItem value="recent">Recently Used</SelectItem>
              <SelectItem value="favorites">Favorites</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("grid")}
              className="rounded-none"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("list")}
              className="rounded-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Recommended Templates Section */}
      {recommendedTemplates.length > 0 && categoryFilter === "all" && !searchQuery && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Recommended for this creator
            </h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recommendedTemplates.map((template) => (
              <TemplateQuickCard
                key={template.id}
                template={template}
                isSelected={selectedTemplateId === template.id}
                isFavorite={isFavorite(template.id)}
                onSelect={() => onSelectTemplate(template)}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recently Used Templates Section */}
      {recentTemplates.length > 0 && categoryFilter === "all" && !searchQuery && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Recently used
            </h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recentTemplates.map((template) => (
              <TemplateQuickCard
                key={template.id}
                template={template}
                isSelected={selectedTemplateId === template.id}
                isFavorite={isFavorite(template.id)}
                onSelect={() => onSelectTemplate(template)}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </div>
      )}

      {/* Templates Grid/List */}
      <div className="space-y-3">
        {categoryFilter === "all" && !searchQuery && (recentTemplates.length > 0 || recommendedTemplates.length > 0) && (
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-500" />
            <h3 className="text-sm font-medium text-muted-foreground">
              All templates
            </h3>
          </div>
        )}

        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No templates found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search terms"
                : "No templates match the current filter"}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((template) => (
              <TemplateGridCard
                key={template.id}
                template={template}
                isSelected={selectedTemplateId === template.id}
                isFavorite={isFavorite(template.id)}
                onSelect={() => onSelectTemplate(template)}
                onToggleFavorite={onToggleFavorite}
                onMouseEnter={(e) => handleMouseEnter(template.id, e)}
                onMouseLeave={handleMouseLeave}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTemplates.map((template) => (
              <TemplateListCard
                key={template.id}
                template={template}
                isSelected={selectedTemplateId === template.id}
                isFavorite={isFavorite(template.id)}
                onSelect={() => onSelectTemplate(template)}
                onToggleFavorite={onToggleFavorite}
                onMouseEnter={(e) => handleMouseEnter(template.id, e)}
                onMouseLeave={handleMouseLeave}
              />
            ))}
          </div>
        )}
      </div>

      {/* Hover Preview Tooltip */}
      {hoveredTemplate && previewPosition && (
        <div
          className="fixed z-50 w-80 animate-in fade-in-0 zoom-in-95 duration-200"
          style={{
            left: Math.min(previewPosition.x, window.innerWidth - 340),
            top: previewPosition.y,
          }}
        >
          <TemplatePreviewTooltip template={hoveredTemplate} />
        </div>
      )}

      {/* Selected Template Summary */}
      {selectedTemplate && (
        <div className="rounded-xl border-2 border-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                <Check className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="font-medium text-indigo-900 dark:text-indigo-100">
                  {selectedTemplate.name}
                </p>
                <p className="text-sm text-indigo-600/80 dark:text-indigo-400/80">
                  {selectedTemplate.fields.length} fields - Due in {selectedTemplate.defaultDueDays} days
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelectTemplate(null)}
              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100"
            >
              Change
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// TEMPLATE QUICK CARD (for recommended/recent sections)
// ============================================

interface TemplateQuickCardProps {
  template: Template;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite?: (templateId: string) => void;
}

function TemplateQuickCard({
  template,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: TemplateQuickCardProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex-shrink-0 w-48 p-3 rounded-xl border text-left transition-all duration-200",
        "hover:border-indigo-300 hover:shadow-md hover:scale-[1.02]",
        isSelected
          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20"
          : "border-border bg-card"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{template.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {template.fields.length} fields
          </p>
        </div>
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(template.id);
            }}
            className="p-1 hover:bg-muted rounded"
          >
            {isFavorite ? (
              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            ) : (
              <StarOff className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          <Calendar className="h-2.5 w-2.5 mr-1" />
          {template.defaultDueDays}d
        </Badge>
        {template._count?.requests ? (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            <BarChart3 className="h-2.5 w-2.5 mr-1" />
            {template._count.requests}
          </Badge>
        ) : null}
      </div>
    </button>
  );
}

// ============================================
// TEMPLATE GRID CARD
// ============================================

interface TemplateCardProps {
  template: Template;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite?: (templateId: string) => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

function TemplateGridCard({
  template,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
  onMouseEnter,
  onMouseLeave,
}: TemplateCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 relative overflow-hidden group",
        "hover:border-indigo-300 hover:shadow-lg",
        isSelected && "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20"
      )}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Selection indicator */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-1 transition-all duration-200",
          isSelected
            ? "bg-gradient-to-r from-indigo-500 to-violet-500"
            : "bg-transparent group-hover:bg-gradient-to-r group-hover:from-indigo-300 group-hover:to-violet-300"
        )}
      />

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                isSelected
                  ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <FileText className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm truncate">{template.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isSelected && (
              <div className="h-5 w-5 rounded-full bg-indigo-500 flex items-center justify-center">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(template.id);
                }}
                className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {isFavorite ? (
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                ) : (
                  <StarOff className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            )}
          </div>
        </div>
        {template.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {stripHtml(template.description)}
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Layers className="h-2.5 w-2.5" />
            {template.fields.length} fields
          </Badge>
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Calendar className="h-2.5 w-2.5" />
            {template.defaultDueDays} days
          </Badge>
          {template._count?.requests ? (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <BarChart3 className="h-2.5 w-2.5" />
              {template._count.requests} uses
            </Badge>
          ) : null}
        </div>

        {/* Field type preview */}
        <div className="flex items-center gap-1 mt-3 pt-3 border-t">
          {template.fields.slice(0, 5).map((field, index) => (
            <div
              key={field.id}
              className="h-6 w-6 rounded bg-muted flex items-center justify-center"
              title={field.label}
            >
              {FIELD_ICONS[field.type]}
            </div>
          ))}
          {template.fields.length > 5 && (
            <div className="h-6 px-2 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
              +{template.fields.length - 5}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// TEMPLATE LIST CARD
// ============================================

function TemplateListCard({
  template,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
  onMouseEnter,
  onMouseLeave,
}: TemplateCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-200 group",
        "hover:border-indigo-300 hover:shadow-md",
        isSelected && "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20"
      )}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
          isSelected
            ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400"
            : "bg-muted text-muted-foreground"
        )}
      >
        <FileText className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{template.name}</p>
          {isFavorite && (
            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
          )}
        </div>
        {template.description && (
          <p className="text-sm text-muted-foreground truncate">
            {stripHtml(template.description)}
          </p>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Layers className="h-4 w-4" />
          <span>{template.fields.length}</span>
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{template.defaultDueDays}d</span>
        </div>
        {template._count?.requests ? (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            <span>{template._count.requests}</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(template.id);
            }}
            className="p-1.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {isFavorite ? (
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            ) : (
              <StarOff className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        )}
        {isSelected ? (
          <div className="h-6 w-6 rounded-full bg-indigo-500 flex items-center justify-center">
            <Check className="h-4 w-4 text-white" />
          </div>
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

// ============================================
// TEMPLATE PREVIEW TOOLTIP
// ============================================

interface TemplatePreviewTooltipProps {
  template: Template;
}

function TemplatePreviewTooltip({ template }: TemplatePreviewTooltipProps) {
  return (
    <Card className="shadow-xl border-2">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-indigo-500" />
          <CardTitle className="text-sm">Template Preview</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="font-medium">{template.name}</p>
          {template.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {stripHtml(template.description)}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Fields ({template.fields.length})
          </p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {template.fields.map((field) => (
              <div
                key={field.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
              >
                <div className="h-6 w-6 rounded bg-background flex items-center justify-center">
                  {FIELD_ICONS[field.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{field.label}</p>
                    {field.quantity && field.quantity > 1 && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        ×{field.quantity}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground capitalize">
                    {field.type}
                    {field.required && " • Required"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>Default due: {template.defaultDueDays} days</span>
          <Badge variant="secondary" className="text-[10px]">
            {template.defaultUrgency}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export default TemplateSelector;
