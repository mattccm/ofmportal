"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Upload, ChevronRight, Image, Video, FileText, File, CheckCircle, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { WidgetCard, type WidgetProps } from "../widget-grid";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface RecentUpload {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  thumbnailUrl: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  uploadedAt: string;
  creator: {
    id: string;
    name: string;
    avatar: string | null;
  };
  request: {
    id: string;
    title: string;
  };
}

// ============================================
// HELPERS
// ============================================

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return <Image className="h-4 w-4" />;
  if (fileType.startsWith("video/")) return <Video className="h-4 w-4" />;
  if (fileType.includes("pdf")) return <FileText className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
}

function getStatusConfig(status: string) {
  switch (status) {
    case "APPROVED":
      return {
        icon: <CheckCircle className="h-3.5 w-3.5" />,
        class: "text-emerald-600 bg-emerald-50 border-emerald-200",
        label: "Approved",
      };
    case "REJECTED":
      return {
        icon: <XCircle className="h-3.5 w-3.5" />,
        class: "text-red-600 bg-red-50 border-red-200",
        label: "Rejected",
      };
    default:
      return {
        icon: <Clock className="h-3.5 w-3.5" />,
        class: "text-amber-600 bg-amber-50 border-amber-200",
        label: "Pending",
      };
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ============================================
// COMPONENT
// ============================================

export function RecentUploadsWidget({ config, size }: WidgetProps) {
  const [uploads, setUploads] = useState<RecentUpload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard/widgets?widget=recent-uploads");
      if (!response.ok) throw new Error("Failed to fetch data");
      const data = await response.json();
      setUploads(data.uploads || []);
    } catch (err) {
      setError("Failed to load recent uploads");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const displayCount = size === "small" ? 4 : size === "medium" ? 6 : 10;
  const showThumbnails = size !== "small";

  return (
    <WidgetCard
      title="Recent Uploads"
      icon={<Upload className="h-5 w-5 text-emerald-500" />}
      isLoading={isLoading}
      error={error}
      onRetry={fetchData}
      helpKey="dashboard.recent-uploads"
      actions={
        <Button variant="ghost" size="sm" asChild className="text-xs text-primary h-7">
          <Link href="/dashboard/uploads">
            View all
            <ChevronRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      }
    >
      {uploads.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-6 text-center">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-3">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No recent uploads</p>
          <p className="text-xs text-muted-foreground mt-1">
            Uploads will appear here when creators submit content
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {uploads.slice(0, displayCount).map((upload) => {
            const statusConfig = getStatusConfig(upload.status);

            return (
              <Link
                key={upload.id}
                href={`/dashboard/requests/${upload.request.id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                {/* Thumbnail or Icon */}
                {showThumbnails && upload.thumbnailUrl ? (
                  <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <img
                      src={upload.thumbnailUrl}
                      alt={upload.originalName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
                    {getFileIcon(upload.fileType)}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {upload.originalName}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Avatar
                      user={{ name: upload.creator.name, image: upload.creator.avatar }}
                      size="xs"
                    />
                    <span className="truncate">{upload.creator.name}</span>
                    <span>·</span>
                    <span>{formatFileSize(upload.fileSize)}</span>
                  </div>
                </div>

                {/* Status */}
                <Badge variant="outline" className={cn("text-[10px] shrink-0 gap-1", statusConfig.class)}>
                  {statusConfig.icon}
                  {statusConfig.label}
                </Badge>
              </Link>
            );
          })}

          {uploads.length > displayCount && (
            <div className="pt-2 text-center">
              <Link
                href="/dashboard/uploads"
                className="text-xs text-primary hover:underline"
              >
                +{uploads.length - displayCount} more uploads
              </Link>
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
