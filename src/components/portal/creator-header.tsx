"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Bell,
  HelpCircle,
  Settings,
  LogOut,
  User,
  ChevronDown,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react";
import { useBranding } from "@/components/providers/branding-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";

interface CreatorHeaderProps {
  creatorId: string;
  creatorName: string;
  creatorEmail?: string;
  creatorImage?: string | null;
  notificationCount?: number;
}

export function CreatorHeader({
  creatorId,
  creatorName,
  creatorEmail,
  creatorImage,
  notificationCount = 0,
}: CreatorHeaderProps) {
  const router = useRouter();
  const { branding, agencyName } = useBranding();

  const handleLogout = () => {
    localStorage.removeItem("creatorToken");
    localStorage.removeItem("creatorId");
    localStorage.removeItem("creatorName");
    router.push("/login");
  };

  // Generate gradient style from branding colors
  const gradientStyle = {
    background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`,
  };

  const textGradientStyle = {
    background: `linear-gradient(90deg, ${branding.primaryColor}, ${branding.secondaryColor})`,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  } as React.CSSProperties;

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="glass border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            {/* Left side - Logo and Title */}
            <div className="flex items-center gap-4">
              <Link
                href="/creator/dashboard"
                className="flex items-center gap-2 group"
              >
                {branding.logoLight ? (
                  // Use custom logo
                  <div className="flex h-9 items-center justify-center">
                    <img
                      src={branding.logoLight}
                      alt={agencyName || "Agency Logo"}
                      className="h-8 w-auto max-w-[120px] object-contain"
                    />
                  </div>
                ) : (
                  // Fallback: show gradient icon with brand colors
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl shadow-md group-hover:shadow-lg transition-shadow"
                    style={{
                      ...gradientStyle,
                      boxShadow: `0 4px 14px ${branding.primaryColor}40`,
                    }}
                  >
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                )}
                <div className="hidden sm:block">
                  <span
                    className="text-lg font-semibold"
                    style={textGradientStyle}
                  >
                    {branding.portalTitle || "Creator Portal"}
                  </span>
                  {agencyName && (
                    <p className="text-xs text-muted-foreground -mt-0.5">
                      {agencyName}
                    </p>
                  )}
                </div>
              </Link>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-2">
              {/* Help Link */}
              {branding.supportUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden sm:flex h-9 w-9 text-muted-foreground hover:text-foreground"
                  asChild
                >
                  <a href={branding.supportUrl} target="_blank" rel="noopener noreferrer">
                    <HelpCircle className="h-5 w-5" />
                    <span className="sr-only">Help</span>
                  </a>
                </Button>
              )}

              {/* Theme Toggle */}
              <ThemeToggle variant="icon" size="sm" className="h-9 w-9" />

              {/* Notifications */}
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
              >
                <Bell className="h-5 w-5" />
                {notificationCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-medium text-white"
                    style={{ backgroundColor: branding.primaryColor }}
                  >
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
                <span className="sr-only">Notifications</span>
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 px-2 sm:px-3 h-10 hover:bg-accent/50"
                  >
                    <Avatar
                      size="sm"
                      user={{
                        name: creatorName,
                        email: creatorEmail,
                        image: creatorImage,
                      }}
                    />
                    <div className="hidden sm:flex flex-col items-start">
                      <span className="text-sm font-medium leading-tight">
                        {creatorName}
                      </span>
                      <span className="text-xs text-muted-foreground leading-tight">
                        Creator
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{creatorName}</p>
                      {creatorEmail && (
                        <p className="text-xs text-muted-foreground truncate">
                          {creatorEmail}
                        </p>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      href="/creator/dashboard"
                      className="flex items-center cursor-pointer"
                    >
                      <User className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/creator/settings"
                      className="flex items-center cursor-pointer"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  {branding.supportUrl && (
                    <DropdownMenuItem asChild className="sm:hidden">
                      <a
                        href={branding.supportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center cursor-pointer"
                      >
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Help & Support
                      </a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
