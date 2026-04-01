"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSearch } from "@/components/search";
import {
  LayoutDashboard,
  Users,
  FileText,
  Upload,
  Settings,
  Bell,
  ChevronRight,
  LogOut,
  Shield,
  UserCog,
  LayoutTemplate,
  BarChart3,
  MessageSquare,
  Search,
  Command,
  Download,
  CalendarDays,
  Sun,
  Moon,
  Monitor,
  Repeat,
} from "lucide-react";
import { generateInitials } from "@/lib/avatar";
import { useTheme } from "@/components/theme/theme-provider";
import { useUnreadMentions } from "@/hooks/use-mentions";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Creators", href: "/dashboard/creators", icon: Users },
  { name: "Requests", href: "/dashboard/requests", icon: FileText },
  { name: "Uploads", href: "/dashboard/uploads", icon: Upload },
  { name: "Templates", href: "/dashboard/templates", icon: LayoutTemplate },
  { name: "Messages", href: "/dashboard/messages", icon: MessageSquare },
];

const toolsNavigation = [
  { name: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
  { name: "Recurring Requests", href: "/dashboard/recurring-requests", icon: Repeat },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Exports", href: "/dashboard/exports", icon: Download },
  { name: "Reminders", href: "/dashboard/reminders", icon: Bell },
];

const adminNavigation = [
  { name: "Team", href: "/dashboard/team", icon: UserCog },
  { name: "Settings", href: "/dashboard/settings/profile", icon: Settings },
];

// Memoized nav item component to prevent re-renders
const NavItem = React.memo(function NavItem({
  item,
  isActive,
}: {
  item: { name: string; href: string; icon: React.ElementType };
  isActive: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all duration-200",
        isActive
          ? "bg-sidebar-accent text-sidebar-foreground shadow-sm"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
          isActive
            ? "bg-gradient-to-br from-primary to-violet-600 text-white shadow-md shadow-primary/25"
            : "bg-sidebar-accent text-sidebar-foreground/70 group-hover:bg-sidebar-accent group-hover:text-sidebar-foreground"
        )}
      >
        <item.icon className="h-[18px] w-[18px]" />
      </div>
      <span className="flex-1">{item.name}</span>
      {isActive && (
        <ChevronRight className="h-4 w-4 text-sidebar-foreground/40" />
      )}
    </Link>
  );
});

function SidebarComponent() {
  const pathname = usePathname();
  const user = useUser();
  const { openSearch } = useSearch();
  const { theme, setTheme, mounted } = useTheme();

  const isAdmin = user?.role === "OWNER" || user?.role === "ADMIN";

  // Memoize active state calculations
  const activeStates = React.useMemo(() => {
    const states: Record<string, boolean> = {};

    navigation.forEach((item) => {
      states[item.href] = item.href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname === item.href || pathname.startsWith(item.href + "/");
    });

    toolsNavigation.forEach((item) => {
      states[item.href] = pathname === item.href || pathname.startsWith(item.href + "/");
    });

    adminNavigation.forEach((item) => {
      states[item.href] = pathname === item.href || pathname.startsWith(item.href + "/");
    });

    return states;
  }, [pathname]);

  return (
    <div className="flex h-full w-[280px] flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
        <div className="relative h-9 w-9">
          <img
            src="/ccm-logo.png"
            alt="CCM"
            className="h-full w-full object-contain brightness-0 invert"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold text-sidebar-foreground tracking-tight">
            CCM
          </span>
          <span className="text-[11px] text-sidebar-foreground/50 font-medium">
            Content Portal
          </span>
        </div>
      </div>

      {/* Search Button */}
      <div className="px-3 pt-4 pb-2">
        <button
          onClick={openSearch}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-sidebar-border bg-sidebar-accent/30 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200 group"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left text-[14px]">Search...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-sidebar-accent border border-sidebar-border font-mono text-[10px] text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        <div className="mb-2 px-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Main Menu
          </span>
        </div>

        {navigation.map((item) => (
          <NavItem
            key={item.name}
            item={item}
            isActive={activeStates[item.href]}
          />
        ))}

        {/* Tools Section */}
        <div className="my-6 mx-3 border-t border-sidebar-border" />
        <div className="mb-2 px-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Tools
          </span>
        </div>
        {toolsNavigation.map((item) => (
          <NavItem
            key={item.name}
            item={item}
            isActive={activeStates[item.href]}
          />
        ))}

        {/* Admin Section */}
        {isAdmin && (
          <>
            <div className="my-6 mx-3 border-t border-sidebar-border" />
            <div className="mb-2 px-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                Administration
              </span>
            </div>
            {adminNavigation.map((item) => (
              <NavItem
                key={item.name}
                item={item}
                isActive={activeStates[item.href]}
              />
            ))}
          </>
        )}
      </nav>

      {/* User menu */}
      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full h-auto justify-start gap-3 px-3 py-3 text-left rounded-xl hover:bg-sidebar-accent transition-all duration-200"
            >
              <Avatar className="h-10 w-10 ring-2 ring-sidebar-accent">
                <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-white font-semibold text-sm">
                  {generateInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-[14px] font-semibold text-sidebar-foreground">
                  {user?.name || "User"}
                </p>
                <p className="truncate text-[12px] text-sidebar-foreground/50">
                  {user?.agencyName || "Agency"}
                </p>
              </div>
              <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-sidebar-accent">
                <Settings className="h-4 w-4 text-sidebar-foreground/50" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
            <div className="px-2 py-1.5 mb-1">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings/profile" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings/security" className="cursor-pointer">
                <Shield className="mr-2 h-4 w-4" />
                Security
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />

            {/* Theme Selection */}
            {mounted && (
              <div className="px-2 py-2">
                <p className="px-2 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Theme
                </p>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => setTheme("light")}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg py-2 px-2 text-xs transition-all",
                      theme === "light"
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Sun className="h-4 w-4" />
                    <span>Light</span>
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg py-2 px-2 text-xs transition-all",
                      theme === "dark"
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Moon className="h-4 w-4" />
                    <span>Dark</span>
                  </button>
                  <button
                    onClick={() => setTheme("system")}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg py-2 px-2 text-xs transition-all",
                      theme === "system"
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Monitor className="h-4 w-4" />
                    <span>System</span>
                  </button>
                </div>
              </div>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20 cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// Export memoized sidebar to prevent unnecessary re-renders
export const Sidebar = React.memo(SidebarComponent);
