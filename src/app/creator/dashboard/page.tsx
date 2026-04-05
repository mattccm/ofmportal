"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBranding } from "@/components/providers/branding-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Calendar,
  Bell,
} from "lucide-react";
import { format, isPast, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { stripHtml } from "@/components/ui/html-content";

type RequestStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "NEEDS_REVISION"
  | "APPROVED";

interface Request {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: RequestStatus;
  urgency: string;
  createdAt: string;
  _count: {
    uploads: number;
    comments: number;
  };
}

interface Stats {
  pendingRequests: number;
  uploadsThisMonth: number;
  approvalRate: number;
  totalRequests: number;
}

export default function CreatorDashboardPage() {
  const router = useRouter();
  const { branding } = useBranding();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<Request[]>([]);
  const [creator, setCreator] = useState<{
    id: string;
    name: string;
    email: string;
    image?: string;
  } | null>(null);
  const [stats, setStats] = useState<Stats>({
    pendingRequests: 0,
    uploadsThisMonth: 0,
    approvalRate: 0,
    totalRequests: 0,
  });

  useEffect(() => {
    const token = localStorage.getItem("creatorToken");
    const creatorId = localStorage.getItem("creatorId");
    const name = localStorage.getItem("creatorName");
    const email = localStorage.getItem("creatorEmail");
    const onboardingComplete = localStorage.getItem("creatorOnboardingComplete");

    if (!token || !creatorId) {
      router.push("/login");
      return;
    }

    // Check if onboarding is complete
    if (onboardingComplete !== "true") {
      router.push("/creator/onboarding");
      return;
    }

    setCreator({
      id: creatorId,
      name: name || "Creator",
      email: email || "",
    });

    fetchRequests();
  }, [router]);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch(`/api/portal/requests`, {
        headers: {
          "x-creator-token": token || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch requests");
      }

      const data = await response.json();
      setRequests(data);

      // Calculate stats
      const pending = data.filter(
        (r: Request) =>
          r.status === "PENDING" ||
          r.status === "IN_PROGRESS" ||
          r.status === "NEEDS_REVISION"
      ).length;
      const approved = data.filter((r: Request) => r.status === "APPROVED").length;
      const total = data.length;
      const uploads = data.reduce(
        (acc: number, r: Request) => acc + (r._count?.uploads || 0),
        0
      );

      setStats({
        pendingRequests: pending,
        uploadsThisMonth: uploads,
        approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
        totalRequests: total,
      });
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const brandGradientStyle = {
    background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor}, ${branding.accentColor})`,
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2
            className="h-10 w-10 animate-spin mx-auto"
            style={{ color: branding.primaryColor }}
          />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const activeRequests = requests.filter(
    (r) =>
      r.status === "PENDING" ||
      r.status === "IN_PROGRESS" ||
      r.status === "NEEDS_REVISION"
  );

  const dueSoonRequests = activeRequests
    .filter((r) => {
      if (!r.dueDate) return false;
      const daysUntil = differenceInDays(new Date(r.dueDate), new Date());
      return daysUntil <= 3 && !isPast(new Date(r.dueDate));
    })
    .slice(0, 3);

  const overdueRequests = activeRequests.filter(
    (r) => r.dueDate && isPast(new Date(r.dueDate))
  );

  const recentActivity = requests
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5);

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "SUBMITTED":
        return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400";
      case "UNDER_REVIEW":
        return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";
      case "NEEDS_REVISION":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "APPROVED":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Welcome Banner */}
      <section
        className="relative overflow-hidden rounded-2xl p-6 sm:p-8 text-white"
        style={brandGradientStyle}
      >
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 bg-white/10 rounded-full blur-3xl" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <Avatar
            size="2xl"
            user={{
              name: creator?.name,
              email: creator?.email,
              image: creator?.image,
            }}
            ring="white"
            className="shadow-xl hidden sm:flex"
          />

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 text-white/70" />
              <span className="text-sm font-medium text-white/70">
                {branding.welcomeMessage || "Welcome back"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">
              {creator?.name}
            </h1>
            <p className="text-white/80 max-w-md">
              {activeRequests.length > 0
                ? `You have ${activeRequests.length} active request${activeRequests.length !== 1 ? "s" : ""} waiting for your content.`
                : "All caught up! No pending requests at the moment."}
            </p>
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            {activeRequests.length > 0 && (
              <Button
                asChild
                className="bg-white hover:bg-white/90 shadow-lg flex-1 sm:flex-none"
                style={{ color: branding.primaryColor }}
              >
                <Link href="/creator/requests">
                  <Upload className="mr-2 h-4 w-4" />
                  Start Uploading
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Overdue Warning */}
      {overdueRequests.length > 0 && (
        <section className="p-4 rounded-xl bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-red-800 dark:text-red-200">
                {overdueRequests.length} Overdue Request
                {overdueRequests.length !== 1 ? "s" : ""}
              </h3>
              <p className="text-sm text-red-600 dark:text-red-300 mt-0.5">
                Please upload your content as soon as possible to avoid delays.
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 shrink-0"
            >
              <Link href="/creator/requests?filter=overdue">View All</Link>
            </Button>
          </div>
        </section>
      )}

      {/* Stats Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                  Pending
                </p>
                <p className="text-2xl sm:text-3xl font-bold mt-1">
                  {stats.pendingRequests}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                  Uploads
                </p>
                <p className="text-2xl sm:text-3xl font-bold mt-1">
                  {stats.uploadsThisMonth}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Upload className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                  Approval
                </p>
                <p className="text-2xl sm:text-3xl font-bold mt-1">
                  {stats.approvalRate}%
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                  Total
                </p>
                <p className="text-2xl sm:text-3xl font-bold mt-1">
                  {stats.totalRequests}
                </p>
              </div>
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${branding.primaryColor}15` }}
              >
                <TrendingUp
                  className="h-5 w-5 sm:h-6 sm:w-6"
                  style={{ color: branding.primaryColor }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Due Soon Alerts */}
      {dueSoonRequests.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold">Due Soon</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dueSoonRequests.map((request) => (
              <Link key={request.id} href={`/creator/requests/${request.id}`}>
                <Card className="group hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                        <Calendar className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                          {request.title}
                        </h3>
                        <p className="text-xs text-amber-600 font-medium mt-0.5">
                          Due {format(new Date(request.dueDate!), "MMM d, yyyy")}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Active Requests */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Active Requests</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/creator/requests">
                View All
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {activeRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-1">All caught up!</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  You don&apos;t have any pending requests. Check back later for
                  new content requests.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeRequests.slice(0, 4).map((request) => (
                <Link key={request.id} href={`/creator/requests/${request.id}`}>
                  <Card className="group hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                              {request.title}
                            </h3>
                            <Badge
                              variant="secondary"
                              className={cn("shrink-0", getStatusColor(request.status))}
                            >
                              {request.status.replace("_", " ")}
                            </Badge>
                          </div>
                          {request.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {stripHtml(request.description)}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {request.dueDate && (
                              <span className={cn(
                                isPast(new Date(request.dueDate)) && "text-red-500 font-medium"
                              )}>
                                Due {format(new Date(request.dueDate), "MMM d")}
                              </span>
                            )}
                            <span>{request._count?.uploads || 0} uploads</span>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}

              {activeRequests.length > 4 && (
                <Button asChild variant="outline" className="w-full">
                  <Link href="/creator/requests">
                    View {activeRequests.length - 4} More Requests
                  </Link>
                </Button>
              )}
            </div>
          )}
        </section>

        {/* Recent Activity Sidebar */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Recent Activity</h2>

          <Card>
            <CardContent className="p-0">
              {recentActivity.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No recent activity
                </div>
              ) : (
                <div className="divide-y">
                  {recentActivity.map((request) => (
                    <Link
                      key={request.id}
                      href={`/creator/requests/${request.id}`}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          request.status === "APPROVED"
                            ? "bg-emerald-500"
                            : request.status === "NEEDS_REVISION"
                            ? "bg-red-500"
                            : "bg-amber-500"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {request.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {request._count?.uploads || 0} uploads
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/creator/requests">
                  <FileText className="mr-2 h-4 w-4" />
                  View All Requests
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/creator/calendar">
                  <Calendar className="mr-2 h-4 w-4" />
                  View Calendar
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/creator/settings">
                  <Bell className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
