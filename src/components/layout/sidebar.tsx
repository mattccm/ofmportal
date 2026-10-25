"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { clearRememberToken, setSignedOutFlag } from "@/lib/remember-token";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/brand-logo";
import { useUser } from "@/hooks/use-session";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSearch } from "@/components/search";
import { useCreatorMessagesCount } from "@/hooks/use-creator-messages";
import { STAFF_NAV, isNavActive, navItemVisible, type StaffNavItem } from "./staff-nav";
import { useAccess } from "@/lib/access/client";
import { Bell, HelpCircle, LogOut, PanelLeftClose, PanelLeftOpen, Search, Settings, Shield } from "lucide-react";

const EXPANDED_KEY = "ccm-rail-expanded";

const EXPANDED_EVENT = "ccm-rail-expanded-change";

function readExpanded(): boolean {
  try {
    return localStorage.getItem(EXPANDED_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeExpanded(onChange: () => void) {
  window.addEventListener(EXPANDED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EXPANDED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * The tooltip trigger for a rail item. The shared TooltipTrigger's `asChild`
 * path clones the child with Base UI's trigger props, and those props carry
 * `children: undefined` (which wiped every icon out of the rail) and replace
 * the child's own handlers. Here the child is handed to Base UI as the render
 * element, so Base UI merges its props (handlers chained, classes joined) and
 * the child's content is passed through as the trigger's children.
 */
function TipTrigger({ children }: { children: React.ReactElement<{ children?: React.ReactNode }> }) {
  return <TooltipTrigger render={children}>{children.props.children}</TooltipTrigger>;
}

/** A rail row: icon only (with a labelled tooltip) or icon and label when expanded. */
function RailLink({
  item,
  active,
  expanded,
  badge,
}: {
  item: StaffNavItem;
  active: boolean;
  expanded: boolean;
  badge?: number;
}) {
  const Icon = item.icon;
  const count = badge && badge > 0 ? (badge > 99 ? "99+" : String(badge)) : null;
  const name = count ? `${item.name}, ${count} new` : item.name;

  const link = (
    <Link
      href={item.href}
      aria-label={expanded ? undefined : name}
      aria-current={active ? "page" : undefined}
      className={cn(
        "tw-rail-item relative flex h-10 shrink-0 items-center rounded-md text-icon transition-colors duration-150",
        "hover:bg-tile hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "active:scale-[0.97] motion-reduce:active:scale-100",
        expanded ? "w-full gap-3 px-3" : "w-11 justify-center",
        active && "bg-tile text-foreground"
      )}
    >
      {active && (
        <span
          className={cn("absolute top-2.5 h-5 w-0.5 rounded-full bg-ink", expanded ? "-left-2" : "-left-2.5")}
          aria-hidden="true"
        />
      )}
      <Icon className="size-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      {expanded && <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>}
      {count &&
        (expanded ? (
          <span className="ml-auto text-[13px] font-semibold tabular-nums text-foreground">{count}</span>
        ) : (
          <span
            className="absolute right-0 top-0.5 h-5 min-w-5 rounded-full bg-raised-hi px-1 text-center text-[12px] font-semibold leading-5 tabular-nums text-foreground"
            aria-hidden="true"
          >
            {count}
          </span>
        ))}
    </Link>
  );

  if (expanded) return link;
  return (
    <Tooltip>
      <TipTrigger>{link}</TipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {name}
      </TooltipContent>
    </Tooltip>
  );
}

/** A rail button (search, expand) with the same tooltip treatment. */
function RailButton({
  label,
  icon: Icon,
  expanded,
  onClick,
  pressed,
  hint,
}: {
  label: string;
  icon: React.ElementType;
  expanded: boolean;
  onClick: () => void;
  pressed?: boolean;
  hint?: string;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={expanded ? undefined : label}
      aria-pressed={pressed}
      className={cn(
        "tw-rail-item relative flex h-10 shrink-0 items-center rounded-md text-icon transition-colors duration-150",
        "hover:bg-tile hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "active:scale-[0.97] motion-reduce:active:scale-100",
        expanded ? "w-full gap-3 px-3" : "w-11 justify-center"
      )}
    >
      <Icon className="size-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      {expanded && (
        <>
          <span className="flex-1 text-left text-sm font-medium">{label}</span>
          {hint && <kbd className="rounded-[4px] border border-ctl px-1.5 text-[12px] font-semibold text-ink-2">{hint}</kbd>}
        </>
      )}
    </button>
  );
  if (expanded) return button;
  return (
    <Tooltip>
      <TipTrigger>{button}</TipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {hint ? `${label} (${hint})` : label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The staff shell's slim icon rail (Title Wall). 64px wide with a labelled
 * tooltip on every icon; the toggle at the foot expands it to labels (kept
 * per browser). Every destination of the old sidebar is still here.
 */
function SidebarComponent() {
  const pathname = usePathname();
  const user = useUser();
  const { openSearch } = useSearch();
  const { count: creatorMessagesCount } = useCreatorMessagesCount();
  // Read after hydration (the server always renders the slim rail), so a
  // remembered expanded rail never causes a hydration mismatch.
  const stored = React.useSyncExternalStore(subscribeExpanded, readExpanded, () => false);
  const [override, setOverride] = React.useState<boolean | null>(null);
  const expanded = override ?? stored;

  const toggleExpanded = () => {
    const next = !expanded;
    setOverride(next);
    try {
      localStorage.setItem(EXPANDED_KEY, next ? "1" : "0");
      window.dispatchEvent(new Event(EXPANDED_EVENT));
    } catch {
      // storage may be blocked; the rail still toggles for this visit
    }
  };

  const { canAny } = useAccess();
  const groups = STAFF_NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => navItemVisible(i, canAny)),
  })).filter((g) => g.items.length > 0);

  return (
    <TooltipProvider delayDuration={150}>
      <nav
        aria-label="Main"
        data-expanded={expanded ? "true" : "false"}
        className={cn(
          "tw-rail flex h-full shrink-0 flex-col border-r border-line bg-ground py-3",
          expanded ? "w-[232px] px-3" : "w-16 items-center px-0"
        )}
      >
        <Link
          href="/dashboard"
          aria-label="CCM Portal, Overview"
          className={cn(
            "mb-3 flex h-11 shrink-0 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            expanded ? "px-2" : "w-11 justify-center"
          )}
        >
          <BrandLogo size={30} priority imageClassName="invert" />
          {expanded && <span className="text-[15px] font-bold tracking-tight">CCM Portal</span>}
        </Link>

        <RailButton label="Search" icon={Search} expanded={expanded} onClick={openSearch} hint="Ctrl K" />

        <div
          className={cn(
            "mt-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto scrollbar-hide",
            expanded ? "" : "items-center"
          )}
          data-tour="sidebar-nav"
        >
          {groups.map((g, gi) => (
            <div key={g.name} className={cn("flex flex-col gap-0.5", expanded ? "" : "items-center")} role="group" aria-label={g.name}>
              {gi > 0 &&
                (expanded ? (
                  <p className="mb-1 mt-4 px-3 text-[13px] text-ink-2">{g.name}</p>
                ) : (
                  <span className="mx-auto my-2 h-px w-5 bg-line" aria-hidden="true" />
                ))}
              {g.items.map((item) => (
                <RailLink
                  key={item.href}
                  item={item}
                  active={isNavActive(pathname, item.href)}
                  expanded={expanded}
                  badge={item.badge === "comments" ? creatorMessagesCount : undefined}
                />
              ))}
            </div>
          ))}
        </div>

        <div className={cn("mt-2 flex shrink-0 flex-col gap-1", expanded ? "" : "items-center")}>
          <RailButton
            label={expanded ? "Collapse menu" : "Expand menu"}
            icon={expanded ? PanelLeftClose : PanelLeftOpen}
            expanded={expanded}
            onClick={toggleExpanded}
            pressed={expanded}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Account: ${user?.name || "User"}`}
                className={cn(
                  "flex h-11 shrink-0 items-center gap-3 rounded-md transition-colors hover:bg-tile focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  expanded ? "w-full px-2 text-left" : "w-11 justify-center"
                )}
              >
                <Avatar
                  key={user?.image || "no-avatar"}
                  className="h-8 w-8"
                  user={user ? { name: user.name, email: user.email, image: user.image } : undefined}
                  size="sm"
                />
                {expanded && (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{user?.name || "User"}</span>
                    <span className="block truncate text-[13px] text-ink-2">{user?.agencyName || "Agency"}</span>
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-60" sideOffset={10}>
              <div className="px-2 py-1.5">
                <p className="text-sm font-semibold">{user?.name}</p>
                <p className="truncate text-[13px] text-ink-2">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings/profile" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Profile settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings/security" className="cursor-pointer">
                  <Shield className="mr-2 h-4 w-4" />
                  Security
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/notifications" className="cursor-pointer">
                  <Bell className="mr-2 h-4 w-4" />
                  Notifications
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/help" className="cursor-pointer">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Help
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  // Set flag to prevent auto-login, then clear token and sign out
                  setSignedOutFlag();
                  await clearRememberToken();
                  signOut({ callbackUrl: "/login" });
                }}
                className="cursor-pointer text-late focus:text-late"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </TooltipProvider>
  );
}

// Not memoised so avatar/session updates propagate
export const Sidebar = SidebarComponent;
