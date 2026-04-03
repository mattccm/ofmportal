"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Bell,
  Search,
} from "lucide-react";
import { useSearch } from "@/components/search";
import { MentionsBell } from "@/components/mentions";

interface MobileHeaderProps {
  title?: string;
  showBackButton?: boolean;
  backHref?: string;
  rightContent?: React.ReactNode;
  className?: string;
}

// Page titles mapping
const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/creators": "Creators",
  "/dashboard/creators/invite": "Invite Creator",
  "/dashboard/requests": "Requests",
  "/dashboard/requests/new": "New Request",
  "/dashboard/messages": "Messages",
  "/dashboard/uploads": "Uploads",
  "/dashboard/reminders": "Reminders",
  "/dashboard/settings": "Settings",
  "/dashboard/settings/profile": "Profile",
  "/dashboard/settings/security": "Security",
  "/dashboard/team": "Team",
  "/dashboard/templates": "Templates",
  "/dashboard/templates/new": "New Template",
};

// Routes that should show back button
const showBackRoutes = [
  "/dashboard/creators/invite",
  "/dashboard/requests/new",
  "/dashboard/settings/profile",
  "/dashboard/settings/security",
  "/dashboard/templates/new",
];

export function MobileHeader({
  title,
  showBackButton,
  backHref,
  rightContent,
  className,
}: MobileHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { openSearch } = useSearch();
  const [notificationCount] = useState(3); // Example notification count

  // Determine title from pathname if not provided
  const pageTitle = title || pageTitles[pathname] || "CCM";

  // Determine if we should show back button
  const shouldShowBack = showBackButton ?? (
    showBackRoutes.some(route => pathname.startsWith(route)) ||
    // Show back for dynamic routes (e.g., /dashboard/requests/[id])
    (pathname.split("/").length > 3 && pathname.startsWith("/dashboard"))
  );

  // Determine back href
  const getBackHref = () => {
    if (backHref) return backHref;
    // Navigate to parent route
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length > 1) {
      return "/" + segments.slice(0, -1).join("/");
    }
    return "/dashboard";
  };

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 md:hidden",
        "bg-background/95 backdrop-blur-xl border-b border-border",
        "safe-area-top",
        className
      )}
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <div className="flex items-center justify-between h-16 px-4 pt-2">
        {/* Left: Back Button or Logo */}
        <div className="flex items-center gap-3 min-w-[80px]">
          {shouldShowBack ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-10 w-10 rounded-xl -ml-2 touch-manipulation active:scale-95 transition-transform"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 touch-manipulation active:opacity-80 transition-opacity"
            >
              <div className="relative h-8 w-8">
                <img
                  src="/ccm-logo.png"
                  alt="CCM"
                  className="h-full w-full object-contain dark:brightness-0 dark:invert"
                />
              </div>
            </Link>
          )}
        </div>

        {/* Center: Title */}
        <div className="flex-1 text-center">
          <h1 className="text-base font-semibold text-foreground truncate px-2">
            {pageTitle}
          </h1>
        </div>

        {/* Right: Quick actions only - Settings/Profile available via bottom nav "More" */}
        <div className="flex items-center gap-1 min-w-[80px] justify-end">
          {rightContent ? (
            rightContent
          ) : (
            <>
              {/* Search Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={openSearch}
                className="h-10 w-10 rounded-xl touch-manipulation active:scale-95 transition-transform"
              >
                <Search className="h-5 w-5" />
              </Button>

              {/* Mentions */}
              <MentionsBell className="h-10 w-10 rounded-xl touch-manipulation active:scale-95 transition-transform" />

              {/* Notifications */}
              <Link href="/dashboard/notifications">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl relative touch-manipulation active:scale-95 transition-transform"
                >
                  <Bell className="h-5 w-5" />
                  {notificationCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] font-bold"
                    >
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// Export a simple back header for use in sub-pages
export function MobileBackHeader({
  title,
  backHref,
  rightContent,
}: {
  title: string;
  backHref?: string;
  rightContent?: React.ReactNode;
}) {
  return (
    <MobileHeader
      title={title}
      showBackButton
      backHref={backHref}
      rightContent={rightContent}
    />
  );
}
