"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, SortAsc, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
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

interface Template {
  id: string;
  name: string;
  description: string | null;
  fieldCount: number;
  usageCount: number;
  isActive: boolean;
  updatedAt: Date;
}

interface TemplatesClientProps {
  initialTemplates: Template[];
}

type SortOption = "name" | "usage" | "updated";
type FilterOption = "all" | "active" | "inactive";

// ============================================
// CLIENT COMPONENT
// ============================================

export function TemplatesClient({ initialTemplates }: TemplatesClientProps) {
  const router = useRouter();
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState<FilterOption>("all");
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
  }, [templates, searchQuery, filterStatus, sortBy, sortDirection]);

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
          isFiltered={!!searchQuery || filterStatus !== "all"}
          onClearFilters={() => {
            setSearchQuery("");
            setFilterStatus("all");
          }}
          filterContext={searchQuery ? "search" : filterStatus === "active" ? "active" : filterStatus === "inactive" ? "inactive" : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              id={template.id}
              name={template.name}
              description={template.description}
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
