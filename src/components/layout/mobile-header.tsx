"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft, Menu, MessageSquare, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/brand-logo";
import { useSearch } from "@/components/search";
import { titleForPath } from "./staff-nav";

interface MobileHeaderProps {
  title?: string;
  showBackButton?: boolean;
  backHref?: string;
  rightContent?: React.ReactNode;
  className?: string;
  /** Opens the phone menu (the rail folds into it under 768px) */
  onOpenMenu?: () => void;
  menuOpen?: boolean;
}

const ICON_BTN =
  "grid size-11 shrink-0 place-items-center rounded-md text-foreground transition-colors hover:bg-tile focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.97] motion-reduce:active:scale-100 touch-manipulation";

// Routes with their own back affordance in the bar
const showBackRoutes = [
  "/dashboard/creators/invite",
  "/dashboard/requests/new",
  "/dashboard/settings/profile",
  "/dashboard/settings/security",
  "/dashboard/templates/new",
];

/**
 * The phone bar (Title Wall fold of the icon rail): 48px on the ground with
 * the menu button, the CCM mark (or Back on a sub-page), the screen's name and
 * Messages. Titles come from the nav, never from a request (discretion).
 */
export function MobileHeader({
  title,
  showBackButton,
  backHref,
  rightContent,
  className,
  onOpenMenu,
  menuOpen = false,
}: MobileHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { openSearch } = useSearch();

  const pageTitle = title || titleForPath(pathname);
  const shouldShowBack =
    showBackButton ??
    (showBackRoutes.some((route) => pathname.startsWith(route)) ||
      (pathname.split("/").length > 3 && pathname.startsWith("/dashboard")));

  const handleBack = () => {
    if (backHref) router.push(backHref);
    else router.back();
  };

  return (
    <header
      className={cn("sticky top-0 z-40 border-b border-line bg-ground md:hidden", className)}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex h-12 items-center gap-1 px-1">
        {onOpenMenu && (
          <button
            type="button"
            className={ICON_BTN}
            onClick={onOpenMenu}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="staff-menu"
          >
            <Menu className="size-5" strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
        {shouldShowBack ? (
          <button type="button" className={ICON_BTN} onClick={handleBack} aria-label="Back">
            <ArrowLeft className="size-5" strokeWidth={1.5} aria-hidden="true" />
          </button>
        ) : (
          <Link
            href="/dashboard"
            aria-label="CCM Portal, Overview"
            className="grid size-11 shrink-0 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <BrandLogo size={28} priority imageClassName="invert" />
          </Link>
        )}

        <p className="ml-1 min-w-0 flex-1 truncate text-base font-semibold">{pageTitle}</p>

        <div className="flex shrink-0 items-center">
          {rightContent ?? (
            <>
              {shouldShowBack && (
                <button type="button" className={ICON_BTN} onClick={openSearch} aria-label="Search">
                  <Search className="size-5" strokeWidth={1.5} aria-hidden="true" />
                </button>
              )}
              <Link
                href="/dashboard/messages"
                className={ICON_BTN}
                aria-label="Messages"
                aria-current={pathname.startsWith("/dashboard/messages") ? "page" : undefined}
              >
                <MessageSquare className="size-5" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** A bar for sub-pages that need a fixed title and back target. */
export function MobileBackHeader({
  title,
  backHref,
  rightContent,
}: {
  title: string;
  backHref?: string;
  rightContent?: React.ReactNode;
}) {
  return <MobileHeader title={title} showBackButton backHref={backHref} rightContent={rightContent} />;
}
