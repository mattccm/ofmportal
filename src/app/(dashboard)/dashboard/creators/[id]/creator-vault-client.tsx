"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EditableCreatorName } from "@/components/editable";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActivityTimelineWidget } from "@/components/activity/activity-timeline";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Upload,
  CheckCircle,
  Clock,
  Calendar,
  Mail,
  Phone,
  Edit2,
  MessageSquare,
  Download,
  Archive,
  Plus,
  MoreHorizontal,
  ExternalLink,
  FileText,
  TrendingUp,
  BarChart3,
  Activity,
  Target,
  StickyNote,
  Trash2,
  Send,
  Bell,
  Image as ImageIcon,
  Video,
  File,
  Filter,
  Grid3X3,
  List,
  ChevronRight,
  Star,
  AlertCircle,
  XCircle,
  Users,
  Eye,
  Play,
  RefreshCw,
  Settings,
  Shield,
} from "lucide-react";
import { CopyableEmail } from "@/components/ui/copyable-text";
import { NotesPanel } from "@/components/notes/notes-panel";
import { type Note } from "@/lib/notes-utils";
import { CommunicationStatus } from "@/components/creators/communication-status";
import { CommunicationPreferencesForm } from "@/components/creators/communication-preferences-form";
import { ContactCreatorModal } from "@/components/creators/contact-creator-modal";
import { EditCreatorProfileModal } from "@/components/creators/edit-creator-profile-modal";
import {
  type CommunicationPreferences,
  type ContactMethod,
  DEFAULT_COMMUNICATION_PREFERENCES,
} from "@/types/communication-preferences";

// Types
interface CreatorStats {
  totalUploads: number;
  approvalRate: number;
  avgResponseTimeHours: number;
  totalRequests: number;
  memberSince: Date;
}

interface Creator {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  inviteStatus: string;
  timezone: string;
  preferredContact: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  notes: string | null;
  stats: CreatorStats;
  _count: {
    requests: number;
    uploads: number;
  };
}

interface ContentRequest {
  id: string;
  title: string;
  status: string;
  dueDate: Date | null;
  urgency: string;
  createdAt: Date;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  uploadCount: number;
}

interface UploadItem {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  status: string;
  rating: number | null;
  thumbnailUrl: string | null;
  storageUrl: string | null;
  uploadedAt: Date | null;
  createdAt: Date;
  request: {
    id: string;
    title: string;
  };
  reviewedBy: {
    id: string;
    name: string;
  } | null;
}

interface CreatorNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  authorName: string;
}

interface CreatorVaultClientProps {
  creator: Creator;
  activeRequests: ContentRequest[];
  completedRequests: ContentRequest[];
  initialUploads: UploadItem[];
  initialNotes: CreatorNote[];
  initialCommunicationPreferences?: CommunicationPreferences;
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
}

// Status configurations
const STATUS_CONFIG: Record<string, { class: string; label: string }> = {
  PENDING: {
    class: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
    label: "Pending",
  },
  IN_PROGRESS: {
    class: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
    label: "In Progress",
  },
  SUBMITTED: {
    class: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400",
    label: "Submitted",
  },
  UNDER_REVIEW: {
    class: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400",
    label: "Under Review",
  },
  NEEDS_REVISION: {
    class: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
    label: "Needs Revision",
  },
  APPROVED: {
    class: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
    label: "Approved",
  },
  REJECTED: {
    class: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
    label: "Rejected",
  },
  CANCELLED: {
    class: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400",
    label: "Cancelled",
  },
};

const INVITE_STATUS_CONFIG: Record<string, { class: string; label: string }> = {
  PENDING: {
    class: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
    label: "Invite Pending",
  },
  ACCEPTED: {
    class: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
    label: "Active",
  },
  EXPIRED: {
    class: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400",
    label: "Inactive",
  },
};

const URGENCY_CONFIG: Record<string, { class: string; label: string }> = {
  LOW: { class: "bg-gray-100 text-gray-600", label: "Low" },
  NORMAL: { class: "bg-blue-100 text-blue-600", label: "Normal" },
  HIGH: { class: "bg-orange-100 text-orange-600", label: "High" },
  URGENT: { class: "bg-red-100 text-red-600 animate-pulse", label: "Urgent" },
};

export function CreatorVaultClient({
  creator: initialCreator,
  activeRequests,
  completedRequests,
  initialUploads,
  initialNotes,
  initialCommunicationPreferences,
  currentUser,
}: CreatorVaultClientProps) {
  const router = useRouter();
  const [creator, setCreator] = useState(initialCreator);
  const [activeTab, setActiveTab] = useState("uploads");
  const [uploads, setUploads] = useState<UploadItem[]>(initialUploads);
  const [notes, setNotes] = useState<CreatorNote[]>(initialNotes);
  const [isLoading, setIsLoading] = useState(false);

  // Communication preferences state
  const [communicationPreferences, setCommunicationPreferences] = useState<CommunicationPreferences>(
    initialCommunicationPreferences || DEFAULT_COMMUNICATION_PREFERENCES
  );
  const [showCommPrefsForm, setShowCommPrefsForm] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  // Convert CreatorNote to Note type for NotesPanel
  const convertedNotes: Note[] = notes.map((note) => ({
    id: note.id,
    content: note.content,
    entityType: "creator" as const,
    entityId: creator.id,
    authorId: note.authorId,
    authorName: note.authorName,
    isPinned: false,
    isInternal: true,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    mentions: [],
    hashtags: [],
  }));

  // Handle notes change from NotesPanel
  const handleNotesChange = useCallback((newNotes: Note[]) => {
    setNotes(
      newNotes.map((note) => ({
        id: note.id,
        content: note.content,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        authorId: note.authorId,
        authorName: note.authorName,
      }))
    );
  }, []);

  // Handle creator name update
  const handleCreatorNameUpdate = useCallback((newName: string) => {
    setCreator((prev) => ({ ...prev, name: newName }));
  }, []);

  // Upload filters
  const [uploadFilters, setUploadFilters] = useState({
    status: "all",
    contentType: "all",
    dateFrom: "",
    dateTo: "",
    sort: "uploadedAt",
    order: "desc",
  });
  const [uploadView, setUploadView] = useState<"grid" | "list">("grid");

  // Dialog states
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [previewUpload, setPreviewUpload] = useState<UploadItem | null>(null);

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<Record<string, unknown> | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState("90d");
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Activity state
  const [activities, setActivities] = useState<Array<{
    id: string;
    action: string;
    description: string;
    timestamp: Date;
    icon: string;
    color: string;
  }>>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityFilter, setActivityFilter] = useState("all");

  // Load uploads with filters
  const loadUploads = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (uploadFilters.status !== "all") params.set("status", uploadFilters.status);
      if (uploadFilters.contentType !== "all") params.set("contentType", uploadFilters.contentType);
      if (uploadFilters.dateFrom) params.set("dateFrom", uploadFilters.dateFrom);
      if (uploadFilters.dateTo) params.set("dateTo", uploadFilters.dateTo);
      params.set("sort", uploadFilters.sort);
      params.set("order", uploadFilters.order);

      const response = await fetch(`/api/creators/${creator.id}/uploads?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch uploads");

      const data = await response.json();
      setUploads(data.uploads);
    } catch (error) {
      toast.error("Failed to load uploads");
    } finally {
      setIsLoading(false);
    }
  }, [creator.id, uploadFilters]);

  // Load analytics
  const loadAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const response = await fetch(`/api/creators/${creator.id}/analytics?range=${analyticsRange}`);
      if (!response.ok) throw new Error("Failed to fetch analytics");

      const data = await response.json();
      setAnalyticsData(data);
    } catch (error) {
      toast.error("Failed to load analytics");
    } finally {
      setLoadingAnalytics(false);
    }
  }, [creator.id, analyticsRange]);

  // Load activity timeline
  const loadActivity = useCallback(async () => {
    setLoadingActivity(true);
    try {
      const params = new URLSearchParams();
      if (activityFilter !== "all") params.set("type", activityFilter);

      const response = await fetch(`/api/creators/${creator.id}/activity?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch activity");

      const data = await response.json();
      setActivities(data.activities);
    } catch (error) {
      toast.error("Failed to load activity");
    } finally {
      setLoadingActivity(false);
    }
  }, [creator.id, activityFilter]);

  // Handle tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "analytics" && !analyticsData) {
      loadAnalytics();
    }
    if (tab === "activity" && activities.length === 0) {
      loadActivity();
    }
  };

  // Archive creator
  const handleArchiveCreator = async () => {
    try {
      const response = await fetch(`/api/creators/${creator.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to archive creator");

      toast.success("Creator archived successfully");
      router.push("/dashboard/creators");
    } catch (error) {
      toast.error("Failed to archive creator");
    }
  };

  // Export all content
  const handleExportContent = async () => {
    toast.info("Preparing export...");
    try {
      const response = await fetch(`/api/uploads/export?creatorId=${creator.id}`);
      if (!response.ok) throw new Error("Failed to generate export");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${creator.name.replace(/\s+/g, "-")}-content-${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Export downloaded successfully");
    } catch (error) {
      toast.error("Failed to export content");
    }
  };

  // Send reminder
  const handleSendReminder = async () => {
    toast.info("Sending reminder...");
    try {
      const response = await fetch("/api/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: creator.id }),
      });

      if (!response.ok) throw new Error("Failed to send reminder");

      toast.success("Reminder sent successfully");
    } catch (error) {
      toast.error("Failed to send reminder");
    }
  };

  // Get file icon based on type
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return <ImageIcon className="h-5 w-5" />;
    if (fileType.startsWith("video/")) return <Video className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Is due soon check
  const isDueSoon = (dueDate: Date | null) => {
    if (!dueDate) return false;
    const now = new Date();
    const diff = new Date(dueDate).getTime() - now.getTime();
    return diff > 0 && diff < 24 * 60 * 60 * 1000; // Less than 24 hours
  };

  const isOverdue = (dueDate: Date | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Back Button & Actions Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link href="/dashboard/creators">
            <ArrowLeft className="h-4 w-4" />
            Back to Creators
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditProfileOpen(true)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/messages?creatorId=${creator.id}`}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Message
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSendReminder}>
                <Bell className="h-4 w-4 mr-2" />
                Send Reminder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportContent}>
                <Download className="h-4 w-4 mr-2" />
                Export All Content
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setConfirmArchiveOpen(true)}
                className="text-red-600 focus:text-red-600"
              >
                <Archive className="h-4 w-4 mr-2" />
                Archive Creator
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Creator Profile Header */}
      <Card className="card-elevated overflow-hidden">
        {/* Gradient Header */}
        <div className="h-24 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />

        <CardContent className="relative pt-0 pb-6">
          {/* Avatar */}
          <div className="absolute -top-12 left-6">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
              {creator.avatar ? (
                <AvatarImage src={creator.avatar} alt={creator.name} />
              ) : (
                <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                  {creator.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
          </div>

          {/* Creator Info */}
          <div className="pt-14 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground">
                    <EditableCreatorName
                      creatorId={creator.id}
                      name={creator.name}
                      onUpdate={handleCreatorNameUpdate}
                      size="lg"
                    />
                  </h1>
                  <Badge
                    variant="outline"
                    className={INVITE_STATUS_CONFIG[creator.inviteStatus]?.class}
                  >
                    {INVITE_STATUS_CONFIG[creator.inviteStatus]?.label}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-4 w-4" />
                    <CopyableEmail
                      text={creator.email}
                      maxWidth="250px"
                      onCopySuccess={() => toast.success("Email copied to clipboard")}
                    />
                  </span>
                  {creator.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      {creator.phone}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    Member since {format(new Date(creator.createdAt), "MMM yyyy")}
                  </span>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex items-center gap-2">
                <Button asChild>
                  <Link href={`/dashboard/requests/new?creatorId=${creator.id}`}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Request
                  </Link>
                </Button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
              <div className="text-center p-4 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Upload className="h-5 w-5 text-violet-600" />
                  <span className="text-2xl font-bold text-foreground">
                    {creator.stats.totalUploads}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Total Uploads</p>
              </div>

              <div className="text-center p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <span className="text-2xl font-bold text-foreground">
                    {creator.stats.approvalRate}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Approval Rate</p>
              </div>

              <div className="text-center p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <span className="text-2xl font-bold text-foreground">
                    {creator.stats.avgResponseTimeHours < 24
                      ? `${Math.round(creator.stats.avgResponseTimeHours)}h`
                      : `${Math.round(creator.stats.avgResponseTimeHours / 24)}d`}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Avg Response</p>
              </div>

              <div className="text-center p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <FileText className="h-5 w-5 text-amber-600" />
                  <span className="text-2xl font-bold text-foreground">
                    {creator.stats.totalRequests}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Content Vault Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="h-12 p-1 bg-muted/50">
          <TabsTrigger value="uploads" className="gap-2 data-[state=active]:bg-background">
            <Upload className="h-4 w-4" />
            All Uploads
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-2 data-[state=active]:bg-background">
            <Clock className="h-4 w-4" />
            Active Requests
            {activeRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {activeRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2 data-[state=active]:bg-background">
            <CheckCircle className="h-4 w-4" />
            Completed
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2 data-[state=active]:bg-background">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2 data-[state=active]:bg-background">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* All Uploads Tab */}
        <TabsContent value="uploads" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={uploadFilters.status}
              onValueChange={(value) => {
                setUploadFilters((prev) => ({ ...prev, status: value }));
                setTimeout(loadUploads, 0);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={uploadFilters.contentType}
              onValueChange={(value) => {
                setUploadFilters((prev) => ({ ...prev, contentType: value }));
                setTimeout(loadUploads, 0);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="document">Documents</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={uploadFilters.dateFrom}
                onChange={(e) => {
                  setUploadFilters((prev) => ({ ...prev, dateFrom: e.target.value }));
                  setTimeout(loadUploads, 0);
                }}
                className="w-[140px] h-9"
                placeholder="From"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={uploadFilters.dateTo}
                onChange={(e) => {
                  setUploadFilters((prev) => ({ ...prev, dateTo: e.target.value }));
                  setTimeout(loadUploads, 0);
                }}
                className="w-[140px] h-9"
                placeholder="To"
              />
            </div>

            <Select
              value={`${uploadFilters.sort}-${uploadFilters.order}`}
              onValueChange={(value) => {
                const [sort, order] = value.split("-");
                setUploadFilters((prev) => ({ ...prev, sort, order }));
                setTimeout(loadUploads, 0);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uploadedAt-desc">Newest First</SelectItem>
                <SelectItem value="uploadedAt-asc">Oldest First</SelectItem>
                <SelectItem value="status-asc">Status</SelectItem>
                <SelectItem value="rating-desc">Highest Rated</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1" />

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportContent}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Bulk Download
            </Button>

            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
              <Button
                size="sm"
                variant={uploadView === "grid" ? "secondary" : "ghost"}
                className="h-8 w-8 p-0"
                onClick={() => setUploadView("grid")}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={uploadView === "list" ? "secondary" : "ghost"}
                className="h-8 w-8 p-0"
                onClick={() => setUploadView("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Uploads Grid/List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : uploads.length === 0 ? (
            <Card className="card-elevated">
              <CardContent className="py-16 text-center">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No uploads found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {uploadFilters.status !== "all" || uploadFilters.contentType !== "all"
                    ? "Try adjusting your filters"
                    : "This creator hasn't uploaded any content yet"}
                </p>
              </CardContent>
            </Card>
          ) : uploadView === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {uploads.map((upload) => (
                <Card
                  key={upload.id}
                  className="card-elevated group cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => setPreviewUpload(upload)}
                >
                  <div className="aspect-square relative bg-muted rounded-t-lg overflow-hidden">
                    {upload.thumbnailUrl ? (
                      <img
                        src={upload.thumbnailUrl}
                        alt={upload.originalName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {getFileIcon(upload.fileType)}
                      </div>
                    )}
                    {upload.fileType.startsWith("video/") && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="h-10 w-10 text-white" />
                      </div>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        "absolute top-2 right-2",
                        STATUS_CONFIG[upload.status]?.class
                      )}
                    >
                      {STATUS_CONFIG[upload.status]?.label}
                    </Badge>
                  </div>
                  <CardContent className="p-3">
                    <p className="text-sm font-medium truncate">{upload.originalName}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(upload.fileSize)}
                      </span>
                      {upload.rating && (
                        <span className="flex items-center gap-0.5 text-xs">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {upload.rating}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {uploads.map((upload) => (
                <Card
                  key={upload.id}
                  className="card-elevated cursor-pointer hover:shadow-md transition-all"
                  onClick={() => setPreviewUpload(upload)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                        {upload.thumbnailUrl ? (
                          <img
                            src={upload.thumbnailUrl}
                            alt={upload.originalName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          getFileIcon(upload.fileType)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{upload.originalName}</p>
                        <p className="text-sm text-muted-foreground">
                          {upload.request.title} - {formatFileSize(upload.fileSize)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={STATUS_CONFIG[upload.status]?.class}
                      >
                        {STATUS_CONFIG[upload.status]?.label}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {upload.uploadedAt
                          ? format(new Date(upload.uploadedAt), "MMM d, yyyy")
                          : ""}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Active Requests Tab */}
        <TabsContent value="active" className="space-y-4">
          {activeRequests.length === 0 ? (
            <Card className="card-elevated">
              <CardContent className="py-16 text-center">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No active requests</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Create a new request to get started
                </p>
                <Button asChild className="mt-4">
                  <Link href={`/dashboard/requests/new?creatorId=${creator.id}`}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Request
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeRequests.map((request) => (
                <Card key={request.id} className="card-elevated hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "h-12 w-12 rounded-xl flex items-center justify-center",
                            isOverdue(request.dueDate)
                              ? "bg-red-100 dark:bg-red-900/30"
                              : isDueSoon(request.dueDate)
                              ? "bg-amber-100 dark:bg-amber-900/30"
                              : "bg-blue-100 dark:bg-blue-900/30"
                          )}
                        >
                          {isOverdue(request.dueDate) ? (
                            <AlertCircle className="h-6 w-6 text-red-600" />
                          ) : isDueSoon(request.dueDate) ? (
                            <Clock className="h-6 w-6 text-amber-600" />
                          ) : (
                            <FileText className="h-6 w-6 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <Link
                            href={`/dashboard/requests/${request.id}`}
                            className="font-medium hover:text-primary transition-colors"
                          >
                            {request.title}
                          </Link>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <Badge
                              variant="outline"
                              className={STATUS_CONFIG[request.status]?.class}
                            >
                              {STATUS_CONFIG[request.status]?.label}
                            </Badge>
                            <Badge className={URGENCY_CONFIG[request.urgency]?.class}>
                              {URGENCY_CONFIG[request.urgency]?.label}
                            </Badge>
                            <span className="flex items-center gap-1">
                              <Upload className="h-3.5 w-3.5" />
                              {request.uploadCount} uploads
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {request.dueDate && (
                          <div
                            className={cn(
                              "text-right",
                              isOverdue(request.dueDate) && "text-red-600",
                              isDueSoon(request.dueDate) && "text-amber-600"
                            )}
                          >
                            <p className="text-sm font-medium">
                              {isOverdue(request.dueDate)
                                ? "Overdue"
                                : isDueSoon(request.dueDate)
                                ? "Due Soon"
                                : "Due"}
                            </p>
                            <p className="text-xs">
                              {format(new Date(request.dueDate), "MMM d, yyyy")}
                            </p>
                          </div>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/requests/${request.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleSendReminder}>
                              <Bell className="h-4 w-4 mr-2" />
                              Send Reminder
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Completed Requests Tab */}
        <TabsContent value="completed" className="space-y-4">
          {completedRequests.length === 0 ? (
            <Card className="card-elevated">
              <CardContent className="py-16 text-center">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No completed requests</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Completed requests will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {completedRequests.map((request) => (
                <Card key={request.id} className="card-elevated hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "h-12 w-12 rounded-xl flex items-center justify-center",
                            request.status === "APPROVED"
                              ? "bg-emerald-100 dark:bg-emerald-900/30"
                              : "bg-gray-100 dark:bg-gray-800"
                          )}
                        >
                          {request.status === "APPROVED" ? (
                            <CheckCircle className="h-6 w-6 text-emerald-600" />
                          ) : (
                            <XCircle className="h-6 w-6 text-gray-500" />
                          )}
                        </div>
                        <div>
                          <Link
                            href={`/dashboard/requests/${request.id}`}
                            className="font-medium hover:text-primary transition-colors"
                          >
                            {request.title}
                          </Link>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <Badge
                              variant="outline"
                              className={STATUS_CONFIG[request.status]?.class}
                            >
                              {STATUS_CONFIG[request.status]?.label}
                            </Badge>
                            <span className="flex items-center gap-1">
                              <Upload className="h-3.5 w-3.5" />
                              {request.uploadCount} uploads
                            </span>
                            <span>
                              Completed{" "}
                              {request.reviewedAt
                                ? formatDistanceToNow(new Date(request.reviewedAt), {
                                    addSuffix: true,
                                  })
                                : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/templates/new?fromRequest=${request.id}`}>
                            <Plus className="h-4 w-4 mr-1" />
                            Use as Template
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <Link href={`/dashboard/requests/${request.id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>


        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Performance Analytics</h2>
            <Select value={analyticsRange} onValueChange={(value) => {
              setAnalyticsRange(value);
              setTimeout(loadAnalytics, 0);
            }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="365d">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadingAnalytics ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : analyticsData ? (
            <div className="space-y-6">
              {/* Overview Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="card-elevated">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                        <Upload className="h-5 w-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {(analyticsData.overview as Record<string, number>)?.totalUploads || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Total Uploads</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-elevated">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {(analyticsData.overview as Record<string, number>)?.approvalRate || 0}%
                        </p>
                        <p className="text-sm text-muted-foreground">Approval Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-elevated">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {(analyticsData.overview as Record<string, number>)?.approved || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Approved</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-elevated">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {(analyticsData.overview as Record<string, number>)?.pending || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Pending Review</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts placeholder - in production, you'd use a charting library */}
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle className="text-base">Upload Frequency</CardTitle>
                    <CardDescription>Weekly upload activity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-end gap-2">
                      {(analyticsData.uploadFrequency as Array<{ week: string; count: number }>)?.slice(-8).map((item, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full bg-gradient-to-t from-violet-500 to-purple-500 rounded-t-sm"
                            style={{
                              height: `${Math.max(
                                8,
                                (item.count / Math.max(...(analyticsData.uploadFrequency as Array<{ count: number }>).map((d) => d.count), 1)) * 160
                              )}px`,
                            }}
                          />
                          <span className="text-xs text-muted-foreground">{item.week}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle className="text-base">Content Types</CardTitle>
                    <CardDescription>Breakdown by file type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(analyticsData.contentTypeBreakdown as Array<{ type: string; count: number; percentage: number }>)?.map((item, i) => (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium">{item.type}</span>
                            <span className="text-sm text-muted-foreground">
                              {item.count} ({item.percentage}%)
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <Card className="card-elevated">
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground">No analytics data available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Activity Timeline Tab - Using comprehensive ActivityTimelineWidget */}
        <TabsContent value="activity" className="space-y-4">
          <ActivityTimelineWidget
            title="Creator Activity"
            entityType="Creator"
            entityId={creator.id}
            limit={20}
            showFilters={true}
            showSearch={true}
            viewAllHref={`/dashboard/activity?entityType=Creator&entityId=${creator.id}`}
          />
        </TabsContent>
      </Tabs>

      {/* Communication Preferences Section */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Communication Preferences
              </CardTitle>
              <CardDescription>
                How {creator.name} prefers to be contacted
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContactModalOpen(true)}
              >
                <Send className="h-4 w-4 mr-2" />
                Contact
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowCommPrefsForm(!showCommPrefsForm)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {showCommPrefsForm ? (
            <CommunicationPreferencesForm
              creatorId={creator.id}
              initialPreferences={communicationPreferences}
              onSave={(prefs) => {
                setCommunicationPreferences(prefs);
                setShowCommPrefsForm(false);
              }}
              onCancel={() => setShowCommPrefsForm(false)}
              compact
            />
          ) : (
            <CommunicationStatus
              preferences={communicationPreferences}
              creatorName={creator.name}
              onContactClick={() => setContactModalOpen(true)}
              showQuickActions
            />
          )}
        </CardContent>
      </Card>

      {/* Internal Notes Section */}
      <NotesPanel
        entityType="creator"
        entityId={creator.id}
        initialNotes={convertedNotes}
        currentUser={currentUser}
        apiBasePath={`/api/creators/${creator.id}/notes`}
        title="Internal Notes"
        description="Private notes about this creator (only visible to staff)"
        onNotesChange={handleNotesChange}
      />

      {/* Archive Confirmation Dialog */}
      <Dialog open={confirmArchiveOpen} onOpenChange={setConfirmArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Creator</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive {creator.name}? They will no longer be able to
              access the portal or receive new requests. This action can be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmArchiveOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchiveCreator}>
              Archive Creator
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Preview Dialog */}
      <Dialog open={!!previewUpload} onOpenChange={(open) => !open && setPreviewUpload(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewUpload?.originalName}</DialogTitle>
          </DialogHeader>
          {previewUpload && (
            <div className="space-y-4">
              {/* Preview */}
              <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                {previewUpload.fileType.startsWith("image/") && previewUpload.storageUrl ? (
                  <img
                    src={previewUpload.storageUrl}
                    alt={previewUpload.originalName}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : previewUpload.fileType.startsWith("video/") && previewUpload.storageUrl ? (
                  <video
                    src={previewUpload.storageUrl}
                    controls
                    className="max-w-full max-h-full"
                  />
                ) : (
                  <div className="text-center">
                    {getFileIcon(previewUpload.fileType)}
                    <p className="mt-2 text-sm text-muted-foreground">Preview not available</p>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                    variant="outline"
                    className={STATUS_CONFIG[previewUpload.status]?.class}
                  >
                    {STATUS_CONFIG[previewUpload.status]?.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">File Size</p>
                  <p className="font-medium">{formatFileSize(previewUpload.fileSize)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Request</p>
                  <Link
                    href={`/dashboard/requests/${previewUpload.request.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {previewUpload.request.title}
                  </Link>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Uploaded</p>
                  <p className="font-medium">
                    {previewUpload.uploadedAt
                      ? format(new Date(previewUpload.uploadedAt), "MMM d, yyyy 'at' h:mm a")
                      : "N/A"}
                  </p>
                </div>
                {previewUpload.reviewedBy && (
                  <div>
                    <p className="text-sm text-muted-foreground">Reviewed By</p>
                    <p className="font-medium">{previewUpload.reviewedBy.name}</p>
                  </div>
                )}
                {previewUpload.rating && (
                  <div>
                    <p className="text-sm text-muted-foreground">Rating</p>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "h-4 w-4",
                            i < previewUpload.rating!
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <EditCreatorProfileModal
        open={editProfileOpen}
        onOpenChange={setEditProfileOpen}
        creator={creator}
        onUpdate={(updatedData) => {
          setCreator((prev) => ({ ...prev, ...updatedData }));
        }}
        currentUserRole={currentUser.role}
      />

      {/* Contact Creator Modal */}
      <ContactCreatorModal
        open={contactModalOpen}
        onOpenChange={setContactModalOpen}
        creator={{
          id: creator.id,
          name: creator.name,
          email: creator.email,
        }}
        preferences={communicationPreferences}
        senderName={currentUser.name}
        onSend={async (data) => {
          // Send message via API
          const response = await fetch(`/api/creators/${creator.id}/contact`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          if (!response.ok) {
            throw new Error("Failed to send message");
          }
        }}
      />

    </div>
  );
}
