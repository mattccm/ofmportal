"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Calendar,
  Users,
  Info,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  X,
  Loader2,
  Pin,
  PinOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  AnnouncementBanner,
  type Announcement,
  type AnnouncementType,
} from "./announcement-banner";

type AnnouncementAudience = "ALL" | "ADMINS" | "CREATORS";

interface AnnouncementFormData {
  id?: string;
  title: string;
  message: string;
  type: AnnouncementType;
  actionText: string;
  actionUrl: string;
  targetAudience: AnnouncementAudience;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isPinned: boolean;
}

interface AnnouncementWithMeta extends Announcement {
  targetAudience: AnnouncementAudience;
  isActive: boolean;
  dismissalCount?: number;
  createdAt: string;
}

const defaultFormData: AnnouncementFormData = {
  title: "",
  message: "",
  type: "INFO",
  actionText: "",
  actionUrl: "",
  targetAudience: "ALL",
  startDate: new Date().toISOString().slice(0, 16),
  endDate: "",
  isActive: true,
  isPinned: false,
};

const typeOptions: { value: AnnouncementType; label: string; icon: React.ElementType; color: string }[] = [
  { value: "INFO", label: "Information", icon: Info, color: "text-blue-500" },
  { value: "WARNING", label: "Warning", icon: AlertTriangle, color: "text-amber-500" },
  { value: "SUCCESS", label: "Success", icon: CheckCircle, color: "text-emerald-500" },
  { value: "PROMO", label: "Promotional", icon: Sparkles, color: "text-violet-500" },
];

const audienceOptions: { value: AnnouncementAudience; label: string; description: string }[] = [
  { value: "ALL", label: "Everyone", description: "All users see this announcement" },
  { value: "ADMINS", label: "Admins Only", description: "Only admin users" },
  { value: "CREATORS", label: "Creators Only", description: "Only creator portal users" },
];

interface AnnouncementManagerProps {
  initialAnnouncements?: AnnouncementWithMeta[];
}

export function AnnouncementManager({ initialAnnouncements = [] }: AnnouncementManagerProps) {
  const [announcements, setAnnouncements] = React.useState<AnnouncementWithMeta[]>(initialAnnouncements);
  const [isLoading, setIsLoading] = React.useState(!initialAnnouncements.length);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = React.useState<AnnouncementWithMeta | null>(null);
  const [formData, setFormData] = React.useState<AnnouncementFormData>(defaultFormData);
  const [showPreview, setShowPreview] = React.useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);

  // Fetch announcements
  React.useEffect(() => {
    if (initialAnnouncements.length > 0) return;

    async function fetchAnnouncements() {
      try {
        const response = await fetch("/api/announcements?includeInactive=true");
        if (response.ok) {
          const data = await response.json();
          setAnnouncements(data.announcements || []);
        }
      } catch (error) {
        console.error("Error fetching announcements:", error);
        toast.error("Failed to load announcements");
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnnouncements();
  }, [initialAnnouncements]);

  // Reset form when dialog closes
  React.useEffect(() => {
    if (!isDialogOpen) {
      setFormData(defaultFormData);
      setEditingAnnouncement(null);
      setShowPreview(false);
    }
  }, [isDialogOpen]);

  // Populate form when editing
  React.useEffect(() => {
    if (editingAnnouncement) {
      setFormData({
        id: editingAnnouncement.id,
        title: editingAnnouncement.title,
        message: editingAnnouncement.message,
        type: editingAnnouncement.type,
        actionText: editingAnnouncement.actionText || "",
        actionUrl: editingAnnouncement.actionUrl || "",
        targetAudience: editingAnnouncement.targetAudience,
        startDate: new Date(editingAnnouncement.startDate).toISOString().slice(0, 16),
        endDate: editingAnnouncement.endDate
          ? new Date(editingAnnouncement.endDate).toISOString().slice(0, 16)
          : "",
        isActive: editingAnnouncement.isActive,
        isPinned: editingAnnouncement.isPinned || false,
      });
      setIsDialogOpen(true);
    }
  }, [editingAnnouncement]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const method = formData.id ? "PUT" : "POST";
      const response = await fetch("/api/announcements", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          endDate: formData.endDate || null,
          actionText: formData.actionText || null,
          actionUrl: formData.actionUrl || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save announcement");
      }

      const data = await response.json();

      if (formData.id) {
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === formData.id ? data.announcement : a))
        );
        toast.success("Announcement updated");
      } else {
        setAnnouncements((prev) => [data.announcement, ...prev]);
        toast.success("Announcement created");
      }

      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error saving announcement:", error);
      toast.error("Failed to save announcement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/announcements?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete announcement");
      }

      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      setDeleteConfirmId(null);
      toast.success("Announcement deleted");
    } catch (error) {
      console.error("Error deleting announcement:", error);
      toast.error("Failed to delete announcement");
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const announcement = announcements.find((a) => a.id === id);
      if (!announcement) return;

      const response = await fetch("/api/announcements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          isActive,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update announcement");
      }

      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isActive } : a))
      );
      toast.success(isActive ? "Announcement activated" : "Announcement deactivated");
    } catch (error) {
      console.error("Error toggling announcement:", error);
      toast.error("Failed to update announcement");
    }
  };

  const togglePinned = async (id: string, isPinned: boolean) => {
    try {
      const response = await fetch("/api/announcements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          isPinned,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update announcement");
      }

      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isPinned } : a))
      );
      toast.success(isPinned ? "Announcement pinned" : "Announcement unpinned");
    } catch (error) {
      console.error("Error toggling pin:", error);
      toast.error("Failed to update announcement");
    }
  };

  const getStatusBadge = (announcement: AnnouncementWithMeta) => {
    const now = new Date();
    const start = new Date(announcement.startDate);
    const end = announcement.endDate ? new Date(announcement.endDate) : null;

    if (!announcement.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (start > now) {
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Scheduled</Badge>;
    }
    if (end && end < now) {
      return <Badge variant="secondary">Expired</Badge>;
    }
    return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Active</Badge>;
  };

  const previewAnnouncement: Announcement = {
    id: "preview",
    title: formData.title || "Preview Title",
    message: formData.message || "Preview message content",
    type: formData.type,
    actionText: formData.actionText || null,
    actionUrl: formData.actionUrl || null,
    isPinned: formData.isPinned,
    startDate: formData.startDate,
    endDate: formData.endDate || null,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Manage Announcements</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage banner announcements for your users
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Announcement
        </Button>
      </div>

      {/* Announcements List */}
      {announcements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Info className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">No announcements yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first announcement to display to users
            </p>
            <Button onClick={() => setIsDialogOpen(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Create Announcement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => {
            const TypeIcon = typeOptions.find((t) => t.value === announcement.type)?.icon || Info;
            const typeColor = typeOptions.find((t) => t.value === announcement.type)?.color || "text-blue-500";

            return (
              <Card key={announcement.id} className={cn(!announcement.isActive && "opacity-60")}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Type icon */}
                    <div className={cn("shrink-0 p-2 rounded-lg bg-muted", typeColor)}>
                      <TypeIcon className="h-5 w-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{announcement.title}</h3>
                        {announcement.isPinned && (
                          <Pin className="h-3.5 w-3.5 text-violet-500" />
                        )}
                        {getStatusBadge(announcement)}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {announcement.message}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {audienceOptions.find((a) => a.value === announcement.targetAudience)?.label}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(announcement.startDate).toLocaleDateString()}
                          {announcement.endDate && ` - ${new Date(announcement.endDate).toLocaleDateString()}`}
                        </span>
                        {announcement.dismissalCount !== undefined && (
                          <span>{announcement.dismissalCount} dismissals</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => togglePinned(announcement.id, !announcement.isPinned)}
                        title={announcement.isPinned ? "Unpin" : "Pin to top"}
                      >
                        {announcement.isPinned ? (
                          <PinOff className="h-4 w-4" />
                        ) : (
                          <Pin className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleActive(announcement.id, !announcement.isActive)}
                        title={announcement.isActive ? "Deactivate" : "Activate"}
                      >
                        {announcement.isActive ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditingAnnouncement(announcement)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteConfirmId(announcement.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAnnouncement ? "Edit Announcement" : "Create Announcement"}
            </DialogTitle>
            <DialogDescription>
              {editingAnnouncement
                ? "Update your announcement details"
                : "Create a new banner announcement for your users"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Preview toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Preview</span>
              </div>
              <Switch checked={showPreview} onCheckedChange={setShowPreview} />
            </div>

            {/* Preview */}
            {showPreview && (
              <div className="border rounded-lg overflow-hidden">
                <AnnouncementBanner announcement={previewAnnouncement} />
              </div>
            )}

            {/* Type Selection */}
            <div className="space-y-2">
              <Label>Announcement Type</Label>
              <div className="grid grid-cols-4 gap-2">
                {typeOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, type: option.value }))}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                        formData.type === option.value
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-muted-foreground/30"
                      )}
                    >
                      <Icon className={cn("h-5 w-5", option.color)} />
                      <span className="text-xs font-medium">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Enter announcement title"
                required
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
                placeholder="Enter announcement message"
                rows={3}
                required
              />
            </div>

            {/* Action Button */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="actionText">Action Button Text</Label>
                <Input
                  id="actionText"
                  value={formData.actionText}
                  onChange={(e) => setFormData((prev) => ({ ...prev, actionText: e.target.value }))}
                  placeholder="e.g., Learn More"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actionUrl">Action URL</Label>
                <Input
                  id="actionUrl"
                  value={formData.actionUrl}
                  onChange={(e) => setFormData((prev) => ({ ...prev, actionUrl: e.target.value }))}
                  placeholder="e.g., /dashboard/features"
                />
              </div>
            </div>

            {/* Target Audience */}
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Select
                value={formData.targetAudience}
                onValueChange={(value: AnnouncementAudience) =>
                  setFormData((prev) => ({ ...prev, targetAudience: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {audienceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <span className="font-medium">{option.label}</span>
                        <span className="ml-2 text-muted-foreground">- {option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date (optional)</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isActive: checked }))
                  }
                />
                <Label htmlFor="isActive" className="font-normal cursor-pointer">
                  Active
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isPinned"
                  checked={formData.isPinned}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isPinned: checked }))
                  }
                />
                <Label htmlFor="isPinned" className="font-normal cursor-pointer">
                  Pin to top
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingAnnouncement ? (
                  "Update Announcement"
                ) : (
                  "Create Announcement"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Announcement</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this announcement? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
