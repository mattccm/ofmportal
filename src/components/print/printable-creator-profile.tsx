"use client";

import * as React from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Mail,
  Phone,
  Calendar,
  FileText,
  Upload,
  CheckCircle,
  Clock,
  TrendingUp,
  Star,
} from "lucide-react";

interface CreatorStats {
  totalRequests: number;
  completedRequests: number;
  pendingRequests: number;
  totalUploads: number;
  averageResponseTime?: string;
  onTimeDeliveryRate?: number;
}

interface RecentActivity {
  id: string;
  type: "upload" | "request_completed" | "comment" | "request_received";
  description: string;
  date: string;
}

interface Creator {
  id: string;
  name: string;
  email: string;
  phone?: string;
  image?: string | null;
  createdAt: string;
  bio?: string;
  tags?: string[];
  stats: CreatorStats;
  recentActivity?: RecentActivity[];
}

interface PrintableCreatorProfileProps {
  creator: Creator;
  agencyName?: string;
  agencyLogo?: string;
  showActivity?: boolean;
  className?: string;
}

export function PrintableCreatorProfile({
  creator,
  agencyName,
  agencyLogo,
  showActivity = true,
  className,
}: PrintableCreatorProfileProps) {
  const printDate = format(new Date(), "MMMM d, yyyy");
  const memberSince = format(new Date(creator.createdAt), "MMMM yyyy");
  const completionRate =
    creator.stats.totalRequests > 0
      ? Math.round(
          (creator.stats.completedRequests / creator.stats.totalRequests) * 100
        )
      : 0;

  return (
    <div className={cn("printable-creator-profile print:block", className)}>
      {/* Print Header */}
      <div className="print-header print-only hidden print:flex print:justify-between print:items-center">
        <div className="flex items-center gap-2">
          {agencyLogo && (
            <img src={agencyLogo} alt={agencyName} className="h-6 w-auto" />
          )}
          {agencyName && <span className="font-medium">{agencyName}</span>}
        </div>
        <div className="text-muted-foreground">Creator Profile Summary</div>
      </div>

      {/* Profile Header */}
      <div className="profile-header flex items-start gap-6 border-b-2 border-foreground pb-6 mb-6">
        {/* Avatar */}
        <div className="profile-avatar shrink-0">
          {creator.image ? (
            <img
              src={creator.image}
              alt={creator.name}
              className="w-20 h-20 rounded-full border-2 border-border object-cover print:w-16 print:h-16"
            />
          ) : (
            <div className="w-20 h-20 rounded-full border-2 border-border bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-white text-2xl font-bold print:w-16 print:h-16">
              {creator.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Profile Info */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground mb-1 print:text-xl">
            {creator.name}
          </h1>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {creator.email}
            </div>
            {creator.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {creator.phone}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Member since {memberSince}
            </div>
          </div>
        </div>

        {/* Quick Stats Badge */}
        <div className="text-right print:text-center">
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium print:bg-gray-100 print:text-gray-800">
            <Star className="h-4 w-4" />
            {completionRate}% Completion Rate
          </div>
        </div>
      </div>

      {/* Bio */}
      {creator.bio && (
        <div className="mb-6 print:break-inside-avoid">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <User className="h-4 w-4" />
            About
          </h2>
          <p className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg border print:bg-gray-50">
            {creator.bio}
          </p>
        </div>
      )}

      {/* Tags */}
      {creator.tags && creator.tags.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Specializations</h2>
          <div className="flex flex-wrap gap-2">
            {creator.tags.map((tag, index) => (
              <Badge key={index} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Statistics Grid */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Performance Statistics
        </h2>
        <div className="stats-grid grid grid-cols-2 md:grid-cols-4 gap-4 print:flex print:flex-wrap print:gap-4">
          <div className="stat-box p-4 border rounded-lg text-center print:flex-1 print:min-w-[120px] print:border-gray-300">
            <div className="text-3xl font-bold text-foreground print:text-2xl">
              {creator.stats.totalRequests}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
              Total Requests
            </div>
          </div>

          <div className="stat-box p-4 border rounded-lg text-center print:flex-1 print:min-w-[120px] print:border-gray-300">
            <div className="text-3xl font-bold text-emerald-600 print:text-2xl">
              {creator.stats.completedRequests}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
              Completed
            </div>
          </div>

          <div className="stat-box p-4 border rounded-lg text-center print:flex-1 print:min-w-[120px] print:border-gray-300">
            <div className="text-3xl font-bold text-amber-600 print:text-2xl">
              {creator.stats.pendingRequests}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
              Pending
            </div>
          </div>

          <div className="stat-box p-4 border rounded-lg text-center print:flex-1 print:min-w-[120px] print:border-gray-300">
            <div className="text-3xl font-bold text-foreground print:text-2xl">
              {creator.stats.totalUploads}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
              Total Uploads
            </div>
          </div>
        </div>

        {/* Additional Performance Metrics */}
        {(creator.stats.averageResponseTime ||
          creator.stats.onTimeDeliveryRate !== undefined) && (
          <div className="grid grid-cols-2 gap-4 mt-4 print:flex print:gap-4">
            {creator.stats.averageResponseTime && (
              <div className="p-4 border rounded-lg print:flex-1 print:border-gray-300">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Avg. Response Time
                  </span>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {creator.stats.averageResponseTime}
                </div>
              </div>
            )}

            {creator.stats.onTimeDeliveryRate !== undefined && (
              <div className="p-4 border rounded-lg print:flex-1 print:border-gray-300">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    On-Time Delivery
                  </span>
                </div>
                <div className="text-2xl font-bold text-emerald-600">
                  {creator.stats.onTimeDeliveryRate}%
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {showActivity &&
        creator.recentActivity &&
        creator.recentActivity.length > 0 && (
          <div className="print:break-inside-avoid">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Recent Activity
            </h2>
            <div className="border rounded-lg overflow-hidden print:border-gray-300">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 print:bg-gray-100">
                    <th className="text-left p-3 font-medium">Activity</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {creator.recentActivity.slice(0, 10).map((activity) => (
                    <tr
                      key={activity.id}
                      className="border-t print:border-gray-200"
                    >
                      <td className="p-3">{activity.description}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs capitalize">
                          {activity.type.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {format(new Date(activity.date), "MMM d, yyyy")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Print Footer */}
      <div className="print-footer print-only hidden print:block mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
        <p>
          Generated on {printDate}
          {agencyName && ` | ${agencyName}`}
        </p>
        <p className="mt-1">
          Creator Profile Summary - {creator.name} (ID: {creator.id})
        </p>
      </div>
    </div>
  );
}

export type { Creator, CreatorStats, PrintableCreatorProfileProps };
