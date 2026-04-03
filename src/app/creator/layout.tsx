"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Toaster } from "sonner";
import { BrandingProvider, useBranding } from "@/components/providers/branding-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home,
  FileText,
  Calendar,
  MessageSquare,
  Settings,
  LogOut,
  Bell,
  Menu,
  X,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCreatorSession, clearCreatorSession, hasCreatorSessionIndicator, setSignedOutFlag } from "@/lib/remember-token";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { href: "/creator/dashboard", label: "Dashboard", icon: <Home className="h-5 w-5" /> },
  { href: "/creator/requests", label: "Requests", icon: <FileText className="h-5 w-5" /> },
  { href: "/creator/calendar", label: "Calendar", icon: <Calendar className="h-5 w-5" /> },
  { href: "/creator/messages", label: "Messages", icon: <MessageSquare className="h-5 w-5" /> },
];

function CreatorLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { branding, agencyName } = useBranding();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [creator, setCreator] = useState<{
    id: string;
    name: string;
    email: string;
    avatar?: string;
  } | null>(null);

  useEffect(() => {
    // Helper to get cookie value
    const getCookie = (name: string): string | null => {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return match ? decodeURIComponent(match[2]) : null;
    };

    // Async function to check all storage mechanisms
    const checkAuth = async () => {
      // Quick check: if no indicator cookie and no localStorage, likely no session at all
      const hasIndicator = hasCreatorSessionIndicator();
      const hasLocalToken = !!localStorage.getItem("creatorToken");
      const hasCookieToken = !!getCookie("creatorToken");

      console.log("[CreatorLayout] Session check - indicator:", hasIndicator, "localStorage:", hasLocalToken, "cookie:", hasCookieToken);

      // Try localStorage first, fall back to cookies, then IndexedDB (for iOS PWA persistence)
      let token = localStorage.getItem("creatorToken");
      let creatorId = localStorage.getItem("creatorId");
      let creatorName = localStorage.getItem("creatorName");
      let creatorEmail = localStorage.getItem("creatorEmail");
      let creatorAvatar = localStorage.getItem("creatorAvatar");

      // If localStorage is empty but cookies exist, restore from cookies
      if (!token && getCookie("creatorToken")) {
        console.log("[CreatorLayout] Restoring from cookies");
        token = getCookie("creatorToken");
        creatorId = getCookie("creatorId");
        creatorName = getCookie("creatorName");
        creatorEmail = getCookie("creatorEmail");

        // Restore to localStorage for faster access
        if (token) localStorage.setItem("creatorToken", token);
        if (creatorId) localStorage.setItem("creatorId", creatorId);
        if (creatorName) localStorage.setItem("creatorName", creatorName);
        if (creatorEmail) localStorage.setItem("creatorEmail", creatorEmail);
      }

      // If still no token, try IndexedDB (most reliable on iOS PWA)
      // Check if we have the indicator cookie OR if we're in PWA mode
      if (!token && (hasIndicator || window.matchMedia("(display-mode: standalone)").matches)) {
        console.log("[CreatorLayout] Checking IndexedDB for creator session");
        try {
          const storedSession = await getCreatorSession();
          if (storedSession) {
            console.log("[CreatorLayout] Found session in IndexedDB, restoring...");
            token = storedSession.token;
            creatorId = storedSession.creatorId;
            creatorName = storedSession.name;
            creatorEmail = storedSession.email;
            creatorAvatar = storedSession.avatar || null;

            // Restore to localStorage
            localStorage.setItem("creatorToken", token);
            localStorage.setItem("creatorId", creatorId);
            localStorage.setItem("creatorName", creatorName);
            localStorage.setItem("creatorEmail", creatorEmail);
            if (creatorAvatar) localStorage.setItem("creatorAvatar", creatorAvatar);

            // Also restore cookies
            const maxAge = 30 * 24 * 60 * 60;
            document.cookie = `creatorToken=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
            document.cookie = `creatorId=${creatorId}; path=/; max-age=${maxAge}; SameSite=Lax`;
            document.cookie = `creatorName=${encodeURIComponent(creatorName)}; path=/; max-age=${maxAge}; SameSite=Lax`;
            document.cookie = `creatorEmail=${encodeURIComponent(creatorEmail)}; path=/; max-age=${maxAge}; SameSite=Lax`;
          }
        } catch (error) {
          console.error("[CreatorLayout] IndexedDB error:", error);
        }
      }

      if (!token || !creatorId) {
        console.log("[CreatorLayout] No valid session found, redirecting to login");
        router.push("/login");
        return;
      }

      return { token, creatorId, creatorName, creatorEmail, creatorAvatar };
    };

    checkAuth().then((authData) => {
      if (!authData) return;

      const { token, creatorId, creatorName, creatorEmail, creatorAvatar } = authData;

      // Set initial state from localStorage first
      const initialCreator = {
        id: creatorId!,
        name: creatorName || "Creator",
        email: creatorEmail || "",
        avatar: creatorAvatar || undefined,
      };

      // Fetch fresh profile data to get latest avatar
      (async () => {
        try {
          const response = await fetch("/api/portal/profile", {
            headers: {
              "x-creator-token": token!,
            },
          });
          if (response.ok) {
            const data = await response.json();
            // Update localStorage with fresh data
            if (data.name) localStorage.setItem("creatorName", data.name);
            if (data.avatar) {
              localStorage.setItem("creatorAvatar", data.avatar);
            } else {
              localStorage.removeItem("creatorAvatar");
            }
            // Update state with fresh data including avatar
            setCreator({
              id: creatorId!,
              name: data.name || creatorName || "Creator",
              email: data.email || creatorEmail || "",
              avatar: data.avatar || undefined,
            });
          } else {
            // If fetch fails, use localStorage data
            setCreator(initialCreator);
          }
        } catch (error) {
          console.error("Error fetching creator profile:", error);
          // Use localStorage data on error
          setCreator(initialCreator);
        }
      })();
    });
  }, [router]);

  const handleLogout = async () => {
    const token = localStorage.getItem("creatorToken");

    // Set signed-out flag FIRST to prevent auto-login from kicking back in
    setSignedOutFlag();
    console.log("[CreatorLayout] Setting signed-out flag");

    // Call logout API to invalidate session on server
    if (token) {
      try {
        await fetch("/api/portal/logout", {
          method: "POST",
          headers: {
            "x-creator-token": token,
          },
        });
      } catch (error) {
        console.error("Error logging out:", error);
      }
    }

    // Clear IndexedDB (most important for iOS PWA)
    try {
      await clearCreatorSession();
    } catch (error) {
      console.error("Error clearing IndexedDB:", error);
    }

    // Clear local storage
    localStorage.removeItem("creatorToken");
    localStorage.removeItem("creatorId");
    localStorage.removeItem("creatorName");
    localStorage.removeItem("creatorEmail");
    localStorage.removeItem("creatorAvatar");
    localStorage.removeItem("creatorOnboardingComplete");

    // Clear cookies too
    document.cookie = "creatorToken=; path=/; max-age=0";
    document.cookie = "creatorId=; path=/; max-age=0";
    document.cookie = "creatorName=; path=/; max-age=0";
    document.cookie = "creatorEmail=; path=/; max-age=0";

    router.push("/login");
  };

  // Generate CSS variables for branding colors
  const brandingStyle = {
    "--brand-primary": branding.primaryColor,
    "--brand-secondary": branding.secondaryColor,
    "--brand-accent": branding.accentColor,
  } as React.CSSProperties;

  const gradientStyle = {
    background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`,
  };

  if (!creator) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/30"
      style={brandingStyle}
    >
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: branding.primaryColor }}
        />
        <div
          className="absolute top-1/2 -left-40 w-96 h-96 rounded-full blur-3xl opacity-15"
          style={{ backgroundColor: branding.secondaryColor }}
        />
      </div>

      {/* Header - Hidden on mobile since bottom nav provides navigation */}
      <header className="hidden md:block sticky top-0 z-50 glass border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <Link href="/creator/dashboard" className="flex items-center gap-2 group">
                {branding.logoLight ? (
                  <img
                    src={branding.logoLight}
                    alt={agencyName || "Logo"}
                    className="h-8 w-auto max-w-[120px] object-contain"
                  />
                ) : (
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl shadow-md"
                    style={gradientStyle}
                  >
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                )}
                <span className="text-lg font-semibold">
                  {branding.portalTitle || "Creator Portal"}
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <ThemeToggle variant="icon" size="sm" className="h-9 w-9" />

              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9"
              >
                <Bell className="h-5 w-5" />
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-2 h-10">
                    <Avatar
                      size="sm"
                      user={{
                        name: creator.name,
                        email: creator.email,
                        image: creator.avatar,
                      }}
                    />
                    <span className="text-sm font-medium">
                      {creator.name}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <p className="font-medium">{creator.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{creator.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/creator/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/40 safe-area-pb">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {item.icon}
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          <Link
            href="/creator/settings"
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
              pathname === "/creator/settings" ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Settings className="h-5 w-5" />
            <span className="text-[10px] font-medium">Settings</span>
          </Link>
        </div>
      </nav>

      {/* Main content with bottom padding for mobile nav */}
      <main className="relative z-10 pb-20 md:pb-0">
        {children}
      </main>

      <Toaster position="top-right" richColors />
    </div>
  );
}

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <BrandingProvider>
        <CreatorLayoutInner>{children}</CreatorLayoutInner>
      </BrandingProvider>
    </ThemeProvider>
  );
}
