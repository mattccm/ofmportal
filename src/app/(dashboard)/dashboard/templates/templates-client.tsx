"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, SortAsc, ArrowUpDown, FolderOpen, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TemplateCard,
  TemplateCardSkeleton,
} from "@/components/templates/template-card";
import { NoTemplates } from "@/components/empty-states";

// ============================================
// TYPES
// ============================================

interface TemplateCategory {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  category: TemplateCategory | null;
  fieldCount: number;
  usageCount: number;
  isActive: boolean;
  updatedAt: Date;
}

interface TemplatesClientProps {
  initialTemplates: Template[];
  categories?: TemplateCategory[];
}

type SortOption = "name" | "usage" | "updated";
type FilterOption = "all" | "active" | "inactive";

// ============================================
// CLIENT COMPONENT
// ============================================

export function TemplatesClient({ initialTemplates, categories = [] }: TemplatesClientProps) {
  const router = useRouter();
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState<FilterOption>("all");
  const [filterCategory, setFilterCategory] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<SortOption>("updated");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "desc"
  );

  // Filter and sort templates
  const filteredTemplates = React.useMemo(() => {
    let result = [...templates];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (filterStatus === "active") {
      result = result.filter((t) => t.isActive);
    } else if (filterStatus === "inactive") {
      result = result.filter((t) => !t.isActive);
    }

    // Filter by category
    if (filterCategory !== "all") {
      if (filterCategory === "uncategorized") {
        result = result.filter((t) => !t.categoryId);
      } else {
        result = result.filter((t) => t.categoryId === filterCategory);
      }
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "usage":
          comparison = a.usageCount - b.usageCount;
          break;
        case "updated":
          comparison =
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [templates, searchQuery, filterStatus, filterCategory, sortBy, sortDirection]);

  // Handlers
  const handleDuplicate = async (templateId: string) => {
    const response = await fetch(`/api/templates/${templateId}/duplicate`, {
      method: "POST",
    });

    if (response.ok) {
      const newTemplate = await response.json();
      setTemplates([newTemplate, ...templates]);
    } else {
      throw new Error("Failed to duplicate template");
    }
  };

  const handleDelete = async (templateId: string) => {
    const response = await fetch(`/api/templates/${templateId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setTemplates(templates.filter((t) => t.id !== templateId));
    } else {
      throw new Error("Failed to delete template");
    }
  };

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const sortLabels: Record<SortOption, string> = {
    name: "Name",
    usage: "Usage",
    updated: "Last Updated",
  };

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Category Filter */}
          {categories.length > 0 && (
            <Select
              value={filterCategory}
              onValueChange={setFilterCategory}
            >
              <SelectTrigger className="w-[160px]">
                <Tag className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="uncategorized">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    Uncategorized
                  </div>
                </SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      {cat.color && (
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                      )}
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Status Filter */}
          <Select
            value={filterStatus}
            onValueChange={(v) => setFilterStatus(v as FilterOption)}
          >
            <SelectTrigger className="w-[130px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <SortAsc className="h-4 w-4" />
                Sort: {sortLabels[sortBy]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortBy("name")}>
                Name
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("usage")}>
                Usage
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("updated")}>
                Last Updated
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="icon" onClick={toggleSortDirection}>
            <ArrowUpDown
              className={`h-4 w-4 transition-transform ${
                sortDirection === "asc" ? "rotate-180" : ""
              }`}
            />
          </Button>
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <NoTemplates
          isFiltered={!!searchQuery || filterStatus !== "all" || filterCategory !== "all"}
          onClearFilters={() => {
            setSearchQuery("");
            setFilterStatus("all");
            setFilterCategory("all");
          }}
          filterContext={searchQuery ? "search" : filterStatus === "active" ? "active" : filterStatus === "inactive" ? "inactive" : filterCategory !== "all" ? "category" : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              id={template.id}
              name={template.name}
              description={template.description}
              category={template.category}
              fieldCount={template.fieldCount}
              usageCount={template.usageCount}
              isActive={template.isActive}
              updatedAt={template.updatedAt}
              onDuplicate={() => handleDuplicate(template.id)}
              onDelete={() => handleDelete(template.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
