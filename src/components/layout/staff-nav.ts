import {
  BarChart3,
  Bell,
  BellRing,
  CalendarDays,
  Download,
  Eye,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LayoutTemplate,
  MessageCircle,
  MessageSquare,
  Repeat,
  Settings,
  Sun,
  Upload,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PERMISSIONS } from "@/lib/access/catalogue";

/**
 * Every staff destination, in one place, for the rail (desktop) and the menu
 * (phone). The owner keeps the optional features, so nothing here is dropped.
 */
export interface StaffNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Shown only to people with any of these permissions (see src/lib/access/catalogue.ts) */
  perm?: string[];
  /** Which live count to show */
  badge?: "comments";
  /** Only in the phone menu (the desktop reaches it from the account menu) */
  phoneOnly?: boolean;
}

export interface StaffNavGroup {
  name: string;
  items: StaffNavItem[];
}

/** Any agency setting opens the Settings hub (personal settings are always reachable from the account menu) */
const ANY_SETTING = [
  "roles.manage",
  "templates.groups",
  "reminders.rules",
  ...PERMISSIONS.filter((p) => p.area === "settings").map((p) => p.key),
];

export const STAFF_NAV: StaffNavGroup[] = [
  {
    name: "Work",
    items: [
      { name: "Overview", href: "/dashboard", icon: LayoutDashboard, perm: ["overview.view"] },
      { name: "Requests", href: "/dashboard/requests", icon: FileText, perm: ["requests.view"] },
      { name: "Creators", href: "/dashboard/creators", icon: Users, perm: ["creators.view"] },
      { name: "Uploads", href: "/dashboard/uploads", icon: Upload, perm: ["review.view"] },
      { name: "Messages", href: "/dashboard/messages", icon: MessageSquare, perm: ["messages.creators", "messages.team"] },
      { name: "Comments", href: "/dashboard/creator-messages", icon: MessageCircle, badge: "comments", perm: ["requests.view"] },
      { name: "Templates", href: "/dashboard/templates", icon: LayoutTemplate, perm: ["templates.view"] },
    ],
  },
  {
    name: "Tools",
    items: [
      { name: "Calendar", href: "/dashboard/calendar", icon: CalendarDays, perm: ["calendar.view"] },
      { name: "Recurring requests", href: "/dashboard/recurring-requests", icon: Repeat, perm: ["recurring.view"] },
      { name: "Reminders", href: "/dashboard/reminders", icon: Bell, perm: ["reminders.view"] },
      { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3, perm: ["analytics.view", "reports.view"] },
      { name: "Exports", href: "/dashboard/exports", icon: Download, perm: ["exports.data"] },
      { name: "Oversight", href: "/dashboard/oversight", icon: Eye, perm: ["settings.oversight"] },
    ],
  },
  {
    name: "Administration",
    items: [
      { name: "Team", href: "/dashboard/team", icon: UserCog, perm: ["team.view"] },
      { name: "Settings", href: "/dashboard/settings", icon: Settings, perm: ANY_SETTING },
    ],
  },
];

/** Extra rows for the phone menu (desktop reaches these from the account menu). */
export const STAFF_PHONE_EXTRAS: StaffNavItem[] = [
  { name: "Notifications", href: "/dashboard/notifications", icon: BellRing },
  { name: "Appearance", href: "/dashboard/settings/appearance", icon: Sun },
  { name: "Help", href: "/dashboard/help", icon: HelpCircle },
];

/** Whether a nav item shows for someone, given `canAny` from useAccess() */
export function navItemVisible(item: StaffNavItem, canAny: (keys: string[]) => boolean): boolean {
  return !item.perm || canAny(item.perm);
}

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/settings") {
    // Appearance has its own phone row; Settings stays lit for the rest
    return pathname === href || (pathname.startsWith(href + "/") && !pathname.startsWith("/dashboard/settings/appearance"));
  }
  return pathname === href || pathname.startsWith(href + "/");
}

/** Phone bar title for a path: the nav name, or a sensible fallback. */
export function titleForPath(pathname: string): string {
  const all = [...STAFF_NAV.flatMap((g) => g.items), ...STAFF_PHONE_EXTRAS];
  const exact = all.find((i) => i.href === pathname);
  if (exact) return exact.name;
  const SUB: Record<string, string> = {
    "/dashboard/creators/invite": "Invite creator",
    "/dashboard/requests/new": "New request",
    "/dashboard/settings/profile": "Profile",
    "/dashboard/settings/security": "Security",
    "/dashboard/templates/new": "New template",
  };
  if (SUB[pathname]) return SUB[pathname];
  const parent = all
    .filter((i) => i.href !== "/dashboard" && pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return parent?.name ?? "CCM Portal";
}
