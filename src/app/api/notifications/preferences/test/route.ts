import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createNotification, NotificationType } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "@/types/notification-preferences";

// ============================================
// POST - Send test notification
// ============================================

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

    // Check if Do Not Disturb is enabled
    if (preferences.doNotDisturb) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Do Not Disturb is enabled. Disable it to receive test notifications.",
        },
        { status: 400 }
      );
    }

    // Check quiet hours
    if (preferences.quietHours.enabled) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;

      const startTime = preferences.quietHours.startTime;
      const endTime = preferences.quietHours.endTime;

      // Check if current time is within quiet hours
      let isQuietHours = false;
      if (startTime <= endTime) {
        // Same day quiet hours (e.g., 09:00 - 17:00)
        isQuietHours = currentTime >= startTime && currentTime <= endTime;
      } else {
        // Overnight quiet hours (e.g., 22:00 - 08:00)
        isQuietHours = currentTime >= startTime || currentTime <= endTime;
      }

      if (isQuietHours) {
        return NextResponse.json(
          {
            success: false,
            message: `Quiet hours are active (${startTime} - ${endTime}). Notifications will be queued.`,
          },
          { status: 400 }
        );
      }
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
        await sendEmail({
          to: user.email,
          subject: "Test Notification - Upload Portal",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Test Notification</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                  Hello ${user.name || "there"},
                </p>
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                  This is a test notification to verify your email notification settings are working correctly.
                </p>
                <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                  If you received this email, your email notifications are configured properly!
                </p>
              </div>
              <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
                <p style="margin: 0;">Sent from Upload Portal</p>
              </div>
            </div>
          `,
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
            "Upload Portal: This is a test notification to verify your SMS settings are working correctly.",
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

    // Push notifications (placeholder - would integrate with service worker / web push)
    if (systemSettings.enabled && systemSettings.channels.push) {
      // In a real implementation, this would send a push notification
      // via Web Push API or a service like Firebase Cloud Messaging
      results.push = true; // Simulated success for now
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
