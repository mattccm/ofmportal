import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAppUrl } from "@/lib/app-url";
import { BRAND } from "@/lib/brand";
import { quietOf } from "@/components/creators/insights";

/**
 * GET /api/reminder-rules/preview
 * What the reminder-rules page needs to draw a reminder exactly as a creator
 * receives it: each creator's channel, time zone and quiet hours, the email
 * sender name and the portal link base the reminder senders use.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const agencyId = session.user.agencyId;

    const [agency, creators, overrides] = await Promise.all([
      db.agency.findUnique({ where: { id: agencyId }, select: { name: true, settings: true } }),
      db.creator.findMany({
        where: { agencyId, archivedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, preferredContact: true, timezone: true, phone: true },
      }),
      db.creatorReminderOverride.findMany({
        where: { agencyId },
        select: {
          creatorId: true,
          quietHoursEnabled: true,
          quietHoursStart: true,
          quietHoursEnd: true,
          isPaused: true,
          disableReminders: true,
        },
      }),
    ]);

    // Same rule as loadEmailBranding in src/lib/email.ts
    const settings = (agency?.settings as Record<string, unknown>) || {};
    const branding = (settings.branding as { emailFromName?: string } | undefined) || {};
    const sender = (branding.emailFromName && branding.emailFromName.trim()) || agency?.name || BRAND.name;

    const byCreator = new Map(overrides.map((o) => [o.creatorId, o]));
    return NextResponse.json({
      sender,
      // src/lib/reminders.ts builds links from APP_URL
      portalBase: `${(process.env.APP_URL || getAppUrl()).replace(/\/+$/, "")}/portal/`,
      creators: creators.map((c) => {
        const o = byCreator.get(c.id);
        return {
          id: c.id,
          name: c.name,
          preferredContact: c.preferredContact,
          timezone: c.timezone,
          hasPhone: !!c.phone,
          quiet: quietOf(o),
          paused: !!o?.isPaused,
          disabled: !!o?.disableReminders,
        };
      }),
    });
  } catch (error) {
    console.error("Error loading reminder preview context:", error);
    return NextResponse.json({ error: "Failed to load preview" }, { status: 500 });
  }
}
