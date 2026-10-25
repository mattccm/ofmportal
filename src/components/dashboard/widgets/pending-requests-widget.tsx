"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { FileText, ChevronRight, Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatePill, requestStatusState } from "@/components/title-wall";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { WidgetCard, type WidgetProps } from "../widget-grid";
import { useWidgetData } from "../widget-data-provider";

// TYPES

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

// STATUS CONFIG

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  NEEDS_REVISION: "Needs changes",
};

// COMPONENT

export function PendingRequestsWidget({ config, size }: WidgetProps) {
  // Use batched widget data from context (single API call for all widgets)
  const { data, isLoading, error, refresh } = useWidgetData();
  const widgetData = data["pending-requests"] as { requests: PendingRequest[] } | undefined;
  const requests = widgetData?.requests || [];

  const displayCount = size === "small" ? 3 : size === "medium" ? 5 : 8;

  return (
    <WidgetCard
      title="Pending Requests"
      icon={<Clock className="h-5 w-5 text-amber-500" />}
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
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
                      <AlertTriangle className="h-3.5 w-3.5 text-late shrink-0" aria-label="Overdue" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {request.creator.name} · {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {requestStatusState(request.status) ? (
                  <StatePill state={requestStatusState(request.status)!} className="shrink-0">
                    {STATUS_LABEL[request.status] ?? request.status}
                  </StatePill>
                ) : (
                  <Badge variant="draft" className="shrink-0">{STATUS_LABEL[request.status] ?? request.status}</Badge>
                )}
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
