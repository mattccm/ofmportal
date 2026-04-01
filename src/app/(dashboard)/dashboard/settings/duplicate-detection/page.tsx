"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  ChevronLeft,
  FileWarning,
  AlertTriangle,
  Clock,
  Settings,
  Activity,
  Ban,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DuplicateAttemptsLog } from "@/components/duplicate-detection/duplicate-attempts-log";
import { DuplicateDetectionSettingsForm } from "@/components/duplicate-detection/duplicate-detection-settings";
import { BackToTop } from "@/components/ui/back-to-top";

export default function DuplicateDetectionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const defaultTab = searchParams.get("tab") || "attempts";
  const [activeTab, setActiveTab] = React.useState(defaultTab);

  // Check authorization
  React.useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/login");
      return;
    }

    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      router.push("/dashboard");
      return;
    }
  }, [session, status, router]);

  // Loading state
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-5 w-5 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  // Authorization check
  if (!session || !["ADMIN", "OWNER"].includes(session.user.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
        <Button asChild>
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/settings">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-4 flex-1">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-red-500/20 via-orange-500/20 to-amber-500/20 flex items-center justify-center">
            <ShieldCheck className="h-7 w-7 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Duplicate Detection</h1>
            <p className="text-muted-foreground">
              Prevent creators from resubmitting old content
            </p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="card-elevated border-red-200/50 bg-gradient-to-r from-red-50/50 to-orange-50/50 dark:from-red-950/20 dark:to-orange-950/20 dark:border-red-800/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <Ban className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h3 className="font-semibold text-red-700 dark:text-red-400">
                STRICT Duplicate Protection
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                When enabled, this system <strong>BLOCKS</strong> duplicate content uploads automatically.
                Creators receive a clear error message explaining that the content was already submitted.
                All blocked attempts are logged for your review.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="attempts" className="gap-2">
            <Activity className="h-4 w-4" />
            Blocked Attempts
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Blocked Attempts Tab */}
        <TabsContent value="attempts" className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileWarning className="h-5 w-5 text-orange-500" />
                Duplicate Upload Attempts
              </CardTitle>
              <CardDescription>
                View all blocked duplicate upload attempts from creators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DuplicateAttemptsLog />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-indigo-500" />
                Detection Settings
              </CardTitle>
              <CardDescription>
                Configure how duplicates are detected and handled
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DuplicateDetectionSettingsForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Back to Top Button */}
      <BackToTop position="bottom-right" variant="gradient" />
    </div>
  );
}
