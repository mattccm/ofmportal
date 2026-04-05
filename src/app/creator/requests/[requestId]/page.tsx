"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileDropzone } from "@/components/uploads/file-dropzone";
import { UploadQueue } from "@/components/uploads/upload-queue";
import { FieldExamplesDisplay } from "@/components/portal/field-examples-display";
import { PerFieldUpload } from "@/components/portal/per-field-upload";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useBranding } from "@/components/providers/branding-provider";
import type { TemplateField } from "@/lib/template-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Timer,
  ChevronDown,
  ChevronUp,
  Upload,
} from "lucide-react";
import { format, formatDistanceToNow, differenceInDays, isPast } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { HtmlContent } from "@/components/ui/html-content";

interface RequestField {
  id?: string;
  label: string;
  value: string;
  type: string;
  richContent?: TemplateField["richContent"];
  required?: boolean;
  acceptedFileTypes?: string[];
  maxFiles?: number;
  minFiles?: number;
  maxFileSize?: number;
  helpText?: string;
}

interface FieldSubmission {
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "NEEDS_REVISION";
  submittedAt?: string;
  reviewedAt?: string;
  feedback?: string;
}

interface Request {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  requirements: Record<string, unknown> & {
    _richContent?: {
      exampleText?: string;
      exampleImages?: { url: string; caption?: string }[];
      exampleVideoUrl?: string;
      referenceLinks?: { label: string; url: string }[];
    };
  };
  fields: RequestField[];
  fieldSubmissions?: Record<string, FieldSubmission>;
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
  storageKey?: string;
  fieldId?: string | null;
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
  const [pendingFieldId, setPendingFieldId] = useState<string | undefined>(undefined);
  const [duplicateProcessing, setDuplicateProcessing] = useState(false);
  const [duplicateAlertResult, setDuplicateAlertResult] = useState<{ result: DuplicateCheckResult; fileName: string } | null>(null);

  // UI state - must be at top level before any conditionals
  const [showDetails, setShowDetails] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

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
    const avatar = localStorage.getItem("creatorAvatar");

    if (!token || !creatorId) {
      router.push("/login");
      return;
    }

    setCreator({
      id: creatorId,
      name: name || "Creator",
      email: email || "",
      image: avatar || undefined,
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
    addFiles(pendingFiles, pendingFieldId);
    setDuplicateProcessing(false);
    setDuplicateDialogOpen(false);
    setPendingFiles([]);
    setPendingFieldId(undefined);
    setDuplicateResult(null);
  };

  const handleDuplicateKeepBoth = async () => {
    if (pendingFiles.length === 0) return;
    setDuplicateProcessing(true);
    addFiles(pendingFiles, pendingFieldId);
    setDuplicateProcessing(false);
    setDuplicateDialogOpen(false);
    setPendingFiles([]);
    setPendingFieldId(undefined);
    setDuplicateResult(null);
  };

  const handleDuplicateCancel = () => {
    setDuplicateDialogOpen(false);
    setPendingFiles([]);
    setPendingFieldId(undefined);
    setDuplicateResult(null);
  };

  const handleFilesSelected = async (files: FileList | File[], fieldId?: string) => {
    const fileArray = Array.from(files);

    if (fileArray.length > 0) {
      const duplicateCheck = await checkDuplicates(fileArray[0]);

      if (duplicateCheck && duplicateCheck.isDuplicate && duplicateCheck.highestConfidence >= 0.7) {
        setPendingFiles(fileArray);
        setPendingFieldId(fieldId);
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

    addFiles(fileArray, fieldId);
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

  // Get file fields from request
  const fileFields = request.fields?.filter(f => f.type === "file") || [];
  const nonFileFields = request.fields?.filter(f => f.type !== "file") || [];
  const hasFileFields = fileFields.length > 0;

  // Handler for deleting uploads
  const handleDeleteUpload = async (uploadId: string) => {
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch(`/api/uploads/${uploadId}`, {
        method: "DELETE",
        headers: {
          "x-creator-token": token || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete upload");
      }

      toast.success("File deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete file");
    }
  };

  // Handler for per-field submit
  const handleFieldSubmit = async (fieldId: string) => {
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch(`/api/portal/requests/${requestId}/fields/${fieldId}/submit`, {
        method: "POST",
        headers: {
          "x-creator-token": token || "",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit field");
      }

      toast.success("Field submitted for review");
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit field");
    }
  };

  // Handler for redacting a field submission
  const handleFieldRedact = async (fieldId: string) => {
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch(`/api/portal/requests/${requestId}/fields/${fieldId}/redact`, {
        method: "POST",
        headers: {
          "x-creator-token": token || "",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to redact submission");
      }

      toast.success("Submission redacted - you can now make changes");
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to redact submission");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Back navigation */}
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground hover:text-foreground"
      >
        <Link href="/creator/requests">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Link>
      </Button>

      {/* Clean Header: Title + Due Date + Status */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">
              {request.title}
            </h1>
            {dueInfo && (
              <p className={cn(
                "text-sm mt-1 flex items-center gap-1.5",
                dueInfo.isOverdue
                  ? "text-red-600"
                  : dueInfo.daysUntil <= 3
                    ? "text-amber-600"
                    : "text-muted-foreground"
              )}>
                <Calendar className="h-3.5 w-3.5" />
                {dueInfo.isOverdue
                  ? `Overdue · ${dueInfo.formatted}`
                  : dueInfo.daysUntil === 0
                    ? `Due Today · ${dueInfo.formatted}`
                    : `Due ${dueInfo.relative} · ${dueInfo.formatted}`}
              </p>
            )}
          </div>
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 font-medium shrink-0",
              statusInfo.bgClass,
              statusInfo.color
            )}
          >
            {statusInfo.icon}
            {statusInfo.label}
          </Badge>
        </div>

        {/* Description/Instructions - Collapsible */}
        {(request.description || request.requirements?._richContent) && (
          <div className="space-y-2">
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showInstructions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showInstructions ? "Hide instructions" : "Show instructions"}
            </button>
            {showInstructions && (
              <div className="space-y-3">
                {request.description && (
                  <HtmlContent
                    html={request.description}
                    className="text-muted-foreground leading-relaxed"
                  />
                )}
                {/* Template-level examples (images, videos, links) */}
                {request.requirements?._richContent && (
                  <FieldExamplesDisplay
                    richContent={request.requirements._richContent}
                    fieldLabel="Request"
                    variant="card"
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Revision notice */}
        {request.status === "NEEDS_REVISION" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">Revisions requested - please check comments below</span>
          </div>
        )}

        {/* Additional details toggle (for non-file fields like text, number, etc.) */}
        {nonFileFields.length > 0 && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showDetails ? "Hide additional info" : "Show additional info"}
          </button>
        )}

        {/* Collapsible details section */}
        {showDetails && nonFileFields.length > 0 && (
          <div className="space-y-3 pt-2">
            {/* Non-file fields */}
            {nonFileFields.map((field, index) => (
              <div key={field.id || index} className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">{field.label}:</span>{" "}
                    <span className="font-medium">{field.value}</span>
                  </p>
                </div>
                {field.richContent && (
                  <FieldExamplesDisplay
                    richContent={field.richContent}
                    fieldLabel={field.label}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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

      {/* Upload Section - Per Field (always show if there are file fields) */}
      {hasFileFields && (
        <div className="space-y-2">
          {duplicateAlertResult && (
            <DuplicateAlert
              result={duplicateAlertResult.result}
              fileName={duplicateAlertResult.fileName}
              onDismiss={() => setDuplicateAlertResult(null)}
            />
          )}

          <PerFieldUpload
            fields={fileFields.map(f => ({
              id: f.id || `field-${f.label}`,
              label: f.label,
              type: "file" as const,
              required: f.required,
              acceptedFileTypes: f.acceptedFileTypes,
              maxFiles: f.maxFiles,
              minFiles: f.minFiles,
              maxFileSize: f.maxFileSize,
              helpText: f.helpText,
              richContent: f.richContent,
            }))}
            uploads={uploads}
            queue={uploadQueue}
            fieldSubmissions={request.fieldSubmissions}
            onFilesSelected={handleFilesSelected}
            onPause={pauseFile}
            onResume={resumeFile}
            onRetry={retryFile}
            onCancel={cancelFile}
            onRemove={removeFile}
            onClearCompleted={clearCompleted}
            onPauseAll={pauseAll}
            onResumeAll={resumeAll}
            onFieldSubmit={handleFieldSubmit}
            onFieldRedact={handleFieldRedact}
            onDeleteUpload={handleDeleteUpload}
            isUploading={isUploading}
            primaryColor={branding.primaryColor}
            canUpload={canUpload}
          />
        </div>
      )}

      {/* Fallback: Standard upload UI when no file fields defined */}
      {canUpload && !hasFileFields && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Upload Content</h2>

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
        </div>
      )}

      {/* Submit Button - Clean and minimal */}
      {canSubmit && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            size="lg"
            className="px-8 h-12 text-base font-medium shadow-lg hover:shadow-xl transition-shadow"
            style={{ backgroundColor: branding.primaryColor }}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-5 w-5" />
            )}
            Submit for Review
          </Button>
          <p className="text-sm text-muted-foreground">
            {uploads.length} file{uploads.length !== 1 ? "s" : ""} ready to submit
          </p>
        </div>
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

      {/* Comments / Feedback - Collapsible */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" style={{ color: branding.primaryColor }} />
          <h2 className="text-lg font-semibold">Comments</h2>
          {comments.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {comments.length}
            </Badge>
          )}
        </div>

        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No comments yet. Send a message if you have any questions.
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

        <div className="flex gap-3">
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
      </div>
    </div>
  );
}
