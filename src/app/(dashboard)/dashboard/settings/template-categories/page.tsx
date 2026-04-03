"use client";

import * as React from "react";
import {
  Plus,
  Tag,
  MoreHorizontal,
  Edit,
  Trash2,
  GripVertical,
  Layers,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "@/components/ui/confirm-dialog";

// ============================================
// TYPES
// ============================================

interface TemplateCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  templateCount: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// PRESET COLORS
// ============================================

const PRESET_COLORS = [
  "#E4405F", // Instagram pink
  "#1DA1F2", // Twitter blue
  "#00AFF0", // OnlyFans blue
  "#FF4500", // Reddit orange
  "#FF0000", // YouTube red
  "#1FA7F8", // Fansly blue
  "#6366F1", // Indigo
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#6B7280", // Gray
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function TemplateCategoriesPage() {
  const [categories, setCategories] = React.useState<TemplateCategory[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<TemplateCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = React.useState<TemplateCategory | null>(null);

  // Fetch categories on mount
  React.useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/template-categories?includeTemplateCount=true");
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      } else {
        toast.error("Failed to load categories");
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (data: { name: string; description?: string; color?: string }) => {
    try {
      const response = await fetch("/api/template-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create category");
      }

      const newCategory = await response.json();
      setCategories((prev) => [...prev, newCategory]);
      toast.success("Category created");
      setShowCreateDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create category");
    }
  };

  const handleUpdate = async (data: { name?: string; description?: string | null; color?: string | null }) => {
    if (!editingCategory) return;

    try {
      const response = await fetch(`/api/template-categories/${editingCategory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update category");
      }

      const updatedCategory = await response.json();
      setCategories((prev) =>
        prev.map((c) => (c.id === editingCategory.id ? { ...c, ...updatedCategory } : c))
      );
      toast.success("Category updated");
      setShowEditDialog(false);
      setEditingCategory(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update category");
    }
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;

    try {
      const response = await fetch(`/api/template-categories/${deletingCategory.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete category");
      }

      setCategories((prev) => prev.filter((c) => c.id !== deletingCategory.id));
      toast.success("Category deleted");
      setShowDeleteDialog(false);
      setDeletingCategory(null);
    } catch (error) {
      toast.error("Failed to delete category");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Template Categories
          </h1>
          <p className="text-muted-foreground mt-1">
            Organize templates into categories and control team access
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Category
        </Button>
      </div>

      {/* Categories List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-muted" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-24 bg-muted rounded" />
                    <div className="h-3 w-32 bg-muted rounded" />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState onCreateClick={() => setShowCreateDialog(true)} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={() => {
                setEditingCategory(category);
                setShowEditDialog(true);
              }}
              onDelete={() => {
                setDeletingCategory(category);
                setShowDeleteDialog(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <CategoryFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreate}
        title="Create Category"
        description="Create a new category to organize your templates."
      />

      {/* Edit Dialog */}
      <CategoryFormDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSubmit={handleUpdate}
        initialData={editingCategory || undefined}
        title="Edit Category"
        description="Update the category details."
      />

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        itemName={deletingCategory?.name || ""}
        itemType="category"
        description={
          deletingCategory && deletingCategory.templateCount > 0
            ? `This category contains ${deletingCategory.templateCount} template(s). They will become uncategorized.`
            : undefined
        }
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ============================================
// CATEGORY CARD
// ============================================

interface CategoryCardProps {
  category: TemplateCategory;
  onEdit: () => void;
  onDelete: () => void;
}

function CategoryCard({ category, onEdit, onDelete }: CategoryCardProps) {
  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md">
      {/* Color Bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: category.color || "#6B7280" }}
      />

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${category.color || "#6B7280"}15` }}
            >
              <Tag
                className="h-5 w-5"
                style={{ color: category.color || "#6B7280" }}
              />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{category.name}</CardTitle>
              {category.description && (
                <CardDescription className="truncate">
                  {category.description}
                </CardDescription>
              )}
            </div>
          </div>

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
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Category
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Layers className="h-4 w-4" />
          <span>
            {category.templateCount} template{category.templateCount !== 1 ? "s" : ""}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// CATEGORY FORM DIALOG
// ============================================

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; description?: string; color?: string }) => Promise<void>;
  initialData?: Partial<TemplateCategory>;
  title: string;
  description: string;
}

function CategoryFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  title,
  description,
}: CategoryFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [name, setName] = React.useState(initialData?.name || "");
  const [categoryDescription, setCategoryDescription] = React.useState(
    initialData?.description || ""
  );
  const [color, setColor] = React.useState(initialData?.color || PRESET_COLORS[0]);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setName(initialData?.name || "");
      setCategoryDescription(initialData?.description || "");
      setColor(initialData?.color || PRESET_COLORS[0]);
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Category name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: categoryDescription.trim() || undefined,
        color: color || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Category Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Instagram, OnlyFans, Reddit"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={categoryDescription}
              onChange={(e) => setCategoryDescription(e.target.value)}
              placeholder="What templates belong in this category?"
              rows={2}
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Category Color</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  className={`h-8 w-8 rounded-lg border-2 transition-all ${
                    color === presetColor
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: presetColor }}
                  onClick={() => setColor(presetColor)}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#000000"
                className="flex-1"
              />
              <div
                className="h-10 w-10 rounded-lg border"
                style={{ backgroundColor: color }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : initialData ? "Save Changes" : "Create Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// EMPTY STATE
// ============================================

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="mx-auto h-20 w-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
        <Tag className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">No categories yet</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm text-center">
        Create categories to organize your templates by platform or purpose.
        You can then restrict which team members can access each category.
      </p>
      <Button className="mt-6" onClick={onCreateClick}>
        <Plus className="mr-2 h-4 w-4" />
        Create Your First Category
      </Button>
    </div>
  );
}
