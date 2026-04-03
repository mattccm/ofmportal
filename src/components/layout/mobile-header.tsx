"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Search,
} from "lucide-react";
import { useSearch } from "@/components/search";

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

  // Determine title from pathname if not provided
  const pageTitle = title || pageTitles[pathname] || "CCM";

  // Determine if we should show back button
  const shouldShowBack = showBackButton ?? (
    showBackRoutes.some(route => pathname.startsWith(route)) ||
    // Show back for dynamic routes (e.g., /dashboard/requests/[id])
    (pathname.split("/").length > 3 && pathname.startsWith("/dashboard"))
  );

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  // Main navigation pages where the bottom nav is the primary navigation
  // These pages don't need a top header - saves screen space on mobile
  // Includes all pages accessible from bottom nav (main tabs + "More" menu)
  const mainNavPages = [
    "/dashboard",
    "/dashboard/creators",
    "/dashboard/requests",
    "/dashboard/messages",
    "/dashboard/uploads",
    "/dashboard/templates",
    "/dashboard/recurring-requests",
    "/dashboard/analytics",
    "/dashboard/exports",
    "/dashboard/reminders",
    "/dashboard/notifications",
    "/dashboard/team",
    "/dashboard/settings",
    "/dashboard/help",
  ];

  // On main nav pages (not sub-pages), hide the header completely
  // Sub-pages need the header for back navigation and context
  const isMainPage = !shouldShowBack && mainNavPages.includes(pathname);

  // Don't render header on main pages - bottom nav provides all navigation
  if (isMainPage && !rightContent) {
    return null;
  }

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
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left: Back Button or Logo */}
        <div className="flex items-center gap-3 min-w-[48px]">
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
              <div className="relative h-7 w-7">
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
          <h1 className="text-sm font-semibold text-foreground truncate px-2">
            {pageTitle}
          </h1>
        </div>

        {/* Right: Minimal actions - most available via bottom nav */}
        <div className="flex items-center gap-1 min-w-[48px] justify-end">
          {rightContent ? (
            rightContent
          ) : (
            // Only show search on sub-pages for quick access
            shouldShowBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={openSearch}
                className="h-10 w-10 rounded-xl touch-manipulation active:scale-95 transition-transform"
              >
                <Search className="h-5 w-5" />
              </Button>
            )
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
