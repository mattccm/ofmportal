"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  History,
  RotateCcw,
  Eye,
  MessageSquare,
  Clock,
  User,
  GitCompare,
  Upload,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  AlertTriangle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/file-utils";
import { VersionCompare } from "./version-compare";

// Types for version history
export interface UploadVersion {
  id: string;
  versionNumber: number;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  storageKey: string;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
  uploadedAt: Date;
  uploadedBy: {
    id: string;
    name: string;
    avatar?: string | null;
  };
  notes?: string | null;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    [key: string]: unknown;
  };
  status: "CURRENT" | "PREVIOUS" | "RESTORED";
  isCurrent: boolean;
}

export interface VersionComment {
  id: string;
  versionId: string;
  message: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    avatar?: string | null;
  };
}

interface VersionHistoryProps {
  uploadId: string;
  currentVersion?: UploadVersion;
  onVersionRestore?: (versionId: string) => void;
  className?: string;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
  if (mimeType.startsWith("video/")) return <Video className="h-4 w-4" />;
  if (mimeType.startsWith("audio/")) return <Music className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

export function VersionHistory({
  uploadId,
  currentVersion,
  onVersionRestore,
  className,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<UploadVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
  const [versionComments, setVersionComments] = useState<Record<string, VersionComment[]>>({});
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedRestoreVersion, setSelectedRestoreVersion] = useState<UploadVersion | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [compareVersions, setCompareVersions] = useState<{
    left: UploadVersion | null;
    right: UploadVersion | null;
  }>({ left: null, right: null });

  // Load version history
  useEffect(() => {
    loadVersionHistory();
  }, [uploadId]);

  const loadVersionHistory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/uploads/${uploadId}/versions`);
      if (!response.ok) {
        throw new Error("Failed to load version history");
      }
      const data = await response.json();
      setVersions(data.versions || []);
    } catch (err) {
      setError("Failed to load version history");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadVersionComments = async (versionId: string) => {
    try {
      const response = await fetch(`/api/uploads/${uploadId}/versions/${versionId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setVersionComments((prev) => ({
          ...prev,
          [versionId]: data.comments || [],
        }));
      }
    } catch (err) {
      console.error("Failed to load version comments:", err);
    }
  };

  const handleToggleVersion = async (versionId: string) => {
    if (expandedVersion === versionId) {
      setExpandedVersion(null);
    } else {
      setExpandedVersion(versionId);
      if (!versionComments[versionId]) {
        await loadVersionComments(versionId);
      }
    }
  };

  const handleAddComment = async (versionId: string) => {
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const response = await fetch(`/api/uploads/${uploadId}/versions/${versionId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newComment }),
      });

      if (!response.ok) {
        throw new Error("Failed to add comment");
      }

      const data = await response.json();
      setVersionComments((prev) => ({
        ...prev,
        [versionId]: [...(prev[versionId] || []), data.comment],
      }));
      setNewComment("");
      toast.success("Comment added");
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleRestoreVersion = async () => {
    if (!selectedRestoreVersion) return;

    setIsRestoring(true);
    try {
      const response = await fetch(`/api/uploads/${uploadId}/versions/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: selectedRestoreVersion.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to restore version");
      }

      toast.success(`Restored to version ${selectedRestoreVersion.versionNumber}`);
      setRestoreDialogOpen(false);
      setSelectedRestoreVersion(null);
      await loadVersionHistory();
      onVersionRestore?.(selectedRestoreVersion.id);
    } catch {
      toast.error("Failed to restore version");
    } finally {
      setIsRestoring(false);
    }
  };

  const openCompareDialog = (version: UploadVersion) => {
    const currentVer = versions.find((v) => v.isCurrent);
    setCompareVersions({
      left: version,
      right: currentVer || null,
    });
    setCompareDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card className={cn("border-indigo-200/50 dark:border-indigo-800/30", className)}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <span className="ml-2 text-muted-foreground">Loading version history...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("border-red-200/50 dark:border-red-800/30", className)}>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
          <p className="text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={loadVersionHistory}
            className="mt-4"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (versions.length === 0) {
    return (
      <Card className={cn("border-indigo-200/50 dark:border-indigo-800/30", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-indigo-500" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <div className="rounded-full bg-indigo-50 dark:bg-indigo-950/30 p-3 mb-3">
            <Upload className="h-6 w-6 text-indigo-500" />
          </div>
          <p className="text-sm text-muted-foreground">
            No previous versions available
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Version history will appear when the file is re-uploaded
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={cn("border-indigo-200/50 dark:border-indigo-800/30", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-indigo-500" />
              Version History
              <Badge variant="secondary" className="ml-1 text-xs">
                {versions.length} {versions.length === 1 ? "version" : "versions"}
              </Badge>
            </CardTitle>
            {versions.length >= 2 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:text-indigo-400 dark:border-indigo-800 dark:hover:bg-indigo-950/30"
                onClick={() => {
                  const sortedVersions = [...versions].sort(
                    (a, b) => b.versionNumber - a.versionNumber
                  );
                  setCompareVersions({
                    left: sortedVersions[1] || null,
                    right: sortedVersions[0] || null,
                  });
                  setCompareDialogOpen(true);
                }}
              >
                <GitCompare className="h-3.5 w-3.5" />
                Compare
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-0">
          {/* Timeline */}
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-indigo-300 via-violet-300 to-purple-300 dark:from-indigo-700 dark:via-violet-700 dark:to-purple-700" />

            {versions.map((version, index) => (
              <div
                key={version.id}
                className={cn(
                  "relative pl-10 pb-4 last:pb-0 transition-all duration-200",
                  expandedVersion === version.id && "pb-6"
                )}
              >
                {/* Timeline dot */}
                <div
                  className={cn(
                    "absolute left-[7px] top-2 h-4 w-4 rounded-full border-2 bg-background transition-all duration-200",
                    version.isCurrent
                      ? "border-indigo-500 ring-4 ring-indigo-100 dark:ring-indigo-950"
                      : version.status === "RESTORED"
                      ? "border-violet-500"
                      : "border-muted-foreground/30"
                  )}
                />

                {/* Version card */}
                <div
                  className={cn(
                    "group rounded-lg border bg-card transition-all duration-200 hover:shadow-sm",
                    version.isCurrent
                      ? "border-indigo-200 bg-indigo-50/30 dark:border-indigo-800/50 dark:bg-indigo-950/20"
                      : "border-border/50 hover:border-border"
                  )}
                >
                  {/* Header */}
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 p-3 text-left"
                    onClick={() => handleToggleVersion(version.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
                          version.isCurrent
                            ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {getFileIcon(version.fileType)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            Version {version.versionNumber}
                          </span>
                          {version.isCurrent && (
                            <Badge className="bg-indigo-500 hover:bg-indigo-600 text-[10px] px-1.5 py-0">
                              Current
                            </Badge>
                          )}
                          {version.status === "RESTORED" && (
                            <Badge
                              variant="outline"
                              className="border-violet-300 text-violet-600 dark:border-violet-700 dark:text-violet-400 text-[10px] px-1.5 py-0"
                            >
                              Restored
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="truncate max-w-[150px]">{version.originalName}</span>
                          <span className="shrink-0">{formatFileSize(version.fileSize)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right text-xs text-muted-foreground hidden sm:block">
                        <div>
                          {formatDistanceToNow(new Date(version.uploadedAt), { addSuffix: true })}
                        </div>
                      </div>
                      {expandedVersion === version.id ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Expanded content */}
                  <div
                    className={cn(
                      "grid transition-all duration-300 ease-in-out",
                      expandedVersion === version.id
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="px-3 pb-3 pt-1 space-y-4 border-t border-border/50">
                        {/* Version details */}
                        <div className="grid grid-cols-2 gap-3 text-xs pt-3">
                          <div>
                            <p className="text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Uploaded by
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Avatar user={version.uploadedBy} size="xs" />
                              <span className="font-medium">{version.uploadedBy.name}</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Upload date
                            </p>
                            <p className="font-medium mt-1">
                              {format(new Date(version.uploadedAt), "MMM d, yyyy h:mm a")}
                            </p>
                          </div>
                        </div>

                        {/* Metadata changes */}
                        {version.metadata && (
                          <div className="text-xs">
                            <p className="text-muted-foreground mb-1">Metadata</p>
                            <div className="flex flex-wrap gap-2">
                              {version.metadata.width && version.metadata.height && (
                                <Badge variant="outline" className="text-[10px]">
                                  {version.metadata.width}x{version.metadata.height}
                                </Badge>
                              )}
                              {version.metadata.duration && (
                                <Badge variant="outline" className="text-[10px]">
                                  {Math.floor(version.metadata.duration / 60)}:
                                  {String(Math.floor(version.metadata.duration % 60)).padStart(2, "0")}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px]">
                                {version.fileType}
                              </Badge>
                            </div>
                          </div>
                        )}

                        {/* Version notes */}
                        {version.notes && (
                          <div className="text-xs">
                            <p className="text-muted-foreground mb-1 flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              Version notes
                            </p>
                            <p className="text-sm bg-muted/50 rounded-md p-2 whitespace-pre-wrap">
                              {version.notes}
                            </p>
                          </div>
                        )}

                        {/* Version comments */}
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            Comments
                            {versionComments[version.id]?.length > 0 && (
                              <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
                                {versionComments[version.id].length}
                              </Badge>
                            )}
                          </p>

                          {versionComments[version.id]?.map((comment) => (
                            <div
                              key={comment.id}
                              className="flex gap-2 p-2 bg-muted/30 rounded-md"
                            >
                              <Avatar user={comment.user} size="xs" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="font-medium">{comment.user.name}</span>
                                  <span className="text-muted-foreground">
                                    {formatDistanceToNow(new Date(comment.createdAt), {
                                      addSuffix: true,
                                    })}
                                  </span>
                                </div>
                                <p className="text-xs mt-0.5 whitespace-pre-wrap">
                                  {comment.message}
                                </p>
                              </div>
                            </div>
                          ))}

                          {/* Add comment */}
                          <div className="flex gap-2">
                            <Textarea
                              placeholder="Add a comment..."
                              value={expandedVersion === version.id ? newComment : ""}
                              onChange={(e) => setNewComment(e.target.value)}
                              className="min-h-[60px] text-xs resize-none"
                              rows={2}
                            />
                            <Button
                              size="sm"
                              disabled={!newComment.trim() || isSubmittingComment}
                              onClick={() => handleAddComment(version.id)}
                              className="shrink-0 bg-indigo-600 hover:bg-indigo-700"
                            >
                              {isSubmittingComment ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Post"
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => {
                              if (version.previewUrl) {
                                window.open(version.previewUrl, "_blank");
                              }
                            }}
                          >
                            <Eye className="h-3 w-3" />
                            Preview
                          </Button>
                          {!version.isCurrent && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:text-indigo-400 dark:border-indigo-800"
                                onClick={() => openCompareDialog(version)}
                              >
                                <GitCompare className="h-3 w-3" />
                                Compare
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs text-violet-600 border-violet-200 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-800"
                                onClick={() => {
                                  setSelectedRestoreVersion(version);
                                  setRestoreDialogOpen(true);
                                }}
                              >
                                <RotateCcw className="h-3 w-3" />
                                Restore
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Restore confirmation dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-violet-500" />
              Restore Previous Version
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to restore version {selectedRestoreVersion?.versionNumber}? This
              will make it the current version of this file. The current version will be preserved
              in the version history.
            </DialogDescription>
          </DialogHeader>
          {selectedRestoreVersion && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  {getFileIcon(selectedRestoreVersion.fileType)}
                </div>
                <div>
                  <p className="font-medium text-sm">{selectedRestoreVersion.originalName}</p>
                  <p className="text-xs text-muted-foreground">
                    Uploaded{" "}
                    {formatDistanceToNow(new Date(selectedRestoreVersion.uploadedAt), {
                      addSuffix: true,
                    })}{" "}
                    by {selectedRestoreVersion.uploadedBy.name}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreDialogOpen(false)}
              disabled={isRestoring}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestoreVersion}
              disabled={isRestoring}
              className="bg-violet-600 hover:bg-violet-700 gap-1.5"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Restore Version
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compare dialog */}
      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-indigo-500" />
              Compare Versions
            </DialogTitle>
            <DialogDescription>
              Compare different versions of this file side by side
            </DialogDescription>
          </DialogHeader>
          <VersionCompare
            uploadId={uploadId}
            versions={versions}
            initialLeft={compareVersions.left}
            initialRight={compareVersions.right}
            onVersionSelect={(position, version) => {
              setCompareVersions((prev) => ({
                ...prev,
                [position]: version,
              }));
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
