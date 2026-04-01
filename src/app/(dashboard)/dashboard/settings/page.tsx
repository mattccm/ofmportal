"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  User,
  Shield,
  Bell,
  CreditCard,
  ChevronRight,
  Settings,
  Sparkles,
  Lock,
  Mail,
  Clock,
  FileText,
  Palette,
  Sun,
  MailOpen,
  Megaphone,
  Globe,
  Database,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SettingSection {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  features: string[];
  badge?: {
    text: string;
    variant: "default" | "secondary" | "outline";
  };
  disabled?: boolean;
  adminOnly?: boolean;
}

const settingsSections: SettingSection[] = [
  {
    title: "Profile Settings",
    description: "Manage your personal information and preferences",
    href: "/dashboard/settings/profile",
    icon: <User className="h-6 w-6" />,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    features: ["Avatar & photo", "Name & contact info", "Email address", "Timezone preferences"],
  },
  {
    title: "Appearance",
    description: "Customize the look and feel of your portal",
    href: "/dashboard/settings/appearance",
    icon: <Sun className="h-6 w-6" />,
    iconBg: "bg-orange-500/10",
    iconColor: "text-orange-500",
    features: ["Light & dark mode", "System theme sync", "Color preferences", "Display density"],
  },
  {
    title: "Security Settings",
    description: "Keep your account secure with advanced protection",
    href: "/dashboard/settings/security",
    icon: <Shield className="h-6 w-6" />,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    features: ["Two-factor authentication", "Password management", "Active sessions", "API keys"],
  },
  {
    title: "Notification Settings",
    description: "Control how and when you receive updates",
    href: "/dashboard/settings/notifications",
    icon: <Bell className="h-6 w-6" />,
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-500",
    features: ["Email notifications", "Push notifications", "Digest frequency", "Quiet hours"],
  },
  {
    title: "Timezone & Date Format",
    description: "Configure timezone, date, and time display preferences",
    href: "/dashboard/settings/timezone",
    icon: <Globe className="h-6 w-6" />,
    iconBg: "bg-teal-500/10",
    iconColor: "text-teal-500",
    features: ["Timezone selection", "Date formats", "Time formats", "Auto-detect"],
  },
  {
    title: "Data Management",
    description: "Manage storage, retention policies, and data exports",
    href: "/dashboard/settings/data",
    icon: <Database className="h-6 w-6" />,
    iconBg: "bg-rose-500/10",
    iconColor: "text-rose-500",
    features: ["Storage usage", "Retention policies", "Manual cleanup", "Data export"],
    badge: { text: "Admin", variant: "default" },
    adminOnly: true,
  },
  {
    title: "Billing & Plan",
    description: "Manage your subscription and payment methods",
    href: "/dashboard/settings/billing",
    icon: <CreditCard className="h-6 w-6" />,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
    features: ["Subscription plan", "Payment methods", "Billing history", "Usage & limits"],
    badge: { text: "Coming Soon", variant: "secondary" },
    disabled: true,
  },
  {
    title: "Audit Log",
    description: "View all system activities and user actions",
    href: "/dashboard/settings/audit-log",
    icon: <FileText className="h-6 w-6" />,
    iconBg: "bg-indigo-500/10",
    iconColor: "text-indigo-500",
    features: ["Activity tracking", "User actions", "System events", "Export reports"],
    badge: { text: "Admin", variant: "default" },
    adminOnly: true,
  },
  {
    title: "Agency Branding",
    description: "Customize your portal with your branding",
    href: "/dashboard/settings/branding",
    icon: <Palette className="h-6 w-6" />,
    iconBg: "bg-fuchsia-500/10",
    iconColor: "text-fuchsia-500",
    features: ["Custom logos", "Brand colors", "Portal domain", "Custom styling"],
    badge: { text: "Admin", variant: "default" },
    adminOnly: true,
  },
  {
    title: "Email Templates",
    description: "Customize emails sent to your creators",
    href: "/dashboard/settings/email-templates",
    icon: <MailOpen className="h-6 w-6" />,
    iconBg: "bg-cyan-500/10",
    iconColor: "text-cyan-500",
    features: ["Welcome emails", "Request notifications", "Reminder emails", "Custom variables"],
    badge: { text: "Admin", variant: "default" },
    adminOnly: true,
  },
  {
    title: "Announcements",
    description: "Create and manage banner announcements",
    href: "/dashboard/settings/announcements",
    icon: <Megaphone className="h-6 w-6" />,
    iconBg: "bg-rose-500/10",
    iconColor: "text-rose-500",
    features: ["System banners", "Scheduled announcements", "Target audiences", "Dismissal tracking"],
    badge: { text: "Admin", variant: "default" },
    adminOnly: true,
  },
  {
    title: "Auto-Reminder Rules",
    description: "Configure automatic reminder schedules by urgency level",
    href: "/dashboard/settings/reminder-rules",
    icon: <Clock className="h-6 w-6" />,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
    features: ["Urgency-based rules", "SMS escalation", "Overdue reminders", "Creator overrides"],
    badge: { text: "Admin", variant: "default" },
    adminOnly: true,
  },
];

function SettingsCard({ section }: { section: SettingSection }) {
  const cardContent = (
    <Card
      className={`card-elevated h-full transition-all duration-200 ${
        section.disabled
          ? "opacity-60 cursor-not-allowed"
          : "hover:shadow-lg hover:-translate-y-1 cursor-pointer group"
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`h-12 w-12 rounded-xl ${section.iconBg} ${section.iconColor} flex items-center justify-center transition-transform group-hover:scale-110`}
            >
              {section.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{section.title}</CardTitle>
                {section.badge && (
                  <Badge variant={section.badge.variant} className="text-xs">
                    {section.badge.text}
                  </Badge>
                )}
                </div>
                <CardDescription className="mt-1">
                  {section.description}
                </CardDescription>
              </div>
            </div>
            {!section.disabled && (
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {section.features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                {feature}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );

  if (section.disabled) {
    return <div>{cardContent}</div>;
  }

  return <Link href={section.href}>{cardContent}</Link>;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "OWNER";

  // Filter sections based on user role
  const visibleSections = settingsSections.filter(
    (section) => !section.adminOnly || isAdmin
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 via-violet-500/20 to-purple-500/20 flex items-center justify-center">
          <Settings className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <Card className="card-elevated overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary via-violet-500 to-purple-500" />
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Lock className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Account Security</p>
                <p className="font-semibold text-emerald-600">Protected</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Mail className="h-6 w-6 text-violet-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email Notifications</p>
                <p className="font-semibold">Enabled</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="font-semibold text-sm">Just now</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visibleSections.map((section) => (
          <SettingsCard key={section.href} section={section} />
        ))}
      </div>

      {/* Pro Tip */}
      <Card className="card-elevated border-violet-200/50 bg-gradient-to-r from-violet-50/50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/20 dark:border-violet-800/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h3 className="font-semibold text-violet-700 dark:text-violet-400">
                Pro Tip: Enable Two-Factor Authentication
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Protect your account with an extra layer of security. Go to Security Settings
                to enable 2FA using an authenticator app.
              </p>
              <Link
                href="/dashboard/settings/security"
                className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 dark:text-violet-400 mt-3 hover:underline"
              >
                Set up 2FA now
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
