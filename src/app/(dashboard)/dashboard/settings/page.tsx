"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useAccess } from "@/lib/access/client";
import { ChevronRight } from "lucide-react";
import { PageHead, SettingsSection } from "@/components/creators/people-ui";

interface Row {
  title: string;
  description: string;
  href: string;
  /** Shown only with this permission (personal rows have none) */
  perm?: string;
}

interface Group {
  id: string;
  title: string;
  description: string;
  rows: Row[];
}

const GROUPS: Group[] = [
  {
    id: "you",
    title: "You",
    description: "Your own account. Nobody else on the team sees these.",
    rows: [
      { title: "Profile", description: "Your name, photo, email and contact details", href: "/dashboard/settings/profile" },
      { title: "Security", description: "Password, two-factor sign-in and active sessions", href: "/dashboard/settings/security" },
      { title: "Notifications", description: "What reaches you by email and in the app, and your quiet hours", href: "/dashboard/settings/notifications" },
      { title: "Time zone and dates", description: "How times and dates show for you", href: "/dashboard/settings/timezone" },
      { title: "Appearance", description: "The one dark theme, and what follows your device", href: "/dashboard/settings/appearance" },
    ],
  },
  {
    id: "agency",
    title: "Agency",
    description: "Settings that apply to everyone on the team.",
    rows: [
      { title: "Reminders, emails and texts", description: "On the Reminders page: timing, which messages are texted, their wording, and the text setup", href: "/dashboard/reminders?tab=texts", perm: "reminders.rules" },
      { title: "Branding", description: "Agency name, logos and email sender", href: "/dashboard/settings/branding", perm: "settings.branding" },
      { title: "Template groups", description: "Group request templates so they are easier to find, and limit who can send them", href: "/dashboard/settings/template-categories", perm: "templates.groups" },
      { title: "Announcements", description: "Banners shown across the portal", href: "/dashboard/settings/announcements", perm: "settings.announcements" },
      { title: "Duplicate detection", description: "Catch the same file uploaded twice", href: "/dashboard/settings/duplicate-detection", perm: "settings.duplicates" },
      { title: "Roles and permissions", description: "What each role can see and change", href: "/dashboard/settings/roles", perm: "roles.manage" },
      { title: "Automations", description: "Rules that act on requests by themselves", href: "/dashboard/automations", perm: "settings.automations" },
      { title: "Review sessions", description: "Live sessions where the team reviews uploads together", href: "/review-sessions", perm: "settings.reviewSessions" },
      { title: "Data", description: "Storage used, retention and exports", href: "/dashboard/settings/data", perm: "settings.data" },
      { title: "Audit log", description: "Every action taken by staff, newest first", href: "/dashboard/settings/audit-log", perm: "settings.auditLog" },
      { title: "Feedback", description: "Bug reports and ideas sent from the app", href: "/dashboard/settings/feedback", perm: "settings.feedback" },
    ],
  },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const { can, roleName } = useAccess();

  const groups = GROUPS.map((g) => ({ ...g, rows: g.rows.filter((r) => !r.perm || can(r.perm)) })).filter((g) => g.rows.length);
  const who = session?.user?.name ? `Signed in as ${session.user.name}${roleName ? `, ${roleName}` : ""}.` : "";
  const agencyRows = groups.some((g) => g.id !== "you");
  const lede = agencyRows ? who : `${who} Your role doesn't include agency settings.`.trim();

  return (
    <div className="mx-auto max-w-[1152px] space-y-8">
      <PageHead title="Settings" lede={lede || "Your account and the agency's settings."} />
      {groups.map((g) => (
        <SettingsSection key={g.id} id={`set-${g.id}`} title={g.title} description={g.description}>
          <nav aria-label={g.title} className="overflow-hidden rounded-[10px] bg-tile">
            <ul className="divide-y divide-line">
              {g.rows.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="group flex min-h-[64px] items-center gap-4 px-4 py-3 transition-colors hover:bg-tile-hi focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{r.title}</span>
                      <span className="block text-sm text-ink-2">
                        {r.description}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-icon transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </SettingsSection>
      ))}
    </div>
  );
}
