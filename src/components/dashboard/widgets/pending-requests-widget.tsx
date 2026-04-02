"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { widgetFetch } from "@/lib/fetch-with-timeout";
import { FileText, ChevronRight, Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { WidgetCard, type WidgetProps } from "../widget-grid";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface PendingRequest {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
  creator: {
    id: string;
    name: string;
    avatar: string | null;
  };
  uploadCount: number;
}

// ============================================
// STATUS CONFIG
// ============================================

function getStatusConfig(status: string) {
  const configs: Record<string, { class: string; label: string }> = {
    PENDING: { class: "badge-warning", label: "Pending" },
    IN_PROGRESS: { class: "badge-info", label: "In Progress" },
    SUBMITTED: { class: "badge-purple", label: "Submitted" },
    UNDER_REVIEW: { class: "badge-info", label: "Under Review" },
    NEEDS_REVISION: { class: "badge-error", label: "Needs Revision" },
  };
  return configs[status] || { class: "bg-muted text-muted-foreground", label: status };
}

// ============================================
// COMPONENT
// ============================================

export function PendingRequestsWidget({ config, size }: WidgetProps) {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await widgetFetch("/api/dashboard/widgets?widget=pending-requests");
      if (!response.ok) throw new Error("Failed to fetch data");
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (err) {
      const message = err instanceof Error && err.name === "FetchTimeoutError"
        ? "Request timed out"
        : "Failed to load pending requests";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const displayCount = size === "small" ? 3 : size === "medium" ? 5 : 8;

  return (
    <WidgetCard
      title="Pending Requests"
      icon={<Clock className="h-5 w-5 text-amber-500" />}
      isLoading={isLoading}
      error={error}
      onRetry={fetchData}
      helpKey="dashboard.pending-requests"
      actions={
        <Button variant="ghost" size="sm" asChild className="text-xs text-primary h-7">
          <Link href="/dashboard/requests?status=pending">
            View all
            <ChevronRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      }
    >
      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-6 text-center">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-3">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No pending requests</p>
          <p className="text-xs text-muted-foreground mt-1">All caught up!</p>
        </div>
      ) : (
        <div className="space-y-1">
          {requests.slice(0, displayCount).map((request) => {
            const statusConfig = getStatusConfig(request.status);
            const isOverdue = request.dueDate && new Date(request.dueDate) < new Date();

            return (
              <Link
                key={request.id}
                href={`/dashboard/requests/${request.id}`}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <Avatar
                  user={{ name: request.creator.name, image: request.creator.avatar }}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {request.title}
                    </p>
                    {isOverdue && (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {request.creator.name} · {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <Badge variant="outline" className={cn("text-[10px] shrink-0", statusConfig.class)}>
                  {statusConfig.label}
                </Badge>
              </Link>
            );
          })}

          {requests.length > displayCount && (
            <div className="pt-2 text-center">
              <Link
                href="/dashboard/requests?status=pending"
                className="text-xs text-primary hover:underline"
              >
                +{requests.length - displayCount} more requests
              </Link>
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
