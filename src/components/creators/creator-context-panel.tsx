"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton, SkeletonAvatar } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreatorContext,
  useCollapsedSections,
  type CreatorContextData,
  type CreatorContextRequest,
  type CreatorContextUpload,
  type CreatorContextActivity,
  type CreatorContextNote,
} from "@/hooks/use-creator-context";
import { useShortcut } from "@/hooks/use-keyboard-shortcuts";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import {
  X,
  Mail,
  MessageSquare,
  Edit3,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Calendar,
  TrendingUp,
  FileText,
  Image as ImageIcon,
  Video,
  File,
  Plus,
  Trash2,
  Save,
  Loader2,
  Activity,
  Timer,
  Target,
  BarChart3,
  StickyNote,
  LogIn,
  Upload,
  Send,
  Eye,
  Bell,
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface CreatorContextPanelProps {
  creatorId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenChange?: (open: boolean) => void;
  onToggle?: () => void; // For external keyboard shortcut control
}

// ============================================
// RESPONSE TIME INDICATOR (TRAFFIC LIGHT)
// ============================================

type ResponseTimeStatus = "fast" | "moderate" | "slow";

function getResponseTimeStatus(avgHours: number): ResponseTimeStatus {
  // Fast: < 12 hours (green)
  // Moderate: 12-48 hours (yellow)
  // Slow: > 48 hours (red)
  if (avgHours <= 0) return "fast"; // No data, assume good
  if (avgHours < 12) return "fast";
  if (avgHours < 48) return "moderate";
  return "slow";
}

function ResponseTimeIndicator({ avgResponseTimeHours }: { avgResponseTimeHours: number }) {
  const status = getResponseTimeStatus(avgResponseTimeHours);

  const statusConfig = {
    fast: {
      color: "bg-emerald-500",
      label: "Fast responder",
      description: "Usually responds within 12 hours",
    },
    moderate: {
      color: "bg-amber-500",
      label: "Moderate responder",
      description: "Usually responds within 48 hours",
    },
    slow: {
      color: "bg-red-500",
      label: "Slow responder",
      description: "Often takes more than 48 hours",
    },
  };

  const config = statusConfig[status];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 cursor-help">
          <div className={cn("w-2.5 h-2.5 rounded-full", config.color)} />
          <span className="text-xs text-muted-foreground">
            {avgResponseTimeHours > 0 ? `${avgResponseTimeHours}h avg` : "N/A"}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="font-medium">{config.label}</p>
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
    ACCEPTED: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400",
    EXPIRED: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  };

  const labels: Record<string, string> = {
    PENDING: "Pending",
    ACCEPTED: "Active",
    EXPIRED: "Expired",
  };

  return (
    <Badge variant="outline" className={cn("text-xs", styles[status])}>
      {labels[status] || status}
    </Badge>
  );
}

function RequestStatusBadge({ status, isOverdue }: { status: string; isOverdue: boolean }) {
  if (isOverdue) {
    return (
      <Badge
        variant="outline"
        className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 text-xs"
      >
        Overdue
      </Badge>
    );
  }

  const styles: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    PENDING: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    IN_PROGRESS: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    SUBMITTED: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    UNDER_REVIEW: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    NEEDS_REVISION: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <Badge variant="outline" className={cn("text-xs", styles[status])}>
      {status.replace("_", " ")}
    </Badge>
  );
}

function UploadStatusIndicator({ status }: { status: string }) {
  switch (status) {
    case "APPROVED":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "REJECTED":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "PENDING":
    default:
      return <Clock className="h-4 w-4 text-yellow-500" />;
  }
}

function FileTypeIcon({ fileType }: { fileType: string }) {
  if (fileType.startsWith("image/")) {
    return <ImageIcon className="h-4 w-4 text-violet-500" />;
  }
  if (fileType.startsWith("video/")) {
    return <Video className="h-4 w-4 text-blue-500" />;
  }
  return <File className="h-4 w-4 text-gray-500" />;
}

function ActivityIcon({ icon, color }: { icon: string; color: string }) {
  const colorClasses: Record<string, string> = {
    green: "text-green-500",
    red: "text-red-500",
    blue: "text-blue-500",
    violet: "text-violet-500",
    amber: "text-amber-500",
    gray: "text-gray-500",
  };

  const IconComponent = {
    "log-in": LogIn,
    "upload": Upload,
    "check-circle": CheckCircle2,
    "x-circle": XCircle,
    "file-text": FileText,
    "send": Send,
    "alert-circle": AlertCircle,
    "message-square": MessageSquare,
    "message-circle": MessageSquare,
    "sticky-note": StickyNote,
    "eye": Eye,
    "edit": Edit3,
    "mail": Mail,
    "activity": Activity,
    "bell": Bell,
  }[icon] || Activity;

  return <IconComponent className={cn("h-4 w-4", colorClasses[color] || "text-gray-500")} />;
}

// ============================================
// QUICK ACTIONS BAR
// ============================================

function QuickActionsBar({
  data,
  onSendReminder,
  isSendingReminder,
}: {
  data: CreatorContextData;
  onSendReminder: () => Promise<void>;
  isSendingReminder: boolean;
}) {
  const router = useRouter();

  const handleSendReminder = async () => {
    try {
      await onSendReminder();
      toast.success("Reminder sent successfully");
    } catch {
      toast.error("Failed to send reminder");
    }
  };

  return (
    <div className="flex items-center gap-2 mt-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => router.push(`/dashboard/messages?creator=${data.id}`)}
          >
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Message
          </Button>
        </TooltipTrigger>
        <TooltipContent>Send a message to this creator</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            asChild
          >
            <Link href={`/dashboard/requests/new?creatorId=${data.id}`}>
              <Plus className="h-4 w-4 mr-1.5" />
              Request
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Create a new request for this creator</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleSendReminder}
            disabled={isSendingReminder || data.requestSummary.active === 0}
          >
            {isSendingReminder ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Bell className="h-4 w-4 mr-1.5" />
            )}
            Reminder
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {data.requestSummary.active === 0
            ? "No active requests to remind about"
            : "Send a reminder about pending requests"
          }
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// ============================================
// SECTION COMPONENTS
// ============================================

function PanelHeader({
  data,
  onClose,
  isFullScreen,
  onToggleFullScreen,
  onSendReminder,
  isSendingReminder,
}: {
  data: CreatorContextData;
  onClose: () => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  onSendReminder: () => Promise<void>;
  isSendingReminder: boolean;
}) {

  return (
    <div className="flex-shrink-0 px-4 py-3 border-b bg-muted/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar size="lg">
            {data.avatar ? (
              <img
                src={data.avatar}
                alt={data.name}
                className="aspect-square size-full rounded-full object-cover"
              />
            ) : (
              <AvatarFallback name={data.name} gradient>
                {data.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base truncate">{data.name}</h3>
              <StatusBadge status={data.inviteStatus} />
            </div>
            <p className="text-sm text-muted-foreground truncate">{data.email}</p>
            <div className="flex items-center gap-3 mt-1">
              {data.lastLoginAt && (
                <p className="text-xs text-muted-foreground">
                  Active {formatDistanceToNow(new Date(data.lastLoginAt), { addSuffix: true })}
                </p>
              )}
              <ResponseTimeIndicator avgResponseTimeHours={data.stats.avgResponseTimeHours} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onToggleFullScreen}
              >
                {isFullScreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isFullScreen ? "Exit full screen" : "Full screen"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                asChild
              >
                <Link href={`/dashboard/creators/${data.id}`}>
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>View full profile</TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <QuickActionsBar
        data={data}
        onSendReminder={onSendReminder}
        isSendingReminder={isSendingReminder}
      />
    </div>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  badge,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ElementType;
  badge?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            {badge}
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

function ActiveRequestsSection({
  requests,
  summary,
  isOpen,
  onToggle,
}: {
  requests: CreatorContextRequest[];
  summary: { active: number; overdue: number };
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <CollapsibleSection
      title="Active Requests"
      icon={FileText}
      badge={
        <span className="text-xs text-muted-foreground">
          {summary.active} active
          {summary.overdue > 0 && (
            <span className="text-red-500 ml-1">, {summary.overdue} overdue</span>
          )}
        </span>
      }
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="px-3 pb-3 space-y-2">
        {requests.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            No active requests
          </p>
        ) : (
          requests.slice(0, 5).map((request) => (
            <Link
              key={request.id}
              href={`/dashboard/requests/${request.id}`}
              className="block p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{request.title}</p>
                  {request.dueDate && (
                    <div className="flex items-center gap-1 mt-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span
                        className={cn(
                          "text-xs",
                          request.isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
                        )}
                      >
                        Due {format(new Date(request.dueDate), "MMM d")}
                      </span>
                    </div>
                  )}
                </div>
                <RequestStatusBadge status={request.status} isOverdue={request.isOverdue} />
              </div>
            </Link>
          ))
        )}
        {requests.length > 5 && (
          <Link
            href={`/dashboard/requests?creator=${requests[0]?.id}`}
            className="block text-xs text-primary hover:underline text-center py-1"
          >
            View all {requests.length} requests
          </Link>
        )}
      </div>
    </CollapsibleSection>
  );
}

function RecentUploadsSection({
  uploads,
  isOpen,
  onToggle,
}: {
  uploads: CreatorContextUpload[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <CollapsibleSection
      title="Recent Uploads"
      icon={Upload}
      badge={<span className="text-xs text-muted-foreground">{uploads.length} files</span>}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="px-3 pb-3">
        {uploads.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            No recent uploads
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {uploads.map((upload) => (
              <Tooltip key={upload.id}>
                <TooltipTrigger asChild>
                  <Link
                    href={`/dashboard/uploads?id=${upload.id}`}
                    className="relative aspect-square rounded-lg border bg-muted/30 overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all group"
                  >
                    {upload.thumbnailUrl ? (
                      <img
                        src={upload.thumbnailUrl}
                        alt={upload.originalName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileTypeIcon fileType={upload.fileType} />
                      </div>
                    )}
                    <div className="absolute top-1 right-1">
                      <UploadStatusIndicator status={upload.status} />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[10px] text-white truncate">
                        {upload.originalName}
                      </p>
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <p className="font-medium truncate">{upload.originalName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {upload.requestTitle}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {upload.status.toLowerCase()}
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
        {uploads.length > 0 && (
          <Link
            href={`/dashboard/uploads?creator=${uploads[0]?.id}`}
            className="block text-xs text-primary hover:underline text-center pt-2"
          >
            View all uploads
          </Link>
        )}
      </div>
    </CollapsibleSection>
  );
}

function PerformanceStatsSection({
  stats,
  isOpen,
  onToggle,
}: {
  stats: CreatorContextData["stats"];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <CollapsibleSection
      title="Performance"
      icon={BarChart3}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="px-3 pb-3 grid grid-cols-2 gap-2">
        <div className="p-2 rounded-lg border bg-card">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Timer className="h-3 w-3" />
            <span className="text-xs">Avg Response</span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold">
              {stats.avgResponseTimeHours > 0 ? `${stats.avgResponseTimeHours}h` : "N/A"}
            </p>
            {stats.avgResponseTimeHours > 0 && (
              <div className={cn(
                "w-2 h-2 rounded-full",
                stats.avgResponseTimeHours < 12 ? "bg-emerald-500" :
                stats.avgResponseTimeHours < 48 ? "bg-amber-500" : "bg-red-500"
              )} />
            )}
          </div>
        </div>

        <div className="p-2 rounded-lg border bg-card">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Target className="h-3 w-3" />
            <span className="text-xs">On-Time</span>
          </div>
          <p className="text-lg font-semibold">
            {stats.totalRequestsCompleted > 0 ? `${stats.onTimeCompletionRate}%` : "N/A"}
          </p>
        </div>

        <div className="p-2 rounded-lg border bg-card">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <CheckCircle2 className="h-3 w-3" />
            <span className="text-xs">Completed</span>
          </div>
          <p className="text-lg font-semibold">{stats.totalRequestsCompleted}</p>
        </div>

        <div className="p-2 rounded-lg border bg-card">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <TrendingUp className="h-3 w-3" />
            <span className="text-xs">Approval</span>
          </div>
          <p className="text-lg font-semibold">
            {stats.totalUploads > 0 ? `${stats.approvalRate}%` : "N/A"}
          </p>
        </div>
      </div>
    </CollapsibleSection>
  );
}

function NotesSection({
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onTogglePin,
  isAddingNote,
  isOpen,
  onToggle,
}: {
  notes: CreatorContextNote[];
  onAddNote: (content: string, isPinned?: boolean) => Promise<void>;
  onUpdateNote: (noteId: string, content: string, isPinned?: boolean) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onTogglePin: (noteId: string) => Promise<void>;
  isAddingNote: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  // Sort notes: pinned first, then by date
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const pinnedCount = notes.filter(n => n.isPinned).length;

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;
    try {
      await onAddNote(newNoteContent.trim());
      setNewNoteContent("");
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editingContent.trim()) return;
    try {
      await onUpdateNote(noteId, editingContent.trim());
      setEditingNoteId(null);
      setEditingContent("");
      toast.success("Note updated");
    } catch {
      toast.error("Failed to update note");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await onDeleteNote(noteId);
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    }
  };

  const handleTogglePin = async (noteId: string) => {
    try {
      await onTogglePin(noteId);
      const note = notes.find(n => n.id === noteId);
      toast.success(note?.isPinned ? "Note unpinned" : "Note pinned");
    } catch {
      toast.error("Failed to update note");
    }
  };

  const startEditing = (note: CreatorContextNote) => {
    setEditingNoteId(note.id);
    setEditingContent(note.content);
  };

  return (
    <CollapsibleSection
      title="Notes"
      icon={StickyNote}
      badge={
        <span className="text-xs text-muted-foreground">
          {notes.length}
          {pinnedCount > 0 && (
            <span className="ml-1">
              <Pin className="inline h-3 w-3" /> {pinnedCount}
            </span>
          )}
        </span>
      }
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="px-3 pb-3 space-y-2">
        {/* Add Note */}
        <div className="space-y-2">
          <Textarea
            placeholder="Add a note..."
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            className="min-h-[60px] text-sm resize-none"
          />
          <Button
            size="sm"
            className="w-full"
            onClick={handleAddNote}
            disabled={!newNoteContent.trim() || isAddingNote}
          >
            {isAddingNote ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Plus className="h-4 w-4 mr-1.5" />
            )}
            Add Note
          </Button>
        </div>

        {/* Notes List */}
        {sortedNotes.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            {sortedNotes.slice(0, 5).map((note) => (
              <div
                key={note.id}
                className={cn(
                  "p-2 rounded-lg border bg-card text-sm",
                  note.isPinned && "border-primary/50 bg-primary/5"
                )}
              >
                {editingNoteId === note.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="min-h-[60px] text-sm resize-none"
                    />
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleUpdateNote(note.id)}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingNoteId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {note.isPinned && (
                      <div className="flex items-center gap-1 text-xs text-primary mb-1">
                        <Pin className="h-3 w-3" />
                        <span>Pinned</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{note.content}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t">
                      <div className="text-xs text-muted-foreground">
                        <span>{note.authorName}</span>
                        <span className="mx-1">-</span>
                        <span>
                          {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleTogglePin(note.id)}
                            >
                              {note.isPinned ? (
                                <PinOff className="h-3 w-3" />
                              ) : (
                                <Pin className="h-3 w-3" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {note.isPinned ? "Unpin note" : "Pin note"}
                          </TooltipContent>
                        </Tooltip>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => startEditing(note)}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
            {sortedNotes.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                +{sortedNotes.length - 5} more notes
              </p>
            )}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function ActivityFeedSection({
  activities,
  isOpen,
  onToggle,
}: {
  activities: CreatorContextActivity[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <CollapsibleSection
      title="Recent Activity"
      icon={Activity}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="px-3 pb-3">
        {activities.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            No recent activity
          </p>
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-2 p-2 rounded-lg border bg-card"
              >
                <div className="mt-0.5">
                  <ActivityIcon icon={activity.icon} color={activity.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* Header Skeleton */}
      <div className="flex items-center gap-3">
        <SkeletonAvatar size="lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      {/* Action Buttons Skeleton */}
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 flex-1" />
      </div>

      <Separator />

      {/* Sections Skeleton */}
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// PANEL CONTENT (shared between Sheet and Dialog)
// ============================================

function PanelContent({
  data,
  isLoading,
  error,
  onClose,
  refetch,
  addNote,
  updateNote,
  deleteNote,
  toggleNotePin,
  isAddingNote,
  sendReminder,
  isSendingReminder,
  isFullScreen,
  onToggleFullScreen,
}: {
  data: CreatorContextData | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  refetch: () => Promise<void>;
  addNote: (content: string, isPinned?: boolean) => Promise<void>;
  updateNote: (noteId: string, content: string, isPinned?: boolean) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  toggleNotePin: (noteId: string) => Promise<void>;
  isAddingNote: boolean;
  sendReminder: () => Promise<void>;
  isSendingReminder: boolean;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
}) {
  const { isSectionOpen, toggleSection } = useCollapsedSections();

  if (isLoading && !data) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <AlertCircle className="h-10 w-10 text-destructive mb-3" />
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try Again
        </Button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <>
      <PanelHeader
        data={data}
        onClose={onClose}
        isFullScreen={isFullScreen}
        onToggleFullScreen={onToggleFullScreen}
        onSendReminder={sendReminder}
        isSendingReminder={isSendingReminder}
      />
      <ScrollArea className="flex-1">
        <div className="divide-y">
          <ActiveRequestsSection
            requests={data.activeRequests}
            summary={data.requestSummary}
            isOpen={isSectionOpen("active-requests")}
            onToggle={() => toggleSection("active-requests")}
          />
          <RecentUploadsSection
            uploads={data.recentUploads}
            isOpen={isSectionOpen("recent-uploads")}
            onToggle={() => toggleSection("recent-uploads")}
          />
          <PerformanceStatsSection
            stats={data.stats}
            isOpen={isSectionOpen("performance")}
            onToggle={() => toggleSection("performance")}
          />
          <NotesSection
            notes={data.notes}
            onAddNote={addNote}
            onUpdateNote={updateNote}
            onDeleteNote={deleteNote}
            onTogglePin={toggleNotePin}
            isAddingNote={isAddingNote}
            isOpen={isSectionOpen("notes")}
            onToggle={() => toggleSection("notes")}
          />
          <ActivityFeedSection
            activities={data.recentActivity}
            isOpen={isSectionOpen("activity")}
            onToggle={() => toggleSection("activity")}
          />
        </div>
      </ScrollArea>
    </>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CreatorContextPanel({
  creatorId,
  isOpen,
  onClose,
  onOpenChange,
  onToggle,
}: CreatorContextPanelProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);

  const {
    data,
    isLoading,
    error,
    refetch,
    addNote,
    updateNote,
    deleteNote,
    toggleNotePin,
    isAddingNote,
    sendReminder,
    isSendingReminder,
  } = useCreatorContext({
    creatorId,
    enabled: isOpen && !!creatorId,
    autoRefresh: isOpen,
    refreshInterval: 30000,
  });

  // Handle keyboard shortcut to close
  useShortcut("Escape", onClose, {
    enabled: isOpen,
    description: "Close creator context panel",
    category: "actions",
  });

  // Handle keyboard shortcut to toggle panel with "C" key
  useShortcut("c", () => {
    if (onToggle) {
      onToggle();
    }
  }, {
    enabled: !!onToggle,
    description: "Toggle creator context panel",
    category: "actions",
  });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
        setIsFullScreen(false);
      }
      onOpenChange?.(open);
    },
    [onClose, onOpenChange]
  );

  const handleToggleFullScreen = useCallback(() => {
    setIsFullScreen((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    setIsFullScreen(false);
  }, [onClose]);

  // Full-screen mode uses Dialog
  if (isFullScreen) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 flex flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>Creator Context - {data?.name}</DialogTitle>
            <DialogDescription>
              View detailed context information for this creator in full screen
            </DialogDescription>
          </DialogHeader>
          <PanelContent
            data={data}
            isLoading={isLoading}
            error={error}
            onClose={handleClose}
            refetch={refetch}
            addNote={addNote}
            updateNote={updateNote}
            deleteNote={deleteNote}
            toggleNotePin={toggleNotePin}
            isAddingNote={isAddingNote}
            sendReminder={sendReminder}
            isSendingReminder={isSendingReminder}
            isFullScreen={isFullScreen}
            onToggleFullScreen={handleToggleFullScreen}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Normal mode uses Sheet
  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[400px] p-0 flex flex-col"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Creator Context</SheetTitle>
          <SheetDescription>
            View detailed context information for this creator
          </SheetDescription>
        </SheetHeader>
        <PanelContent
          data={data}
          isLoading={isLoading}
          error={error}
          onClose={handleClose}
          refetch={refetch}
          addNote={addNote}
          updateNote={updateNote}
          deleteNote={deleteNote}
          toggleNotePin={toggleNotePin}
          isAddingNote={isAddingNote}
          sendReminder={sendReminder}
          isSendingReminder={isSendingReminder}
          isFullScreen={isFullScreen}
          onToggleFullScreen={handleToggleFullScreen}
        />
      </SheetContent>
    </Sheet>
  );
}

export default CreatorContextPanel;
