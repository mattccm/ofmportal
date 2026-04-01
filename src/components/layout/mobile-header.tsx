"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Bell,
  Settings,
  Shield,
  LogOut,
  Sparkles,
  User,
  Moon,
  Sun,
  Monitor,
  Search,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useSearch } from "@/components/search";
import { useTheme } from "@/components/theme/theme-provider";
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
  const user = useUser();
  const { openSearch } = useSearch();
  const { theme, setTheme, mounted } = useTheme();
  const [notificationCount] = useState(3); // Example notification count

  // Determine title from pathname if not provided
  const pageTitle = title || pageTitles[pathname] || "Content Portal";

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
      <div className="flex items-center justify-between h-14 px-4">
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-violet-600 shadow-lg shadow-primary/25">
                <Sparkles className="h-4 w-4 text-white" />
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

        {/* Right: Notifications & Profile */}
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

              {/* User Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-xl p-0 touch-manipulation active:scale-95 transition-transform"
                  >
                    <Avatar className="h-8 w-8 ring-2 ring-border">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-white font-semibold text-sm">
                        {user?.name?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 p-2"
                  sideOffset={8}
                >
                  {/* User Info */}
                  <div className="px-3 py-3 rounded-xl bg-muted/50 mb-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                        <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-white font-semibold">
                          {user?.name?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {user?.name || "User"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user?.email || ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  <DropdownMenuItem asChild className="py-3 rounded-xl">
                    <Link href="/dashboard/settings/profile">
                      <User className="mr-3 h-4 w-4" />
                      View Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="py-3 rounded-xl">
                    <Link href="/dashboard/settings">
                      <Settings className="mr-3 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="py-3 rounded-xl">
                    <Link href="/dashboard/settings/security">
                      <Shield className="mr-3 h-4 w-4" />
                      Security
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="my-2" />

                  {/* Theme Selection */}
                  {mounted && (
                    <div className="px-2 py-2">
                      <p className="px-2 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Theme
                      </p>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => setTheme("light")}
                          className={`flex flex-col items-center gap-1.5 rounded-lg py-2 px-2 text-xs transition-all ${
                            theme === "light"
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <Sun className="h-4 w-4" />
                          <span>Light</span>
                        </button>
                        <button
                          onClick={() => setTheme("dark")}
                          className={`flex flex-col items-center gap-1.5 rounded-lg py-2 px-2 text-xs transition-all ${
                            theme === "dark"
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <Moon className="h-4 w-4" />
                          <span>Dark</span>
                        </button>
                        <button
                          onClick={() => setTheme("system")}
                          className={`flex flex-col items-center gap-1.5 rounded-lg py-2 px-2 text-xs transition-all ${
                            theme === "system"
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <Monitor className="h-4 w-4" />
                          <span>System</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <DropdownMenuSeparator className="my-2" />

                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="py-3 rounded-xl text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
