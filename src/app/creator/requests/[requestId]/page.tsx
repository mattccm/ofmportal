"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UploadedFilesGrid } from "@/components/portal/upload-zone";
import { FileDropzone } from "@/components/uploads/file-dropzone";
import { UploadQueue } from "@/components/uploads/upload-queue";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useBranding } from "@/components/providers/branding-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import {
  DuplicateWarningDialog,
  DuplicateAlert,
} from "@/components/uploads/duplicate-warning";
import type { DuplicateCheckResult } from "@/lib/duplicate-detection";
import {
  Loader2,
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  MessageCircle,
  FileText,
  Upload,
  Sparkles,
  Timer,
} from "lucide-react";
import { format, formatDistanceToNow, differenceInDays, isPast } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Request {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  requirements: Record<string, string>;
  fields: Array<{ label: string; value: string; type: string }>;
}

interface UploadFile {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  status: string;
  uploadStatus: string;
  thumbnailUrl?: string;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user?: {
    name: string;
    image?: string;
  };
  isAgency: boolean;
}

const statusConfig: Record<
  string,
  { label: string; color: string; bgClass: string; icon: React.ReactNode }
> = {
  PENDING: {
    label: "Pending",
    color: "text-amber-600",
    bgClass: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",
    icon: <Clock className="h-4 w-4 text-amber-500" />,
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "text-blue-600",
    bgClass: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
    icon: <Upload className="h-4 w-4 text-blue-500" />,
  },
  SUBMITTED: {
    label: "Submitted",
    color: "text-violet-600",
    bgClass: "bg-violet-50 border-violet-200 dark:bg-violet-900/20 dark:border-violet-800",
    icon: <Send className="h-4 w-4 text-violet-500" />,
  },
  UNDER_REVIEW: {
    label: "Under Review",
    color: "text-orange-600",
    bgClass: "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800",
    icon: <Timer className="h-4 w-4 text-orange-500" />,
  },
  NEEDS_REVISION: {
    label: "Needs Revision",
    color: "text-red-600",
    bgClass: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
    icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
  },
  APPROVED: {
    label: "Approved",
    color: "text-emerald-600",
    bgClass: "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  },
};

export default function CreatorRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = use(params);
  const router = useRouter();
  const { branding } = useBranding();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<Request | null>(null);
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [creator, setCreator] = useState<{
    id: string;
    name: string;
    email: string;
    image?: string;
  } | null>(null);

  // Duplicate detection state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [duplicateProcessing, setDuplicateProcessing] = useState(false);
  const [duplicateAlertResult, setDuplicateAlertResult] = useState<{ result: DuplicateCheckResult; fileName: string } | null>(null);

  const {
    queue: uploadQueue,
    addFiles,
    pauseFile,
    resumeFile,
    retryFile,
    cancelFile,
    removeFile,
    clearCompleted,
    pauseAll,
    resumeAll,
    isUploading,
    totalProgress,
    totalSize,
    uploadedSize,
  } = useFileUpload({
    requestId,
    maxConcurrent: 3,
    onUploadComplete: () => {
      fetchData();
    },
    onAllComplete: () => {},
  });

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch(`/api/portal/requests/${requestId}`, {
        headers: {
          "x-creator-token": token || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch request");
      }

      const data = await response.json();
      setRequest(data.request);
      setUploads(data.uploads || []);
      setComments(data.comments || []);
    } catch (error) {
      console.error("Error fetching request:", error);
      toast.error("Failed to load request");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    const token = localStorage.getItem("creatorToken");
    const creatorId = localStorage.getItem("creatorId");
    const name = localStorage.getItem("creatorName");
    const email = localStorage.getItem("creatorEmail");

    if (!token || !creatorId) {
      router.push("/login");
      return;
    }

    setCreator({
      id: creatorId,
      name: name || "Creator",
      email: email || "",
    });

    fetchData();
  }, [router, fetchData]);

  const checkDuplicates = async (file: File): Promise<DuplicateCheckResult | null> => {
    const token = localStorage.getItem("creatorToken");
    try {
      const response = await fetch("/api/uploads/check-duplicate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-creator-token": token || "",
        },
        body: JSON.stringify({
          requestId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          checkScope: "creator",
        }),
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error("Error checking for duplicates:", error);
      return null;
    }
  };

  const handleDuplicateReplace = async () => {
    if (pendingFiles.length === 0) return;
    setDuplicateProcessing(true);
    addFiles(pendingFiles);
    setDuplicateProcessing(false);
    setDuplicateDialogOpen(false);
    setPendingFiles([]);
    setDuplicateResult(null);
  };

  const handleDuplicateKeepBoth = async () => {
    if (pendingFiles.length === 0) return;
    setDuplicateProcessing(true);
    addFiles(pendingFiles);
    setDuplicateProcessing(false);
    setDuplicateDialogOpen(false);
    setPendingFiles([]);
    setDuplicateResult(null);
  };

  const handleDuplicateCancel = () => {
    setDuplicateDialogOpen(false);
    setPendingFiles([]);
    setDuplicateResult(null);
  };

  const handleFilesSelected = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    if (fileArray.length > 0) {
      const duplicateCheck = await checkDuplicates(fileArray[0]);

      if (duplicateCheck && duplicateCheck.isDuplicate && duplicateCheck.highestConfidence >= 0.7) {
        setPendingFiles(fileArray);
        setDuplicateResult(duplicateCheck);
        setDuplicateDialogOpen(true);
        return;
      } else if (duplicateCheck && duplicateCheck.isDuplicate) {
        setDuplicateAlertResult({
          result: duplicateCheck,
          fileName: fileArray[0].name,
        });
        setTimeout(() => setDuplicateAlertResult(null), 5000);
      }
    }

    addFiles(fileArray);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch(`/api/portal/requests/${requestId}/submit`, {
        method: "POST",
        headers: {
          "x-creator-token": token || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to submit");
      }

      toast.success("Content submitted for review!");
      fetchData();
    } catch {
      toast.error("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim()) return;

    setSendingComment(true);
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch(`/api/portal/requests/${requestId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-creator-token": token || "",
        },
        body: JSON.stringify({ content: newComment }),
      });

      if (!response.ok) {
        throw new Error("Failed to send comment");
      }

      setNewComment("");
      toast.success("Comment sent");
      fetchData();
    } catch {
      toast.error("Failed to send comment");
    } finally {
      setSendingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2
            className="h-10 w-10 animate-spin mx-auto"
            style={{ color: branding.primaryColor }}
          />
          <p className="text-muted-foreground">Loading request...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-lg font-semibold mb-2">Request Not Found</h2>
            <p className="text-muted-foreground mb-4">
              This request may have been removed or you don&apos;t have access.
            </p>
            <Button asChild>
              <Link href="/creator/dashboard">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canUpload =
    request.status === "PENDING" ||
    request.status === "IN_PROGRESS" ||
    request.status === "NEEDS_REVISION";

  const hasActiveUploads = uploadQueue.some(
    (f) => f.status === "uploading" || f.status === "pending" || f.status === "paused"
  );

  const canSubmit = canUpload && uploads.length > 0 && !hasActiveUploads;

  const statusInfo = statusConfig[request.status] || statusConfig.PENDING;

  const dueInfo = request.dueDate
    ? {
        date: new Date(request.dueDate),
        formatted: format(new Date(request.dueDate), "MMMM d, yyyy"),
        relative: formatDistanceToNow(new Date(request.dueDate), {
          addSuffix: true,
        }),
        daysUntil: differenceInDays(new Date(request.dueDate), new Date()),
        isOverdue: isPast(new Date(request.dueDate)),
      }
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Back navigation */}
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground"
      >
        <Link href="/creator/requests">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Requests
        </Link>
      </Button>

      {/* Request Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className={cn(
                  "gap-1.5 font-medium",
                  statusInfo.bgClass,
                  statusInfo.color
                )}
              >
                {statusInfo.icon}
                {statusInfo.label}
              </Badge>
              {request.status === "NEEDS_REVISION" && (
                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-800">
                  Action Required
                </Badge>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold">{request.title}</h1>
            {request.description && (
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm sm:text-base">
                {request.description}
              </p>
            )}
          </div>

          {/* Due date countdown */}
          {dueInfo && (
            <Card
              className={cn(
                "shrink-0 w-full sm:w-auto",
                dueInfo.isOverdue && "border-red-200 bg-red-50/50 dark:bg-red-900/20 dark:border-red-800",
                !dueInfo.isOverdue &&
                  dueInfo.daysUntil <= 3 &&
                  "border-amber-200 bg-amber-50/50 dark:bg-amber-900/20 dark:border-amber-800"
              )}
            >
              <CardContent className="p-4 text-center">
                <Calendar
                  className={cn(
                    "h-5 w-5 mx-auto mb-2",
                    dueInfo.isOverdue
                      ? "text-red-500"
                      : dueInfo.daysUntil <= 3
                        ? "text-amber-500"
                        : "text-muted-foreground"
                  )}
                />
                <p
                  className={cn(
                    "text-2xl font-bold",
                    dueInfo.isOverdue
                      ? "text-red-600"
                      : dueInfo.daysUntil <= 3
                        ? "text-amber-600"
                        : ""
                  )}
                >
                  {dueInfo.isOverdue
                    ? "Overdue"
                    : dueInfo.daysUntil === 0
                      ? "Due Today"
                      : `${dueInfo.daysUntil}d`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dueInfo.formatted}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Requirements Card */}
      {((request.requirements &&
        Object.keys(request.requirements).length > 0) ||
        (request.fields && request.fields.length > 0)) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" style={{ color: branding.primaryColor }} />
              Requirements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {request.requirements && (
              <div className="grid gap-3 sm:grid-cols-2">
                {request.requirements.quantity && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Quantity
                    </p>
                    <p className="font-medium">{request.requirements.quantity}</p>
                  </div>
                )}
                {request.requirements.format && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Format
                    </p>
                    <p className="font-medium">{request.requirements.format}</p>
                  </div>
                )}
                {request.requirements.resolution && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Resolution
                    </p>
                    <p className="font-medium">{request.requirements.resolution}</p>
                  </div>
                )}
              </div>
            )}
            {request.requirements?.notes && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                  Notes
                </p>
                <p className="text-sm">{request.requirements.notes}</p>
              </div>
            )}
            {request.fields && request.fields.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {request.fields.map((field, index) => (
                  <div key={index} className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      {field.label}
                    </p>
                    <p className="font-medium">{field.value}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Section */}
      {canUpload && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-5 w-5" style={{ color: branding.primaryColor }} />
              Upload Content
            </CardTitle>
            <CardDescription>
              Drag and drop files or tap to select. We support images, videos, and audio up to 5GB.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {duplicateAlertResult && (
              <DuplicateAlert
                result={duplicateAlertResult.result}
                fileName={duplicateAlertResult.fileName}
                onDismiss={() => setDuplicateAlertResult(null)}
              />
            )}

            <FileDropzone
              onFilesSelected={handleFilesSelected}
              fullPageDrop={true}
              showPasteButton={true}
            />

            {uploadQueue.length > 0 && (
              <UploadQueue
                queue={uploadQueue}
                onPause={pauseFile}
                onResume={resumeFile}
                onRetry={retryFile}
                onCancel={cancelFile}
                onRemove={removeFile}
                onClearCompleted={clearCompleted}
                onPauseAll={pauseAll}
                onResumeAll={resumeAll}
                totalProgress={totalProgress}
                totalSize={totalSize}
                uploadedSize={uploadedSize}
                isUploading={isUploading}
                collapsible={true}
                maxVisibleItems={5}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Duplicate Warning Dialog */}
      {duplicateResult && pendingFiles.length > 0 && (
        <DuplicateWarningDialog
          open={duplicateDialogOpen}
          onOpenChange={setDuplicateDialogOpen}
          result={duplicateResult}
          newFile={{
            name: pendingFiles[0].name,
            size: pendingFiles[0].size,
            type: pendingFiles[0].type,
          }}
          onReplace={handleDuplicateReplace}
          onKeepBoth={handleDuplicateKeepBoth}
          onCancel={handleDuplicateCancel}
          isProcessing={duplicateProcessing}
        />
      )}

      {/* Uploaded Files */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" style={{ color: branding.primaryColor }} />
              Uploaded Files
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {uploads.length} file{uploads.length !== 1 ? "s" : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UploadedFilesGrid files={uploads} />
        </CardContent>
      </Card>

      {/* Comments / Feedback */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-5 w-5" style={{ color: branding.primaryColor }} />
            Comments & Feedback
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">
              No comments yet
            </p>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className={cn(
                    "flex gap-3",
                    !comment.isAgency && "flex-row-reverse"
                  )}
                >
                  <Avatar
                    size="sm"
                    user={{
                      name: comment.isAgency
                        ? comment.user?.name || "Agency"
                        : creator?.name || "You",
                      image: comment.isAgency
                        ? comment.user?.image
                        : creator?.image,
                    }}
                  />
                  <div
                    className={cn(
                      "flex-1 max-w-[80%]",
                      !comment.isAgency && "text-right"
                    )}
                  >
                    <div
                      className={cn(
                        "inline-block rounded-2xl px-4 py-2",
                        comment.isAgency
                          ? "bg-muted rounded-tl-none"
                          : "rounded-tr-none text-white"
                      )}
                      style={!comment.isAgency ? { backgroundColor: branding.primaryColor } : undefined}
                    >
                      <p className="text-sm">{comment.content}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(comment.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <Textarea
              placeholder="Type a message..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[60px] resize-none"
            />
            <Button
              onClick={handleSendComment}
              disabled={!newComment.trim() || sendingComment}
              className="shrink-0"
              style={{ backgroundColor: branding.primaryColor }}
            >
              {sendingComment ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      {canSubmit && (
        <Card
          className="border-2"
          style={{ borderColor: `${branding.primaryColor}40` }}
        >
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`,
                }}
              >
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Ready to Submit?</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  You have {uploads.length} file{uploads.length !== 1 ? "s" : ""}{" "}
                  ready. Submit your content for review.
                </p>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                size="lg"
                className="px-8"
                style={{ backgroundColor: branding.primaryColor }}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit for Review
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Messages */}
      {(request.status === "SUBMITTED" || request.status === "UNDER_REVIEW") && (
        <Card className="border-violet-200 bg-violet-50/50 dark:bg-violet-900/20 dark:border-violet-800">
          <CardContent className="py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
              <Timer className="h-6 w-6 text-violet-600" />
            </div>
            <h3 className="font-semibold text-lg mb-1">Under Review</h3>
            <p className="text-muted-foreground text-sm">
              Your content has been submitted and is being reviewed. You&apos;ll be notified when there&apos;s an update.
            </p>
          </CardContent>
        </Card>
      )}

      {request.status === "APPROVED" && (
        <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/20 dark:border-emerald-800">
          <CardContent className="py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-lg mb-1">Content Approved</h3>
            <p className="text-muted-foreground text-sm">
              Great work! Your content has been approved.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
