"use client";

import * as React from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  User,
  FileText,
  Upload,
  MessageSquare,
  Tag,
  Building,
} from "lucide-react";

interface Creator {
  id: string;
  name: string;
  email: string;
}

interface RequestTemplate {
  id: string;
  name: string;
}

interface UploadFile {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: string;
  createdAt: string;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    name: string;
    role: string;
  };
}

interface ContentRequest {
  id: string;
  title: string;
  description: string | null;
  status: string;
  urgency: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  creator: Creator;
  template: RequestTemplate | null;
  uploads?: UploadFile[];
  comments?: Comment[];
  instructions?: string;
  tags?: string[];
}

interface PrintableRequestProps {
  request: ContentRequest;
  agencyName?: string;
  agencyLogo?: string;
  showComments?: boolean;
  showUploads?: boolean;
  className?: string;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    PENDING: "Pending",
    IN_PROGRESS: "In Progress",
    SUBMITTED: "Submitted",
    UNDER_REVIEW: "Under Review",
    NEEDS_REVISION: "Needs Revision",
    APPROVED: "Approved",
    CANCELLED: "Cancelled",
    ARCHIVED: "Archived",
  };
  return labels[status] || status;
}

function getUrgencyLabel(urgency: string): string {
  const labels: Record<string, string> = {
    LOW: "Low Priority",
    NORMAL: "Normal Priority",
    HIGH: "High Priority",
    URGENT: "Urgent",
  };
  return labels[urgency] || urgency;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function PrintableRequest({
  request,
  agencyName,
  agencyLogo,
  showComments = true,
  showUploads = true,
  className,
}: PrintableRequestProps) {
  const printDate = format(new Date(), "MMMM d, yyyy 'at' h:mm a");

  return (
    <div className={cn("printable-request print:block", className)}>
      {/* Print Header */}
      <div className="print-header print-only hidden print:flex print:justify-between print:items-center">
        <div className="flex items-center gap-2">
          {agencyLogo && (
            <img src={agencyLogo} alt={agencyName} className="h-6 w-auto" />
          )}
          {agencyName && <span className="font-medium">{agencyName}</span>}
        </div>
        <div className="text-muted-foreground">Request Details</div>
      </div>

      {/* Request Header */}
      <div className="request-header border-b-2 border-foreground pb-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground mb-2 print:text-xl">
              {request.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              Request ID: {request.id}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 print:flex-row print:gap-4">
            <Badge
              variant="outline"
              className="print:border-foreground print:text-foreground"
            >
              {getStatusLabel(request.status)}
            </Badge>
            {request.urgency !== "NORMAL" && (
              <Badge
                variant="secondary"
                className={cn(
                  request.urgency === "URGENT" && "bg-red-100 text-red-800",
                  request.urgency === "HIGH" && "bg-orange-100 text-orange-800"
                )}
              >
                {getUrgencyLabel(request.urgency)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Request Meta Information */}
      <div className="request-meta grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 print:flex print:flex-wrap print:gap-6">
        <div className="request-meta-item">
          <div className="request-meta-label flex items-center gap-1 text-xs text-muted-foreground uppercase tracking-wide mb-1">
            <User className="h-3 w-3" />
            Creator
          </div>
          <div className="request-meta-value font-medium">
            {request.creator.name}
          </div>
          <div className="text-xs text-muted-foreground">
            {request.creator.email}
          </div>
        </div>

        <div className="request-meta-item">
          <div className="request-meta-label flex items-center gap-1 text-xs text-muted-foreground uppercase tracking-wide mb-1">
            <Calendar className="h-3 w-3" />
            Due Date
          </div>
          <div className="request-meta-value font-medium">
            {request.dueDate
              ? format(new Date(request.dueDate), "MMMM d, yyyy")
              : "No due date"}
          </div>
        </div>

        <div className="request-meta-item">
          <div className="request-meta-label flex items-center gap-1 text-xs text-muted-foreground uppercase tracking-wide mb-1">
            <Clock className="h-3 w-3" />
            Created
          </div>
          <div className="request-meta-value font-medium">
            {format(new Date(request.createdAt), "MMM d, yyyy")}
          </div>
        </div>

        {request.template && (
          <div className="request-meta-item">
            <div className="request-meta-label flex items-center gap-1 text-xs text-muted-foreground uppercase tracking-wide mb-1">
              <FileText className="h-3 w-3" />
              Template
            </div>
            <div className="request-meta-value font-medium">
              {request.template.name}
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      {request.description && (
        <div className="mb-6 print:break-inside-avoid">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Description
          </h2>
          <div className="p-4 bg-muted/30 rounded-lg border print:bg-gray-50 print:border-gray-200">
            <p className="text-sm whitespace-pre-wrap">{request.description}</p>
          </div>
        </div>
      )}

      {/* Instructions */}
      {request.instructions && (
        <div className="mb-6 print:break-inside-avoid">
          <h2 className="text-lg font-semibold mb-2">Instructions</h2>
          <div className="p-4 bg-muted/30 rounded-lg border print:bg-gray-50 print:border-gray-200">
            <p className="text-sm whitespace-pre-wrap">{request.instructions}</p>
          </div>
        </div>
      )}

      {/* Tags */}
      {request.tags && request.tags.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Tags
          </h2>
          <div className="flex flex-wrap gap-2">
            {request.tags.map((tag, index) => (
              <Badge key={index} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Uploads Section */}
      {showUploads && request.uploads && request.uploads.length > 0 && (
        <div className="uploads-section mb-6 print:break-inside-avoid">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Uploaded Files ({request.uploads.length})
          </h2>
          <div className="border rounded-lg overflow-hidden print:border-gray-300">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 print:bg-gray-100">
                  <th className="text-left p-3 font-medium">File Name</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Size</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {request.uploads.map((upload) => (
                  <tr
                    key={upload.id}
                    className="border-t print:border-gray-200"
                  >
                    <td className="p-3 font-medium">{upload.fileName}</td>
                    <td className="p-3 text-muted-foreground">
                      {upload.fileType}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {formatFileSize(upload.fileSize)}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">
                        {upload.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {format(new Date(upload.createdAt), "MMM d, yyyy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comments Section */}
      {showComments && request.comments && request.comments.length > 0 && (
        <div className="comments-section print:break-before-page">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Comments ({request.comments.length})
          </h2>
          <div className="space-y-3">
            {request.comments.map((comment) => (
              <div
                key={comment.id}
                className="p-3 border rounded-lg print:border-gray-200 print:break-inside-avoid"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-sm">{comment.user.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(comment.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Print Footer */}
      <div className="print-footer print-only hidden print:block mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
        <p>
          Printed on {printDate}
          {agencyName && ` | ${agencyName}`}
        </p>
        <p className="mt-1">
          This document was generated from UploadPortal. Request ID: {request.id}
        </p>
      </div>
    </div>
  );
}

export type { ContentRequest, PrintableRequestProps };
