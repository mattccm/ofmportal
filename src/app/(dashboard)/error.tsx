"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  RefreshCw,
  Home,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  LayoutDashboard,
  FileText,
  Users,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Quick navigation for dashboard
const quickNav = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Requests", href: "/dashboard/requests", icon: FileText },
  { title: "Creators", href: "/dashboard/creators", icon: Users },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardError({ error, reset }: ErrorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Log the error
    console.error("Dashboard Error:", error);

    const errorLog = {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: typeof window !== "undefined" ? window.location.href : "",
      section: "dashboard",
    };

    console.group("Dashboard Error Boundary");
    console.log("Error Details:", errorLog);
    console.groupEnd();
  }, [error]);

  const handleCopyError = () => {
    const errorText = `
Dashboard Error Report
=====================
Error: ${error.message}
Digest: ${error.digest || "N/A"}
URL: ${typeof window !== "undefined" ? window.location.href : "Unknown"}
Timestamp: ${new Date().toISOString()}
Stack: ${error.stack || "No stack trace"}
    `.trim();

    navigator.clipboard.writeText(errorText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <div className="max-w-lg w-full">
        <Card className="border-amber-200/50 dark:border-amber-800/30 shadow-xl">
          {/* Warning gradient header */}
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 rounded-t-xl" />

          <CardHeader className="text-center pt-8 pb-4">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
            <CardTitle className="text-xl">
              Dashboard Error
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Something went wrong while loading this section. Your work is safe - you can try again or navigate elsewhere.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Error info */}
            {error.message && (
              <div className="p-3 rounded-xl bg-muted/50 border border-border/50">
                <p className="text-sm text-muted-foreground">
                  {error.message}
                </p>
                {error.digest && (
                  <p className="text-xs text-muted-foreground/60 mt-1 font-mono">
                    ID: {error.digest}
                  </p>
                )}
              </div>
            )}

            {/* Technical details */}
            {error.stack && (
              <div className="border border-border/50 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="text-sm font-medium text-muted-foreground">
                    Technical Details
                  </span>
                  {showDetails ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {showDetails && (
                  <div className="border-t border-border/50 p-3 bg-muted/30">
                    <div className="flex justify-end mb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyError}
                        className="h-7 text-xs"
                      >
                        {copied ? (
                          <span className="text-emerald-500">Copied!</span>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <pre className="text-xs text-muted-foreground overflow-x-auto max-h-32 overflow-y-auto p-2 bg-background rounded-lg font-mono">
                      {error.stack}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Quick navigation */}
            <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Quick Navigation
              </p>
              <div className="flex flex-wrap gap-2">
                {quickNav.map((item) => (
                  <Button
                    key={item.href}
                    variant="outline"
                    size="sm"
                    asChild
                    className="text-xs border-blue-200 dark:border-blue-800 hover:bg-blue-100/50 dark:hover:bg-blue-900/30"
                  >
                    <Link href={item.href}>
                      <item.icon className="h-3 w-3 mr-1" />
                      {item.title}
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex gap-3 pt-2">
            <Button
              onClick={reset}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button variant="outline" asChild className="flex-1">
              <Link href="/dashboard">
                <Home className="h-4 w-4 mr-2" />
                Home
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
