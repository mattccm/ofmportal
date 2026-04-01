"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  UserPlus,
  Upload,
  Bell,
  X,
  Send,
  Clock,
  AlertCircle,
  CheckCircle2,
  File,
  Image,
  Video,
  Music,
  FileArchive,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Quick Request Dialog
interface QuickRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: QuickRequestData) => Promise<void>;
}

export interface QuickRequestData {
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate?: string;
}

export function QuickRequestDialog({
  open,
  onOpenChange,
  onSubmit,
}: QuickRequestDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formData, setFormData] = React.useState<QuickRequestData>({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(formData);
      } else {
        // Default: navigate to full request form with prefilled data
        const params = new URLSearchParams({
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          ...(formData.dueDate && { dueDate: formData.dueDate }),
        });
        router.push(`/requests/new?${params.toString()}`);
      }
      onOpenChange(false);
      setFormData({ title: "", description: "", priority: "medium", dueDate: "" });
    } catch (error) {
      console.error("Failed to create request:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10">
              <FileText className="h-5 w-5 text-violet-600" />
            </div>
            <DialogTitle>Quick Request</DialogTitle>
          </div>
          <DialogDescription>
            Create a new content request. You can add more details later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="quick-request-title">Title</Label>
            <Input
              id="quick-request-title"
              placeholder="Enter request title..."
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              autoFocus
              className="focus-visible:ring-violet-500/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-request-description">Description (optional)</Label>
            <Textarea
              id="quick-request-description"
              placeholder="Brief description of what you need..."
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={3}
              className="resize-none focus-visible:ring-violet-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quick-request-priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: QuickRequestData["priority"]) =>
                  setFormData((prev) => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger id="quick-request-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick-request-due">Due Date</Label>
              <Input
                id="quick-request-due"
                type="date"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, dueDate: e.target.value }))
                }
                min={new Date().toISOString().split("T")[0]}
                className="focus-visible:ring-violet-500/50"
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formData.title.trim() || isSubmitting}
              className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Create Request
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Quick Invite Dialog
interface QuickInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (email: string, message?: string) => Promise<void>;
}

export function QuickInviteDialog({
  open,
  onOpenChange,
  onSubmit,
}: QuickInviteDialogProps) {
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(email, message);
      } else {
        // Default behavior - would typically call an API
        console.log("Invite sent to:", email);
      }
      onOpenChange(false);
      setEmail("");
      setMessage("");
    } catch (error) {
      setError("Failed to send invitation. Please try again.");
      console.error("Failed to send invite:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10">
              <UserPlus className="h-5 w-5 text-violet-600" />
            </div>
            <DialogTitle>Invite Creator</DialogTitle>
          </div>
          <DialogDescription>
            Send an invitation to a content creator to join your portal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="creator@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              autoFocus
              className={cn(
                "focus-visible:ring-violet-500/50",
                error && "border-destructive focus-visible:ring-destructive/50"
              )}
            />
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-message">Personal Message (optional)</Label>
            <Textarea
              id="invite-message"
              placeholder="Add a personal note to your invitation..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="resize-none focus-visible:ring-violet-500/50"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!email.trim() || isSubmitting}
              className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Quick Upload Dialog
interface QuickUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload?: (files: File[]) => Promise<void>;
  acceptedTypes?: string;
  maxFiles?: number;
  maxSizeMB?: number;
}

interface UploadedFile {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

export function QuickUploadDialog({
  open,
  onOpenChange,
  onUpload,
  acceptedTypes = "image/*,video/*,audio/*,.pdf,.doc,.docx,.zip",
  maxFiles = 10,
  maxSizeMB = 100,
}: QuickUploadDialogProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [files, setFiles] = React.useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles
      .filter((file) => file.size <= maxSizeMB * 1024 * 1024)
      .slice(0, maxFiles - files.length);

    const uploadedFiles: UploadedFile[] = validFiles.map((file) => ({
      file,
      status: "pending",
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...uploadedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (type.startsWith("video/")) return <Video className="h-4 w-4" />;
    if (type.startsWith("audio/")) return <Music className="h-4 w-4" />;
    if (type.includes("zip") || type.includes("archive"))
      return <FileArchive className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);

    // Simulate upload progress for each file
    for (let i = 0; i < files.length; i++) {
      setFiles((prev) =>
        prev.map((f, idx) =>
          idx === i ? { ...f, status: "uploading" } : f
        )
      );

      // Simulate progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, progress } : f))
        );
      }

      setFiles((prev) =>
        prev.map((f, idx) =>
          idx === i ? { ...f, status: "success", progress: 100 } : f
        )
      );
    }

    try {
      if (onUpload) {
        await onUpload(files.map((f) => f.file));
      }

      // Close after short delay to show success
      setTimeout(() => {
        onOpenChange(false);
        setFiles([]);
      }, 500);
    } catch (error) {
      console.error("Upload failed:", error);
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: "error",
          error: "Upload failed",
        }))
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10">
              <Upload className="h-5 w-5 text-violet-600" />
            </div>
            <DialogTitle>Quick Upload</DialogTitle>
          </div>
          <DialogDescription>
            Drag and drop files or click to browse. Max {maxSizeMB}MB per file.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "relative border-2 border-dashed rounded-2xl p-8",
              "flex flex-col items-center justify-center gap-3",
              "cursor-pointer transition-all duration-200",
              "min-h-[180px]",
              isDragging
                ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20 scale-[1.02]"
                : "border-border hover:border-violet-400 hover:bg-muted/50"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptedTypes}
              onChange={handleFileSelect}
              className="hidden"
            />
            <div
              className={cn(
                "p-4 rounded-2xl transition-all duration-200",
                isDragging
                  ? "bg-violet-500 text-white scale-110"
                  : "bg-violet-100 text-violet-600 dark:bg-violet-900/30"
              )}
            >
              <Upload className="h-8 w-8" />
            </div>
            <div className="text-center">
              <p className="font-medium">
                {isDragging ? "Drop files here" : "Drag files here or click to browse"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Images, videos, documents, and more
              </p>
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-thin">
              {files.map((uploadedFile, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border",
                    "transition-all duration-200",
                    uploadedFile.status === "success" &&
                      "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20",
                    uploadedFile.status === "error" &&
                      "bg-red-50/50 border-red-200 dark:bg-red-950/20",
                    uploadedFile.status === "uploading" &&
                      "bg-blue-50/50 border-blue-200 dark:bg-blue-950/20"
                  )}
                >
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      uploadedFile.status === "success"
                        ? "bg-emerald-100 text-emerald-600"
                        : uploadedFile.status === "error"
                        ? "bg-red-100 text-red-600"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {uploadedFile.status === "success" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : uploadedFile.status === "uploading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      getFileIcon(uploadedFile.file.type)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {uploadedFile.file.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(uploadedFile.file.size)}
                      </span>
                      {uploadedFile.status === "uploading" && (
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-200"
                            style={{ width: `${uploadedFile.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  {uploadedFile.status !== "uploading" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setFiles([]);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={files.length === 0 || isUploading}
            className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload {files.length > 0 && `(${files.length})`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Quick Reminder Dialog
interface QuickReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: QuickReminderData) => Promise<void>;
  preselectedRecipient?: { id: string; name: string; email: string };
}

export interface QuickReminderData {
  recipient: string;
  subject: string;
  message: string;
  sendAt: "now" | "later";
  scheduledTime?: string;
}

export function QuickReminderDialog({
  open,
  onOpenChange,
  onSubmit,
  preselectedRecipient,
}: QuickReminderDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formData, setFormData] = React.useState<QuickReminderData>({
    recipient: preselectedRecipient?.email || "",
    subject: "",
    message: "",
    sendAt: "now",
    scheduledTime: "",
  });

  React.useEffect(() => {
    if (preselectedRecipient) {
      setFormData((prev) => ({
        ...prev,
        recipient: preselectedRecipient.email,
      }));
    }
  }, [preselectedRecipient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.recipient || !formData.message) return;

    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(formData);
      } else {
        // Default behavior
        console.log("Reminder sent:", formData);
      }
      onOpenChange(false);
      setFormData({
        recipient: "",
        subject: "",
        message: "",
        sendAt: "now",
        scheduledTime: "",
      });
    } catch (error) {
      console.error("Failed to send reminder:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10">
              <Bell className="h-5 w-5 text-violet-600" />
            </div>
            <DialogTitle>Send Reminder</DialogTitle>
          </div>
          <DialogDescription>
            Quickly send a reminder to a creator about pending requests.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="reminder-recipient">Recipient</Label>
            <Input
              id="reminder-recipient"
              type="email"
              placeholder="creator@example.com"
              value={formData.recipient}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, recipient: e.target.value }))
              }
              autoFocus={!preselectedRecipient}
              className="focus-visible:ring-violet-500/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-subject">Subject (optional)</Label>
            <Input
              id="reminder-subject"
              placeholder="Reminder about your pending request"
              value={formData.subject}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, subject: e.target.value }))
              }
              className="focus-visible:ring-violet-500/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-message">Message</Label>
            <Textarea
              id="reminder-message"
              placeholder="Hi! Just a friendly reminder about your pending request..."
              value={formData.message}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, message: e.target.value }))
              }
              rows={4}
              className="resize-none focus-visible:ring-violet-500/50"
            />
          </div>

          <div className="space-y-3">
            <Label>Send Time</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={formData.sendAt === "now" ? "default" : "outline"}
                className={cn(
                  "flex-1",
                  formData.sendAt === "now" &&
                    "bg-gradient-to-r from-indigo-500 to-violet-500 text-white"
                )}
                onClick={() =>
                  setFormData((prev) => ({ ...prev, sendAt: "now" }))
                }
              >
                <Send className="mr-2 h-4 w-4" />
                Send Now
              </Button>
              <Button
                type="button"
                variant={formData.sendAt === "later" ? "default" : "outline"}
                className={cn(
                  "flex-1",
                  formData.sendAt === "later" &&
                    "bg-gradient-to-r from-indigo-500 to-violet-500 text-white"
                )}
                onClick={() =>
                  setFormData((prev) => ({ ...prev, sendAt: "later" }))
                }
              >
                <Clock className="mr-2 h-4 w-4" />
                Schedule
              </Button>
            </div>
          </div>

          {formData.sendAt === "later" && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              <Label htmlFor="reminder-schedule">Schedule For</Label>
              <Input
                id="reminder-schedule"
                type="datetime-local"
                value={formData.scheduledTime}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    scheduledTime: e.target.value,
                  }))
                }
                min={new Date().toISOString().slice(0, 16)}
                className="focus-visible:ring-violet-500/50"
              />
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !formData.recipient ||
                !formData.message ||
                isSubmitting ||
                (formData.sendAt === "later" && !formData.scheduledTime)
              }
              className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {formData.sendAt === "now" ? "Sending..." : "Scheduling..."}
                </>
              ) : (
                <>
                  {formData.sendAt === "now" ? (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Reminder
                    </>
                  ) : (
                    <>
                      <Clock className="mr-2 h-4 w-4" />
                      Schedule Reminder
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Export a combined hook for managing all dialogs
export function useQuickActionDialogs() {
  const [requestDialogOpen, setRequestDialogOpen] = React.useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = React.useState(false);

  return {
    requestDialog: {
      open: requestDialogOpen,
      setOpen: setRequestDialogOpen,
    },
    inviteDialog: {
      open: inviteDialogOpen,
      setOpen: setInviteDialogOpen,
    },
    uploadDialog: {
      open: uploadDialogOpen,
      setOpen: setUploadDialogOpen,
    },
    reminderDialog: {
      open: reminderDialogOpen,
      setOpen: setReminderDialogOpen,
    },
    openCreateRequest: () => setRequestDialogOpen(true),
    openInviteCreator: () => setInviteDialogOpen(true),
    openUploadFile: () => setUploadDialogOpen(true),
    openSendReminder: () => setReminderDialogOpen(true),
    closeAll: () => {
      setRequestDialogOpen(false);
      setInviteDialogOpen(false);
      setUploadDialogOpen(false);
      setReminderDialogOpen(false);
    },
  };
}
