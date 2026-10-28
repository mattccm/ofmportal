"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Home, FileText, Calendar, MessageSquare, Settings, LogOut } from "lucide-react";
import { useBranding } from "@/components/providers/branding-provider";
import { BrandLogo } from "@/components/brand/brand-logo";
import { BRAND } from "@/lib/brand";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ViewerTimeZoneProvider } from "@/components/title-wall/viewer-time";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export const creatorNavItems: NavItem[] = [
  { href: "/creator/dashboard", label: "Home", icon: <Home className="h-5 w-5" /> },
  { href: "/creator/requests", label: "Requests", icon: <FileText className="h-5 w-5" /> },
  { href: "/creator/calendar", label: "Calendar", icon: <Calendar className="h-5 w-5" /> },
  { href: "/creator/messages", label: "Messages", icon: <MessageSquare className="h-5 w-5" /> },
];
const navItems = creatorNavItems;

const PreviewLinks = React.createContext(false);

/** A link that, in a preview, stays put and says so */
function NavLink({ href, onClick, ...props }: React.ComponentProps<typeof Link>) {
  const preview = React.useContext(PreviewLinks);
  if (!preview) return <Link href={href} onClick={onClick} {...props} />;
  return (
    <a
      href={typeof href === "string" ? href : "#"}
      {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      onClick={(e) => {
        e.preventDefault();
        toast("This is a preview: only the request works here.");
      }}
    />
  );
}

/**
 * The creator portal's frame: the side rail from 1024px, the top bar below
 * it, and the phone tab bar. Shared by the portal (src/app/creator/layout.tsx)
 * and "Preview as creator", so the preview wears the real frame.
 */
export function CreatorChrome({
  creator,
  pathname,
  viewerTz,
  onLogout,
  preview = false,
  children,
}: {
  creator: { name: string; email: string; avatar?: string };
  pathname: string;
  viewerTz: string;
  onLogout: () => void;
  /** Links don't leave the page; used by the template preview */
  preview?: boolean;
  children: React.ReactNode;
}) {
  const { branding, agencyName } = useBranding();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const initials =
    creator.name
      .replace(/\./g, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  const logo =
    branding.logoDark && branding.logoDark !== BRAND.logoPath ? (
      // eslint-disable-next-line @next/next/no-img-element -- agency's own dark-surface logo from settings
      <img src={branding.logoDark} alt="" className="h-8 w-8 object-contain" />
    ) : (
      <BrandLogo size={30} priority imageClassName="invert" />
    );

  const avatar = creator.avatar ? (
    <Avatar size="sm" user={{ name: creator.name, email: creator.email, image: creator.avatar }} />
  ) : (
    <span
      className="grid size-8 shrink-0 place-items-center rounded-full bg-raised-hi text-xs font-semibold text-foreground"
      aria-hidden="true"
    >
      {initials}
    </span>
  );

  const accountMenu = (side: "bar" | "rail") => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {side === "bar" ? (
          <button
            type="button"
            aria-label={`Account: ${creator.name}`}
            className="grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {avatar}
          </button>
        ) : (
          <button
            type="button"
            aria-label={`Account: ${creator.name}`}
            className="flex h-12 w-full items-center gap-3 rounded-md px-2 text-left transition-colors hover:bg-tile focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {avatar}
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{creator.name}</span>
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={side === "bar" ? "end" : "start"} side={side === "bar" ? "bottom" : "top"} className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="font-semibold">{creator.name}</p>
          <p className="truncate text-[13px] text-ink-2">{creator.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <NavLink href="/creator/settings" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </NavLink>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-late focus:text-late">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const allItems = [...navItems, { href: "/creator/settings", label: "Settings", icon: <Settings className="h-5 w-5" /> }];

  return (
    <PreviewLinks.Provider value={preview}>
    <div className="min-h-screen bg-background safe-area-top">
      {/* Desktop (1024px and up): a labelled side rail with every destination */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-ground px-3 pb-4 pt-5 lg:flex">
        <NavLink
          href="/creator/dashboard"
          aria-label={`${agencyName || "CCM"}, Home`}
          className="mb-6 ml-1 grid size-11 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {logo}
        </NavLink>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {allItems.map((item) => {
            const active = isActive(item.href);
            return (
              <NavLink
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  "[&_svg]:size-[18px] [&_svg]:stroke-[1.5]",
                  active
                    ? "bg-tile text-foreground before:absolute before:inset-y-2 before:-left-3 before:w-0.5 before:rounded-full before:bg-ink [&_svg]:stroke-2"
                    : "text-ink-2 hover:bg-tile hover:text-foreground [&_svg]:text-icon"
                )}
              >
                {item.icon}
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-auto">{accountMenu("rail")}</div>
      </aside>

      {/* Phone and tablet top bar: the mark, the destinations from 640px, the creator's initials */}
      <header className="sticky top-0 z-40 bg-ground lg:hidden">
        <div className="mx-auto flex h-14 w-full max-w-[560px] items-center gap-2 px-4 md:max-w-[720px]">
          <NavLink
            href="/creator/dashboard"
            aria-label={`${agencyName || "CCM"}, Home`}
            className="grid size-11 shrink-0 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {logo}
          </NavLink>
          <span className="flex-1" />

          <nav aria-label="Main" className="hidden items-center gap-0.5 sm:flex">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center rounded-md px-2.5 text-sm font-medium transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    active ? "bg-tile text-foreground" : "text-ink-2 hover:bg-tile hover:text-foreground"
                  )}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          {accountMenu("bar")}
        </div>
      </header>

      {/* Phone tab bar: every destination one thumb away */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-tile sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex h-16 max-w-[560px] safe-area-x">
          {allItems.map((item) => {
            const active = isActive(item.href);
            return (
              <NavLink
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
                  "touch-manipulation active:scale-[0.97] motion-reduce:active:scale-100",
                  "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring",
                  active ? "text-foreground" : "text-ink-2"
                )}
              >
                <span className={cn("[&_svg]:stroke-[1.5]", active && "[&_svg]:stroke-2")}>{item.icon}</span>
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/*
        The content column: at most 560px on a phone (104px under it so the tab
        bar never covers content), 720px on a tablet, and from 1024px a wide
        area beside the rail that each page lays out in columns.
      */}
      <div className="lg:pl-60">
        <main
          id="main"
          className="relative mx-auto w-full max-w-[560px] pb-[calc(104px+env(safe-area-inset-bottom,0px))] sm:pb-16 md:max-w-[720px] lg:max-w-[1200px] lg:px-4 lg:pb-12"
        >
          <ViewerTimeZoneProvider value={viewerTz}>{children}</ViewerTimeZoneProvider>
        </main>
      </div>
    </div>
    </PreviewLinks.Provider>
  );
}
