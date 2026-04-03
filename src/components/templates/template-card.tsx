"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  FileText,
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  Layers,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

interface TemplateCategory {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface TemplateCardProps {
  id: string;
  name: string;
  description?: string | null;
  category?: TemplateCategory | null;
  fieldCount: number;
  usageCount: number;
  isActive: boolean;
  updatedAt: Date;
  isFavorited?: boolean;
  onDuplicate?: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onFavoriteToggle?: (isFavorited: boolean) => void;
}

// ============================================
// TEMPLATE CARD COMPONENT
// ============================================

export function TemplateCard({
  id,
  name,
  description,
  category,
  fieldCount,
  usageCount,
  isActive,
  updatedAt,
  isFavorited = false,
  onDuplicate,
  onDelete,
  onFavoriteToggle,
}: TemplateCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDuplicating, setIsDuplicating] = React.useState(false);

  const handleDuplicate = async () => {
    if (!onDuplicate) return;

    setIsDuplicating(true);
    try {
      await onDuplicate();
      toast.success("Template duplicated");
    } catch (error) {
      toast.error("Failed to duplicate template");
      console.error(error);
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete();
      toast.success("Template deleted");
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.error("Failed to delete template");
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-border">
        {/* Active Indicator */}
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-1 transition-colors",
            isActive
              ? "bg-gradient-to-r from-emerald-500 to-green-500"
              : "bg-muted"
          )}
        />

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base truncate">
                  <Link
                    href={`/dashboard/templates/${id}/edit`}
                    className="hover:text-primary transition-colors"
                  >
                    {name}
                  </Link>
                </CardTitle>
                {description && (
                  <CardDescription className="truncate">
                    {description}
                  </CardDescription>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant={isActive ? "default" : "secondary"}
                className={cn(
                  isActive &&
                    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                )}
              >
                {isActive ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    Inactive
                  </>
                )}
              </Badge>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/requests/new?template=${id}`}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Request
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/templates/${id}/edit`}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Template
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDuplicate}
                    disabled={isDuplicating}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {isDuplicating ? "Duplicating..." : "Duplicate"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Category Badge */}
          {category && (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs font-normal"
                style={category.color ? {
                  borderColor: `${category.color}40`,
                  backgroundColor: `${category.color}10`,
                  color: category.color,
                } : undefined}
              >
                {category.name}
              </Badge>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              <span>
                {fieldCount} field{fieldCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              <span>
                {usageCount} request{usageCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>
                {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        itemName={name}
        itemType="template"
        description={
          usageCount > 0
            ? `This template is used by ${usageCount} content request${usageCount > 1 ? "s" : ""}. Deleting it will not affect existing requests, but you won't be able to use it for new ones.`
            : undefined
        }
        loading={isDeleting}
        onConfirm={handleDelete}
      />
    </>
  );
}

// ============================================
// TEMPLATE CARD SKELETON
// ============================================

export function TemplateCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-muted animate-pulse" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-3 w-48 bg-muted rounded animate-pulse" />
            </div>
          </div>
          <div className="h-6 w-16 bg-muted rounded animate-pulse" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// EMPTY STATE
// ============================================

interface EmptyTemplatesProps {
  searchQuery?: string;
  filterActive?: boolean | null;
}

export function EmptyTemplates({ searchQuery, filterActive }: EmptyTemplatesProps) {
  const hasFilters = searchQuery || filterActive !== null;

  return (
    <div className="text-center py-16">
      <div className="mx-auto h-20 w-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
        <FileText className="h-10 w-10 text-muted-foreground" />
      </div>
      {hasFilters ? (
        <>
          <h3 className="text-lg font-semibold text-foreground">
            No templates found
          </h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
            No templates match your current filters. Try adjusting your search or
            filter criteria.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-semibold text-foreground">
            No templates yet
          </h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
            Create your first template to streamline your content requests. Templates
            help ensure consistency across all your requests.
          </p>
          <Button asChild className="mt-6">
            <Link href="/dashboard/templates/new">
              <FileText className="h-4 w-4 mr-2" />
              Create Your First Template
            </Link>
          </Button>
        </>
      )}
    </div>
  );
}

export default TemplateCard;
