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

/**
 * Every staff destination, in one place, for the rail (desktop) and the menu
 * (phone). The owner keeps the optional features, so nothing here is dropped.
 */
export interface StaffNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Only these roles see the item */
  roles?: string[];
  /** Which live count to show */
  badge?: "comments";
  /** Only in the phone menu (the desktop reaches it from the account menu) */
  phoneOnly?: boolean;
}

export interface StaffNavGroup {
  name: string;
  items: StaffNavItem[];
}

const ELEVATED = ["OWNER", "ADMIN", "MANAGER"];
const ADMIN = ["OWNER", "ADMIN"];

export const STAFF_NAV: StaffNavGroup[] = [
  {
    name: "Work",
    items: [
      { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { name: "Requests", href: "/dashboard/requests", icon: FileText },
      { name: "Creators", href: "/dashboard/creators", icon: Users },
      { name: "Uploads", href: "/dashboard/uploads", icon: Upload },
      { name: "Messages", href: "/dashboard/messages", icon: MessageSquare },
      { name: "Comments", href: "/dashboard/creator-messages", icon: MessageCircle, badge: "comments" },
      { name: "Templates", href: "/dashboard/templates", icon: LayoutTemplate },
    ],
  },
  {
    name: "Tools",
    items: [
      { name: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
      { name: "Recurring requests", href: "/dashboard/recurring-requests", icon: Repeat },
      { name: "Reminders", href: "/dashboard/reminders", icon: Bell },
      { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
      { name: "Exports", href: "/dashboard/exports", icon: Download },
      { name: "Oversight", href: "/dashboard/oversight", icon: Eye, roles: ELEVATED },
    ],
  },
  {
    name: "Administration",
    items: [
      { name: "Team", href: "/dashboard/team", icon: UserCog, roles: ADMIN },
      { name: "Settings", href: "/dashboard/settings", icon: Settings, roles: ADMIN },
    ],
  },
];

/** Extra rows for the phone menu (desktop reaches these from the account menu). */
export const STAFF_PHONE_EXTRAS: StaffNavItem[] = [
  { name: "Notifications", href: "/dashboard/notifications", icon: BellRing },
  { name: "Appearance", href: "/dashboard/settings/appearance", icon: Sun, roles: ADMIN },
  { name: "Help", href: "/dashboard/help", icon: HelpCircle },
];

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
