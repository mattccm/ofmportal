"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search,
  Home,
  ArrowLeft,
  FileQuestion,
  Map,
  Users,
  FileText,
  Settings,
  LayoutDashboard,
  HelpCircle,
  Compass,
} from "lucide-react";
import Link from "next/link";

// Popular/suggested links for navigation
const popularLinks = [
  {
    title: "Dashboard",
    description: "Go to your main dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    color: "from-violet-500 to-purple-500",
  },
  {
    title: "Content Requests",
    description: "View and manage requests",
    href: "/dashboard/requests",
    icon: FileText,
    color: "from-blue-500 to-cyan-500",
  },
  {
    title: "Creators",
    description: "Manage your creators",
    href: "/dashboard/creators",
    icon: Users,
    color: "from-emerald-500 to-teal-500",
  },
  {
    title: "Settings",
    description: "Account and preferences",
    href: "/dashboard/settings",
    icon: Settings,
    color: "from-amber-500 to-orange-500",
  },
];

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-background to-violet-50 dark:from-blue-950/20 dark:via-background dark:to-violet-950/20">
      <div className="max-w-2xl w-full">
        <Card className="border-blue-200/50 dark:border-blue-800/30 shadow-2xl overflow-hidden">
          {/* Decorative header */}
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-purple-500" />

          <CardHeader className="text-center pt-10 pb-6">
            {/* 404 illustration */}
            <div className="mx-auto relative mb-4">
              {/* Main icon */}
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-blue-100 to-violet-100 dark:from-blue-900/30 dark:to-violet-900/30 flex items-center justify-center shadow-xl shadow-blue-500/10">
                <FileQuestion className="h-12 w-12 text-blue-500" />
              </div>
              {/* Floating compass */}
              <div className="absolute -top-2 -right-2 h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20 animate-bounce">
                <Compass className="h-5 w-5 text-white" />
              </div>
            </div>

            {/* Large 404 text */}
            <div className="text-7xl font-bold bg-gradient-to-r from-blue-500 via-violet-500 to-purple-500 bg-clip-text text-transparent">
              404
            </div>

            <CardTitle className="text-2xl mt-4">
              Page Not Found
            </CardTitle>
            <CardDescription className="text-base mt-2 max-w-md mx-auto">
              Looks like you&apos;ve ventured into uncharted territory. The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Search suggestion */}
            <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Search className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Looking for something?</p>
                  <p className="text-sm text-muted-foreground">Try searching or explore popular pages below</p>
                </div>
              </div>
              <div className="relative">
                <Link
                  href="/dashboard"
                  className="flex items-center w-full px-4 py-3 rounded-xl border border-border bg-background hover:bg-muted/50 hover:border-primary/30 transition-all group"
                >
                  <Search className="h-4 w-4 text-muted-foreground mr-3 group-hover:text-primary transition-colors" />
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                    Search CCM...
                  </span>
                </Link>
              </div>
            </div>

            {/* Popular links grid */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Map className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Popular Pages</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {popularLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 transition-all group"
                  >
                    <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform`}>
                      <link.icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                        {link.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {link.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Help section */}
            <div className="p-4 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/50 dark:border-violet-800/30">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <HelpCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-violet-800 dark:text-violet-200">
                    Need help?
                  </p>
                  <p className="text-sm text-violet-700/70 dark:text-violet-300/70 mt-1">
                    If you believe this is a mistake or need assistance, visit our Help Center or contact support.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs border-violet-200 dark:border-violet-800 hover:bg-violet-100/50 dark:hover:bg-violet-900/30"
                      asChild
                    >
                      <Link href="/dashboard/help">
                        Help Center
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs hover:bg-violet-100/50 dark:hover:bg-violet-900/30"
                      asChild
                    >
                      <a href="mailto:support@contentportal.com">
                        Contact Support
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row gap-3 pt-2 pb-6">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  window.history.back();
                }
              }}
              asChild
            >
              <Link href="#" onClick={(e) => {
                e.preventDefault();
                if (typeof window !== "undefined" && window.history.length > 1) {
                  window.history.back();
                }
              }}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Link>
            </Button>
            <Button asChild className="flex-1 bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white shadow-lg shadow-blue-500/20">
              <Link href="/dashboard">
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Decorative elements */}
        <div className="flex justify-center mt-8 gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-300 dark:bg-blue-700" />
          <div className="h-2 w-2 rounded-full bg-violet-300 dark:bg-violet-700" />
          <div className="h-2 w-2 rounded-full bg-purple-300 dark:bg-purple-700" />
        </div>
      </div>
    </div>
  );
}
