import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createNotification, NotificationType } from "@/lib/notifications";
import {
  sendEmail,
  loadEmailBranding,
  renderEmail,
  escapeHtml,
  p,
  note,
} from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { BRAND } from "@/lib/brand";
import { shouldSuppressNotification } from "@/lib/notification-sender";
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "@/types/notification-preferences";

// POST - Send test notification

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user details for sending notifications
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        preferences: true,
        timezone: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Parse body (optional - can contain preference overrides)
    let preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES;
    try {
      const body = await req.json();
      if (body.preferences) {
        preferences = body.preferences;
      }
    } catch {
      // Use defaults if no body provided
      const userPrefs = (user.preferences as Record<string, unknown>) || {};
      const notificationPrefs = userPrefs.notifications as
        | NotificationPreferences
        | undefined;
      if (notificationPrefs) {
        preferences = notificationPrefs;
      }
    }

    // Merge over defaults so a partial preferences object can't throw below
    preferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...preferences,
      categories: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
        ...preferences.categories,
      },
      quietHours: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.quietHours,
        ...preferences.quietHours,
        timezone: user.timezone || "UTC",
      },
    };

    // Check Do Not Disturb and quiet hours (in the user's timezone)
    const suppression = shouldSuppressNotification(preferences);
    if (suppression.suppress) {
      return NextResponse.json(
        {
          success: false,
          message: `${suppression.reason}. Test notification not sent.`,
        },
        { status: 400 }
      );
    }

    // Collect results for each channel
    const results: {
      inApp: boolean;
      email: boolean;
      sms: boolean;
      push: boolean;
    } = {
      inApp: false,
      email: false,
      sms: false,
      push: false,
    };

    const errors: string[] = [];

    // Check system category settings for test notification
    const systemSettings = preferences.categories.system;

    // Send in-app notification
    if (systemSettings.enabled && systemSettings.channels.inApp) {
      try {
        await createNotification({
          userId: user.id,
          type: NotificationType.SYSTEM,
          title: "Test Notification",
          message:
            "This is a test notification to verify your notification settings are working correctly.",
          link: "/dashboard/settings/notifications",
        });
        results.inApp = true;
      } catch (error) {
        console.error("Failed to send in-app notification:", error);
        errors.push("In-app notification failed");
      }
    }

    // Send email notification
    if (systemSettings.enabled && systemSettings.channels.email) {
      try {
        const subject = "Test notification";
        const branding = await loadEmailBranding(session.user.agencyId);
        const html = renderEmail({
          subject,
          branding,
          heading: "Test notification",
          content: `
            ${p(`Hello ${escapeHtml(user.name || "there")},`)}
            ${p(`This is a test notification to verify your email notification settings are working correctly.`)}
            ${note(`If you received this email, your email notifications are configured properly.`)}
          `,
        });
        await sendEmail({
          to: user.email,
          subject,
          html,
          fromName: branding.fromName,
          replyTo: branding.replyTo ?? undefined,
        });
        results.email = true;
      } catch (error) {
        console.error("Failed to send email notification:", error);
        errors.push("Email notification failed");
      }
    }

    // Send SMS notification
    if (systemSettings.enabled && systemSettings.channels.sms && user.phone) {
      try {
        await sendSMS({
          to: user.phone,
          message:
            `${BRAND.name}: This is a test notification to verify your SMS settings are working correctly.`,
        });
        results.sms = true;
      } catch (error) {
        console.error("Failed to send SMS notification:", error);
        errors.push("SMS notification failed");
      }
    } else if (
      systemSettings.enabled &&
      systemSettings.channels.sms &&
      !user.phone
    ) {
      errors.push("SMS enabled but no phone number configured");
    }

    // Push notifications are not implemented yet; never report them as sent
    if (systemSettings?.enabled && systemSettings.channels.push) {
      errors.push("Push notifications are not supported yet");
    }

    // Determine success
    const anySuccess = Object.values(results).some((r) => r);

    if (!anySuccess) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No notifications were sent. Please enable at least one channel.",
          results,
          errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Test notification sent successfully",
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error sending test notification:", error);
    return NextResponse.json(
      { error: "Failed to send test notification" },
      { status: 500 }
    );
  }
}
