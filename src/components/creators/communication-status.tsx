"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Mail,
  MessageSquare,
  MessageCircle,
  Send,
  Hash,
  Bell,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  Moon,
  Sun,
  Calendar,
  Globe,
  Languages,
  ExternalLink,
} from "lucide-react";
import {
  type CommunicationPreferences,
  type ContactMethod,
  CONTACT_METHODS,
  getContactMethodInfo,
  isCreatorAvailable,
  getNextAvailableTime,
  formatTimezoneDifference,
  getTimezoneDifference,
} from "@/types/communication-preferences";
import {
  getCurrentTimeInTimezone,
  getTimezoneAbbreviation,
  detectLocalTimezone,
} from "@/lib/timezone-utils";

// ============================================
// ICON MAP
// ============================================

const ICON_MAP: Record<string, React.ReactNode> = {
  Mail: <Mail className="h-4 w-4" />,
  MessageSquare: <MessageSquare className="h-4 w-4" />,
  MessageCircle: <MessageCircle className="h-4 w-4" />,
  Send: <Send className="h-4 w-4" />,
  Hash: <Hash className="h-4 w-4" />,
  Bell: <Bell className="h-4 w-4" />,
  Phone: <Phone className="h-4 w-4" />,
};

const ICON_MAP_SM: Record<string, React.ReactNode> = {
  Mail: <Mail className="h-3.5 w-3.5" />,
  MessageSquare: <MessageSquare className="h-3.5 w-3.5" />,
  MessageCircle: <MessageCircle className="h-3.5 w-3.5" />,
  Send: <Send className="h-3.5 w-3.5" />,
  Hash: <Hash className="h-3.5 w-3.5" />,
  Bell: <Bell className="h-3.5 w-3.5" />,
  Phone: <Phone className="h-3.5 w-3.5" />,
};

// ============================================
// TYPES
// ============================================

interface CommunicationStatusProps {
  preferences: CommunicationPreferences;
  creatorName?: string;
  onContactClick?: (method: ContactMethod) => void;
  showQuickActions?: boolean;
  compact?: boolean;
  className?: string;
}

// ============================================
// COMPONENT
// ============================================

export function CommunicationStatus({
  preferences,
  creatorName,
  onContactClick,
  showQuickActions = true,
  compact = false,
  className,
}: CommunicationStatusProps) {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const userTimezone = detectLocalTimezone();

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate availability
  const availability = useMemo(() => {
    return isCreatorAvailable(preferences, currentTime);
  }, [preferences, currentTime]);

  // Get next available time if not available
  const nextAvailable = useMemo(() => {
    if (!availability.available) {
      return getNextAvailableTime(preferences);
    }
    return null;
  }, [availability.available, preferences]);

  // Get timezone difference
  const timezoneDiff = useMemo(() => {
    return getTimezoneDifference(userTimezone, preferences.timezone);
  }, [userTimezone, preferences.timezone]);

  // Get current time in creator's timezone
  const creatorTime = useMemo(() => {
    try {
      return getCurrentTimeInTimezone(preferences.timezone);
    } catch {
      return new Date();
    }
  }, [preferences.timezone, currentTime]);

  // Get active quiet period if any
  const activeQuietPeriod = useMemo(() => {
    const now = new Date();
    return preferences.quietPeriods.find((period) => {
      const start = new Date(period.startDate);
      const end = new Date(period.endDate);
      return now >= start && now <= end;
    });
  }, [preferences.quietPeriods, currentTime]);

  // Get upcoming quiet period if any
  const upcomingQuietPeriod = useMemo(() => {
    const now = new Date();
    return preferences.quietPeriods
      .filter((period) => new Date(period.startDate) > now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];
  }, [preferences.quietPeriods]);

  // Get primary and secondary method info
  const primaryMethodInfo = getContactMethodInfo(preferences.primaryMethod);
  const secondaryMethodInfo = preferences.secondaryMethod
    ? getContactMethodInfo(preferences.secondaryMethod)
    : null;

  // Contact handlers
  const handleContact = (method: ContactMethod) => {
    if (onContactClick) {
      onContactClick(method);
    } else {
      // Default actions
      const details = preferences.contactDetails;
      switch (method) {
        case "email":
          if (details.email) window.open(`mailto:${details.email}`);
          break;
        case "phone":
        case "sms":
          if (details.phone) window.open(`tel:${details.phone}`);
          break;
        case "whatsapp":
          if (details.whatsapp)
            window.open(`https://wa.me/${details.whatsapp.replace(/[^0-9]/g, "")}`);
          break;
        case "telegram":
          if (details.telegram)
            window.open(`https://t.me/${details.telegram.replace("@", "")}`);
          break;
      }
    }
  };

  // ============================================
  // COMPACT VIEW
  // ============================================

  if (compact) {
    return (
      <TooltipProvider>
        <div className={cn("flex items-center gap-2", className)}>
          {/* Availability indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full ring-2 ring-background",
                  availability.available
                    ? "bg-emerald-500"
                    : activeQuietPeriod
                    ? "bg-amber-500"
                    : "bg-gray-400"
                )}
              />
            </TooltipTrigger>
            <TooltipContent>
              {availability.available
                ? "Currently available"
                : activeQuietPeriod
                ? `On break: ${activeQuietPeriod.reason || "Away"}`
                : availability.reason || "Currently unavailable"}
            </TooltipContent>
          </Tooltip>

          {/* Primary contact method badge */}
          {primaryMethodInfo && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1 cursor-pointer hover:bg-accent",
                    primaryMethodInfo.bgColor
                  )}
                  onClick={() => handleContact(preferences.primaryMethod)}
                >
                  <span className={primaryMethodInfo.color}>
                    {ICON_MAP_SM[primaryMethodInfo.icon]}
                  </span>
                  {primaryMethodInfo.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Preferred: {primaryMethodInfo.label}</TooltipContent>
            </Tooltip>
          )}

          {/* Timezone info */}
          {timezoneDiff !== 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {timezoneDiff > 0 ? "+" : ""}
                  {timezoneDiff}h
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {formatTimezoneDifference(timezoneDiff)} ({preferences.timezone})
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    );
  }

  // ============================================
  // FULL VIEW
  // ============================================

  return (
    <TooltipProvider>
      <Card className={cn("card-elevated", className)}>
        <CardContent className="p-4 space-y-4">
          {/* Availability Status */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center",
                  availability.available
                    ? "bg-emerald-100 dark:bg-emerald-900/30"
                    : activeQuietPeriod
                    ? "bg-amber-100 dark:bg-amber-900/30"
                    : "bg-gray-100 dark:bg-gray-800"
                )}
              >
                {availability.available ? (
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                ) : activeQuietPeriod ? (
                  <Moon className="h-5 w-5 text-amber-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-gray-500" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {availability.available
                      ? "Available Now"
                      : activeQuietPeriod
                      ? "On Break"
                      : "Unavailable"}
                  </span>
                  <Badge
                    variant={availability.available ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {availability.available ? "Online" : "Offline"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {availability.available
                    ? `Working hours: ${preferences.preferredHours.start} - ${preferences.preferredHours.end}`
                    : activeQuietPeriod
                    ? activeQuietPeriod.reason || "Currently on a scheduled break"
                    : availability.reason || "Outside working hours"}
                </p>
                {!availability.available && nextAvailable && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Available again: {format(nextAvailable, "EEE, MMM d 'at' h:mm a")}
                  </p>
                )}
              </div>
            </div>

            {/* Current time in their timezone */}
            <div className="text-right">
              <p className="text-sm font-medium">
                {format(creatorTime, "h:mm a")}
              </p>
              <p className="text-xs text-muted-foreground">
                {getTimezoneAbbreviation(preferences.timezone)}
              </p>
              {timezoneDiff !== 0 && (
                <p className="text-xs text-muted-foreground">
                  ({formatTimezoneDifference(timezoneDiff)})
                </p>
              )}
            </div>
          </div>

          {/* Active Quiet Period Warning */}
          {activeQuietPeriod && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                    Quiet Period Active
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-500">
                    Until {format(new Date(activeQuietPeriod.endDate), "MMM d, yyyy")}
                    {activeQuietPeriod.reason && ` - ${activeQuietPeriod.reason}`}
                  </p>
                  {activeQuietPeriod.autoReply && (
                    <p className="text-xs text-amber-700 dark:text-amber-500 mt-1 italic">
                      "{activeQuietPeriod.autoReply}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Quiet Period Notice */}
          {!activeQuietPeriod && upcomingQuietPeriod && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-400">
                    Upcoming Break
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-500">
                    {format(new Date(upcomingQuietPeriod.startDate), "MMM d")} -{" "}
                    {format(new Date(upcomingQuietPeriod.endDate), "MMM d, yyyy")}
                    {upcomingQuietPeriod.reason && ` (${upcomingQuietPeriod.reason})`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Preferred Contact Methods */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Preferred Contact
            </h4>
            <div className="flex flex-wrap gap-2">
              {/* Primary Method */}
              {primaryMethodInfo && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("gap-2", primaryMethodInfo.bgColor)}
                      onClick={() => handleContact(preferences.primaryMethod)}
                    >
                      <span className={primaryMethodInfo.color}>
                        {ICON_MAP[primaryMethodInfo.icon]}
                      </span>
                      {primaryMethodInfo.label}
                      <Badge className="ml-1 text-xs bg-primary/10 text-primary">
                        Primary
                      </Badge>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{primaryMethodInfo.helpText}</TooltipContent>
                </Tooltip>
              )}

              {/* Secondary Method */}
              {secondaryMethodInfo && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("gap-2", secondaryMethodInfo.bgColor)}
                      onClick={() => handleContact(preferences.secondaryMethod!)}
                    >
                      <span className={secondaryMethodInfo.color}>
                        {ICON_MAP[secondaryMethodInfo.icon]}
                      </span>
                      {secondaryMethodInfo.label}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{secondaryMethodInfo.helpText}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Quick Contact Buttons */}
          {showQuickActions && (
            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-sm font-medium">Quick Contact</h4>
              <div className="grid grid-cols-3 gap-2">
                {preferences.contactDetails.email && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleContact("email")}
                      >
                        <Mail className="h-4 w-4" />
                        Email
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{preferences.contactDetails.email}</TooltipContent>
                  </Tooltip>
                )}

                {preferences.contactDetails.phone && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleContact("phone")}
                      >
                        <Phone className="h-4 w-4" />
                        Call
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{preferences.contactDetails.phone}</TooltipContent>
                  </Tooltip>
                )}

                {preferences.contactDetails.whatsapp && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleContact("whatsapp")}
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{preferences.contactDetails.whatsapp}</TooltipContent>
                  </Tooltip>
                )}

                {preferences.contactDetails.telegram && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleContact("telegram")}
                      >
                        <Send className="h-4 w-4" />
                        Telegram
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{preferences.contactDetails.telegram}</TooltipContent>
                  </Tooltip>
                )}

                {preferences.contactDetails.discord && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleContact("discord")}
                      >
                        <Hash className="h-4 w-4" />
                        Discord
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{preferences.contactDetails.discord}</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          )}

          {/* Language Info */}
          <div className="flex items-center gap-4 pt-2 border-t text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Languages className="h-4 w-4" />
              <span>{preferences.primaryLanguage}</span>
              {preferences.secondaryLanguages && preferences.secondaryLanguages.length > 0 && (
                <span className="text-xs">
                  (+{preferences.secondaryLanguages.length} more)
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>
                Responds:{" "}
                {preferences.expectedResponseTime === "immediate"
                  ? "Immediately"
                  : preferences.expectedResponseTime === "same_day"
                  ? "Same day"
                  : preferences.expectedResponseTime === "next_day"
                  ? "Within 24h"
                  : preferences.expectedResponseTime === "within_week"
                  ? "Within a week"
                  : "Flexible"}
              </span>
            </div>
          </div>

          {/* Communication Notes */}
          {preferences.communicationNotes && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground italic">
                "{preferences.communicationNotes}"
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

// ============================================
// AVAILABILITY BADGE COMPONENT
// ============================================

interface AvailabilityBadgeProps {
  preferences: CommunicationPreferences;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function AvailabilityBadge({
  preferences,
  showLabel = true,
  size = "md",
}: AvailabilityBadgeProps) {
  const availability = isCreatorAvailable(preferences);

  // Check for active quiet period
  const now = new Date();
  const activeQuietPeriod = preferences.quietPeriods.find((period) => {
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    return now >= start && now <= end;
  });

  const sizeClasses = {
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3 w-3",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "rounded-full ring-2 ring-background",
                sizeClasses[size],
                availability.available
                  ? "bg-emerald-500"
                  : activeQuietPeriod
                  ? "bg-amber-500"
                  : "bg-gray-400"
              )}
            />
            {showLabel && (
              <span
                className={cn(
                  "text-xs font-medium",
                  availability.available
                    ? "text-emerald-600"
                    : activeQuietPeriod
                    ? "text-amber-600"
                    : "text-gray-500"
                )}
              >
                {availability.available
                  ? "Available"
                  : activeQuietPeriod
                  ? "Away"
                  : "Offline"}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {availability.available
            ? "Currently within working hours"
            : activeQuietPeriod
            ? `On break: ${activeQuietPeriod.reason || "Away"}`
            : availability.reason || "Outside working hours"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================
// CONTACT METHOD BADGE COMPONENT
// ============================================

interface ContactMethodBadgeProps {
  method: ContactMethod;
  onClick?: () => void;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function ContactMethodBadge({
  method,
  onClick,
  showLabel = true,
  size = "md",
}: ContactMethodBadgeProps) {
  const methodInfo = getContactMethodInfo(method);

  if (!methodInfo) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "cursor-pointer hover:bg-accent transition-colors",
              methodInfo.bgColor,
              onClick && "hover:scale-105",
              size === "sm" ? "text-xs px-1.5 py-0" : ""
            )}
            onClick={onClick}
          >
            <span className={cn("mr-1", methodInfo.color)}>
              {size === "sm" ? ICON_MAP_SM[methodInfo.icon] : ICON_MAP[methodInfo.icon]}
            </span>
            {showLabel && methodInfo.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{methodInfo.helpText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default CommunicationStatus;
