"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  FileText,
  Upload,
  MessageSquare,
  Copy,
  GitBranch,
  ExternalLink,
  Loader2,
  StickyNote,
  PanelRightOpen,
} from "lucide-react";
import { NotesPanel } from "@/components/notes/notes-panel";
import { type Note } from "@/lib/notes-utils";
import { format, formatDistanceToNow } from "date-fns";
import { UploadsList } from "@/components/uploads/uploads-list";
import { RequestActions } from "@/components/requests/request-actions";
import { CommentSection } from "@/components/comments/comment-section";
import { CloneRequestDialog } from "@/components/requests/clone-request-dialog";
import { WatchersPanel, type Watcher } from "@/components/requests/watchers-panel";
import { CopyableId, CopyableEmail } from "@/components/ui/copyable-text";
import { toast } from "sonner";
import {
  EditableRequestTitle,
  EditableStatusBadge,
  EditablePriorityBadge,
  EditableDueDate,
} from "@/components/editable";
import {
  useCreatorContextPanel,
  useSetCreatorContext,
} from "@/components/providers/creator-context-provider";
import { HtmlContent } from "@/components/ui/html-content";

interface Creator {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
}

interface TemplateField {
  id: string;
  label: string;
  value: string;
  type: string;
  required: boolean;
}

interface UploadItem {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: bigint;
  storageKey: string;
  uploadStatus: string;
  status: string;
  uploadedAt: Date | null;
  createdAt: Date;
  fieldId?: string | null;
  [key: string]: unknown;
}

interface CommentItem {
  id: string;
  message: string;
  createdAt: Date;
  isInternal: boolean;
  user: {
    id: string;
    name: string | null;
    avatar?: string | null;
  };
  [key: string]: unknown;
}

interface WatcherItem {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
  notifyOnUpload: boolean;
  notifyOnComment: boolean;
  notifyOnStatus: boolean;
  notifyOnDueDate: boolean;
  createdAt: string;
}

interface Request {
  id: string;
  title: string;
  description: string | null;
  status: string;
  urgency: string;
  dueDate: Date | null;
  createdAt: Date;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  requirements: Record<string, string> | null;
  fields: TemplateField[] | null;
  creator: Creator;
  template: {
    id: string;
    name: string;
  } | null;
  uploads: UploadItem[];
  comments: CommentItem[];
  watchers?: WatcherItem[];
}

interface CloneHistoryItem {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  creator: {
    id: string;
    name: string;
    email?: string;
    avatar?: string | null;
  };
}

interface CloneHistory {
  isClone: boolean;
  clonedFrom: {
    id: string;
    title: string;
    status: string;
    clonedAt?: string;
    creator: {
      id: string;
      name: string;
    };
  } | null;
  clones: CloneHistoryItem[];
  cloneCount: number;
}

interface RequestDetailClientProps {
  request: Request;
  creators: Creator[];
  initialNotes?: Note[];
  currentUserId?: string;
  currentUser?: {
    id: string;
    name: string;
    role: string;
  };
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400",
    PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
    IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
    SUBMITTED: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
    UNDER_REVIEW: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400",
    NEEDS_REVISION: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400",
    APPROVED: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400",
    CANCELLED: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400",
    ARCHIVED: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/30 dark:text-gray-500",
  };

  return (
    <Badge variant="outline" className={`${styles[status] || styles.PENDING} text-sm`}>
      {status.replace("_", " ")}
    </Badge>
  );
}

function getUrgencyBadge(urgency: string) {
  const styles: Record<string, string> = {
    LOW: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    NORMAL: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    HIGH: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    URGENT: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <Badge variant="secondary" className={styles[urgency] || styles.NORMAL}>
      {urgency}
    </Badge>
  );
}

export function RequestDetailClient({
  request: initialRequest,
  creators,
  initialNotes = [],
  currentUserId = "",
  currentUser = { id: "", name: "Unknown", role: "MEMBER" },
}: RequestDetailClientProps) {
  const [request, setRequest] = useState(initialRequest);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [watchers, setWatchers] = useState<Watcher[]>(
    (initialRequest.watchers || []) as Watcher[]
  );
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneHistory, setCloneHistory] = useState<CloneHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Creator context panel integration
  const { openCreatorContext } = useCreatorContextPanel();
  useSetCreatorContext(initialRequest.creator.id);

  // Mark comments as read when viewing this request
  useEffect(() => {
    fetch("/api/comments/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: initialRequest.id }),
    }).catch(() => {
      // Silently fail - not critical
    });
  }, [initialRequest.id]);

  // Use currentUserId if available, fall back to currentUser.id
  const userId = currentUserId || currentUser.id;

  // Update handlers for inline editing
  const handleTitleUpdate = useCallback((newTitle: string) => {
    setRequest((prev) => ({ ...prev, title: newTitle }));
  }, []);

  const handleStatusUpdate = useCallback((newStatus: string) => {
    setRequest((prev) => ({ ...prev, status: newStatus }));
  }, []);

  const handlePriorityUpdate = useCallback((newPriority: string) => {
    setRequest((prev) => ({ ...prev, urgency: newPriority }));
  }, []);

  const handleDueDateUpdate = useCallback((newDueDate: string | null) => {
    setRequest((prev) => ({
      ...prev,
      dueDate: newDueDate ? new Date(newDueDate) : null,
    }));
  }, []);

  // Handle upload status change (approve/reject) without page reload
  const handleUploadStatusChange = useCallback((uploadId: string, newStatus: string) => {
    setRequest((prev) => ({
      ...prev,
      uploads: prev.uploads.map((u) =>
        u.id === uploadId ? { ...u, status: newStatus } : u
      ),
    }));
  }, []);

  // Fetch clone history on mount
  useEffect(() => {
    async function fetchCloneHistory() {
      try {
        const response = await fetch(`/api/requests/${request.id}/clone`);
        if (response.ok) {
          const data = await response.json();
          setCloneHistory(data);
        }
      } catch (error) {
        console.error("Failed to fetch clone history:", error);
      } finally {
        setLoadingHistory(false);
      }
    }

    fetchCloneHistory();
  }, [request.id]);

  const handleCloneSuccess = (clonedRequestIds: string[]) => {
    toast.success(`Successfully created ${clonedRequestIds.length} cloned request(s)`);
    // Refresh clone history
    fetch(`/api/requests/${request.id}/clone`)
      .then((res) => res.json())
      .then((data) => setCloneHistory(data))
      .catch(console.error);
  };

  const requirements = request.requirements;
  const fields = request.fields;

  // Prepare request data for clone dialog
  const requestForClone = {
    id: request.id,
    title: request.title,
    description: request.description,
    dueDate: request.dueDate ? request.dueDate.toISOString() : null,
    urgency: request.urgency,
    status: request.status,
    fields: request.fields,
    requirements: request.requirements,
    creator: request.creator,
    template: request.template,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/requests">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                <EditableRequestTitle
                  requestId={request.id}
                  title={request.title}
                  onUpdate={handleTitleUpdate}
                  size="lg"
                />
              </h1>
              <EditableStatusBadge
                requestId={request.id}
                status={request.status}
                onUpdate={handleStatusUpdate}
                size="md"
              />
              <EditablePriorityBadge
                requestId={request.id}
                priority={request.urgency}
                onUpdate={handlePriorityUpdate}
                size="md"
              />
              {cloneHistory?.isClone && (
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800">
                  <Copy className="h-3 w-3 mr-1" />
                  Clone
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <Link
                  href={`/dashboard/creators/${request.creator.id}`}
                  className="hover:underline"
                >
                  {request.creator.name}
                </Link>
              </div>
              <div className="flex items-center gap-1">
                <EditableDueDate
                  requestId={request.id}
                  dueDate={request.dueDate}
                  onUpdate={handleDueDateUpdate}
                  size="sm"
                />
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Created {formatDistanceToNow(request.createdAt, { addSuffix: true })}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCloneDialogOpen(true)}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
          >
            <Copy className="mr-2 h-4 w-4" />
            Clone Request
          </Button>
          <RequestActions
            request={request}
            onCloneClick={() => setCloneDialogOpen(true)}
            hideCloneButton={true}
          />
        </div>
      </div>

      {/* Clone Origin Banner */}
      {cloneHistory?.isClone && cloneHistory.clonedFrom && (
        <Card className="border-indigo-200 bg-indigo-50/50 dark:bg-indigo-900/10 dark:border-indigo-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                <GitBranch className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300">
                  This request was cloned from another request
                </p>
                <p className="text-sm text-indigo-700 dark:text-indigo-400">
                  Original: {cloneHistory.clonedFrom.title} ({cloneHistory.clonedFrom.creator.name})
                  {cloneHistory.clonedFrom.clonedAt && (
                    <span className="ml-2">
                      - cloned {formatDistanceToNow(new Date(cloneHistory.clonedFrom.clonedAt), { addSuffix: true })}
                    </span>
                  )}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="border-indigo-200 dark:border-indigo-800">
                <Link href={`/dashboard/requests/${cloneHistory.clonedFrom.id}`}>
                  <ExternalLink className="mr-2 h-3 w-3" />
                  View Original
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {request.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <HtmlContent html={request.description} />
              </CardContent>
            </Card>
          )}

          {/* Non-file fields (text, number, etc.) */}
          {fields && fields.filter(f => f.type !== "file").length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {fields.filter(f => f.type !== "file").map((field, index) => (
                    <div key={index} className="flex justify-between">
                      <p className="text-sm text-muted-foreground">{field.label}</p>
                      <p className="font-medium">{field.value || "—"}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* File fields with their uploads */}
          {fields && fields.filter(f => f.type === "file").map((field) => {
            const fieldUploads = request.uploads.filter(u => u.fieldId === field.id);
            return (
              <Card key={field.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        {field.label}
                      </CardTitle>
                      <CardDescription>
                        {fieldUploads.length} file{fieldUploads.length !== 1 ? "s" : ""} uploaded
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <UploadsList
                    uploads={fieldUploads}
                    requestId={request.id}
                    onStatusChange={handleUploadStatusChange}
                  />
                </CardContent>
              </Card>
            );
          })}

          {/* Ungrouped uploads (uploads without a fieldId) */}
          {request.uploads.filter(u => !u.fieldId).length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Other Uploads
                    </CardTitle>
                    <CardDescription>
                      {request.uploads.filter(u => !u.fieldId).length} file{request.uploads.filter(u => !u.fieldId).length !== 1 ? "s" : ""} uploaded
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <UploadsList
                  uploads={request.uploads.filter(u => !u.fieldId)}
                  requestId={request.id}
                  onStatusChange={handleUploadStatusChange}
                />
              </CardContent>
            </Card>
          )}

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Comments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CommentSection
                requestId={request.id}
                comments={request.comments}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Request ID</p>
                <CopyableId
                  text={request.id}
                  maxWidth="180px"
                  onCopySuccess={() => toast.success("Request ID copied to clipboard")}
                />
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Current Status</p>
                <EditableStatusBadge
                  requestId={request.id}
                  status={request.status}
                  onUpdate={handleStatusUpdate}
                  size="md"
                />
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Created</p>
                <p className="text-sm">
                  {format(request.createdAt, "MMMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
              {request.submittedAt && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Submitted</p>
                  <p className="text-sm">
                    {format(request.submittedAt, "MMMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              )}
              {request.reviewedAt && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Reviewed</p>
                  <p className="text-sm">
                    {format(request.reviewedAt, "MMMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Creator Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Creator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar
                  size="md"
                  user={{
                    name: request.creator.name,
                    email: request.creator.email,
                    image: request.creator.avatar,
                  }}
                />
                <div>
                  <Link
                    href={`/dashboard/creators/${request.creator.id}`}
                    className="font-medium hover:underline"
                  >
                    {request.creator.name}
                  </Link>
                  <CopyableEmail
                    text={request.creator.email}
                    maxWidth="200px"
                    className="text-sm"
                    onCopySuccess={() => toast.success("Email copied to clipboard")}
                  />
                </div>
              </div>
              {request.creator.phone && (
                <div className="text-sm text-muted-foreground">
                  {request.creator.phone}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" asChild>
                  <Link href={`/dashboard/requests/new?creatorId=${request.creator.id}`}>
                    <FileText className="mr-2 h-4 w-4" />
                    New Request
                  </Link>
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openCreatorContext(request.creator.id)}
                    >
                      <PanelRightOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View creator context (C)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </Card>

          {/* Template Card */}
          {request.template && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Template Used</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline">{request.template.name}</Badge>
              </CardContent>
            </Card>
          )}

          {/* Watchers Panel */}
          <WatchersPanel
            requestId={request.id}
            watchers={watchers}
            currentUserId={userId}
            canManageWatchers={["OWNER", "ADMIN", "MANAGER"].includes(currentUser.role)}
            onWatchersChange={setWatchers}
          />

          {/* Clone History Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Clone History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : cloneHistory && cloneHistory.clones.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {cloneHistory.cloneCount} clone{cloneHistory.cloneCount !== 1 ? "s" : ""} created from this request
                  </p>
                  <div className="space-y-2">
                    {cloneHistory.clones.slice(0, 5).map((clone) => (
                      <Link
                        key={clone.id}
                        href={`/dashboard/requests/${clone.id}`}
                        className="block p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar
                              size="xs"
                              user={{
                                name: clone.creator.name,
                                email: clone.creator.email,
                                image: clone.creator.avatar,
                              }}
                            />
                            <span className="text-sm truncate">{clone.creator.name}</span>
                          </div>
                          {getStatusBadge(clone.status)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(clone.createdAt), { addSuffix: true })}
                        </p>
                      </Link>
                    ))}
                  </div>
                  {cloneHistory.clones.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{cloneHistory.clones.length - 5} more clone(s)
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Copy className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No clones yet</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2 text-indigo-600"
                    onClick={() => setCloneDialogOpen(true)}
                  >
                    Clone this request
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Internal Notes */}
          <NotesPanel
            entityType="request"
            entityId={request.id}
            initialNotes={notes}
            currentUser={currentUser}
            apiBasePath="/api/notes"
            title="Internal Notes"
            description="Private notes about this request"
            onNotesChange={setNotes}
            compact={true}
          />
        </div>
      </div>

      {/* Clone Dialog */}
      <CloneRequestDialog
        request={requestForClone}
        creators={creators}
        open={cloneDialogOpen}
        onOpenChange={setCloneDialogOpen}
        onCloneSuccess={handleCloneSuccess}
      />
    </div>
  );
}
