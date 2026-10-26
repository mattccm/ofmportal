"use client";

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { useBranding } from "@/components/providers/branding-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


import { OnboardingWizard, type OnboardingStep } from "@/components/onboarding/onboarding-wizard";
import { TutorialOverlay, type TutorialStep } from "@/components/onboarding/tutorial-overlay";
import {
  User,
  Globe,
  CheckCircle2,
  Clock,
  Upload,
  FileText,
  MessageCircle,
  Settings,
  ChevronRight,
  Sparkles,
  Play,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { BRAND } from "@/lib/brand";

// TYPES

interface AgencyInfo {
  name: string;
  logo?: string;
  primaryColor?: string;
}

interface CreatorProfile {
  name: string;
  bio: string;
  phone: string;
  timezone: string;
  avatar?: string;
}

// TIMEZONE DATA - Comprehensive list sorted by offset

const TIMEZONES = [
  // UTC-12 to UTC-9
  { value: "Pacific/Midway", label: "Midway Island", offset: "UTC-11", offsetNum: -11 },
  { value: "Pacific/Honolulu", label: "Hawaii", offset: "UTC-10", offsetNum: -10 },
  { value: "America/Anchorage", label: "Alaska", offset: "UTC-9", offsetNum: -9 },

  // UTC-8 to UTC-5 (Americas)
  { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)", offset: "UTC-8", offsetNum: -8 },
  { value: "America/Tijuana", label: "Tijuana, Baja California", offset: "UTC-8", offsetNum: -8 },
  { value: "America/Denver", label: "Mountain Time (US & Canada)", offset: "UTC-7", offsetNum: -7 },
  { value: "America/Phoenix", label: "Arizona (No DST)", offset: "UTC-7", offsetNum: -7 },
  { value: "America/Chicago", label: "Central Time (US & Canada)", offset: "UTC-6", offsetNum: -6 },
  { value: "America/Mexico_City", label: "Mexico City", offset: "UTC-6", offsetNum: -6 },
  { value: "America/New_York", label: "Eastern Time (US & Canada)", offset: "UTC-5", offsetNum: -5 },
  { value: "America/Bogota", label: "Bogota, Lima, Quito", offset: "UTC-5", offsetNum: -5 },
  { value: "America/Toronto", label: "Toronto", offset: "UTC-5", offsetNum: -5 },

  // UTC-4 to UTC-2 (Americas/Atlantic)
  { value: "America/Caracas", label: "Caracas", offset: "UTC-4", offsetNum: -4 },
  { value: "America/Halifax", label: "Atlantic Time (Canada)", offset: "UTC-4", offsetNum: -4 },
  { value: "America/Santiago", label: "Santiago", offset: "UTC-4", offsetNum: -4 },
  { value: "America/Sao_Paulo", label: "Sao Paulo, Brasilia", offset: "UTC-3", offsetNum: -3 },
  { value: "America/Buenos_Aires", label: "Buenos Aires", offset: "UTC-3", offsetNum: -3 },
  { value: "America/St_Johns", label: "Newfoundland", offset: "UTC-3:30", offsetNum: -3.5 },
  { value: "Atlantic/South_Georgia", label: "South Georgia", offset: "UTC-2", offsetNum: -2 },
  { value: "Atlantic/Azores", label: "Azores", offset: "UTC-1", offsetNum: -1 },

  // UTC+0 to UTC+3 (Europe/Africa/Middle East)
  { value: "UTC", label: "UTC / GMT", offset: "UTC+0", offsetNum: 0 },
  { value: "Europe/London", label: "London, Dublin, Edinburgh", offset: "UTC+0", offsetNum: 0 },
  { value: "Africa/Casablanca", label: "Casablanca", offset: "UTC+0", offsetNum: 0 },
  { value: "Europe/Paris", label: "Paris, Brussels, Amsterdam", offset: "UTC+1", offsetNum: 1 },
  { value: "Europe/Berlin", label: "Berlin, Frankfurt, Vienna", offset: "UTC+1", offsetNum: 1 },
  { value: "Europe/Madrid", label: "Madrid, Barcelona", offset: "UTC+1", offsetNum: 1 },
  { value: "Europe/Rome", label: "Rome, Milan", offset: "UTC+1", offsetNum: 1 },
  { value: "Africa/Lagos", label: "Lagos, West Central Africa", offset: "UTC+1", offsetNum: 1 },
  { value: "Europe/Athens", label: "Athens, Bucharest, Istanbul", offset: "UTC+2", offsetNum: 2 },
  { value: "Africa/Cairo", label: "Cairo", offset: "UTC+2", offsetNum: 2 },
  { value: "Africa/Johannesburg", label: "Johannesburg, Pretoria", offset: "UTC+2", offsetNum: 2 },
  { value: "Europe/Helsinki", label: "Helsinki, Kyiv", offset: "UTC+2", offsetNum: 2 },
  { value: "Asia/Jerusalem", label: "Jerusalem, Tel Aviv", offset: "UTC+2", offsetNum: 2 },
  { value: "Europe/Moscow", label: "Moscow, St. Petersburg", offset: "UTC+3", offsetNum: 3 },
  { value: "Asia/Kuwait", label: "Kuwait, Riyadh", offset: "UTC+3", offsetNum: 3 },
  { value: "Africa/Nairobi", label: "Nairobi", offset: "UTC+3", offsetNum: 3 },

  // UTC+4 to UTC+6 (Middle East/Asia)
  { value: "Asia/Dubai", label: "Dubai, Abu Dhabi", offset: "UTC+4", offsetNum: 4 },
  { value: "Asia/Baku", label: "Baku", offset: "UTC+4", offsetNum: 4 },
  { value: "Asia/Kabul", label: "Kabul", offset: "UTC+4:30", offsetNum: 4.5 },
  { value: "Asia/Karachi", label: "Karachi, Islamabad", offset: "UTC+5", offsetNum: 5 },
  { value: "Asia/Tashkent", label: "Tashkent", offset: "UTC+5", offsetNum: 5 },
  { value: "Asia/Kolkata", label: "Mumbai, New Delhi, Kolkata", offset: "UTC+5:30", offsetNum: 5.5 },
  { value: "Asia/Kathmandu", label: "Kathmandu", offset: "UTC+5:45", offsetNum: 5.75 },
  { value: "Asia/Dhaka", label: "Dhaka, Bangladesh", offset: "UTC+6", offsetNum: 6 },
  { value: "Asia/Almaty", label: "Almaty", offset: "UTC+6", offsetNum: 6 },

  // UTC+7 to UTC+9 (Asia)
  { value: "Asia/Bangkok", label: "Bangkok, Hanoi, Jakarta", offset: "UTC+7", offsetNum: 7 },
  { value: "Asia/Ho_Chi_Minh", label: "Ho Chi Minh City", offset: "UTC+7", offsetNum: 7 },
  { value: "Asia/Singapore", label: "Singapore, Kuala Lumpur", offset: "UTC+8", offsetNum: 8 },
  { value: "Asia/Hong_Kong", label: "Hong Kong", offset: "UTC+8", offsetNum: 8 },
  { value: "Asia/Shanghai", label: "Beijing, Shanghai", offset: "UTC+8", offsetNum: 8 },
  { value: "Asia/Taipei", label: "Taipei", offset: "UTC+8", offsetNum: 8 },
  { value: "Asia/Manila", label: "Manila", offset: "UTC+8", offsetNum: 8 },
  { value: "Australia/Perth", label: "Perth", offset: "UTC+8", offsetNum: 8 },
  { value: "Asia/Tokyo", label: "Tokyo, Osaka", offset: "UTC+9", offsetNum: 9 },
  { value: "Asia/Seoul", label: "Seoul", offset: "UTC+9", offsetNum: 9 },

  // UTC+9:30 to UTC+12 (Oceania)
  { value: "Australia/Darwin", label: "Darwin (No DST)", offset: "UTC+9:30", offsetNum: 9.5 },
  { value: "Australia/Adelaide", label: "Adelaide", offset: "UTC+9:30", offsetNum: 9.5 },
  { value: "Australia/Sydney", label: "Sydney, Melbourne", offset: "UTC+10", offsetNum: 10 },
  { value: "Australia/Brisbane", label: "Brisbane (No DST)", offset: "UTC+10", offsetNum: 10 },
  { value: "Pacific/Guam", label: "Guam", offset: "UTC+10", offsetNum: 10 },
  { value: "Pacific/Noumea", label: "New Caledonia", offset: "UTC+11", offsetNum: 11 },
  { value: "Pacific/Auckland", label: "Auckland, Wellington", offset: "UTC+12", offsetNum: 12 },
  { value: "Pacific/Fiji", label: "Fiji", offset: "UTC+12", offsetNum: 12 },
].sort((a, b) => a.offsetNum - b.offsetNum);

// WELCOME STEP COMPONENT

interface WelcomeStepProps {
  agencyInfo: AgencyInfo;
  creatorName: string;
}

function WelcomeStep({ agencyInfo, creatorName }: WelcomeStepProps) {
  return (
    <div className="text-center py-4 space-y-6">
      {/* Agency Logo */}
      {agencyInfo.logo ? (
        <div className="flex justify-center">
          <div className="size-20 rounded-[10px] bg-tile-hi flex items-center justify-center overflow-hidden">
            <Image
              src={agencyInfo.logo}
              alt={agencyInfo.name}
              width={64}
              height={64}
              unoptimized
              className="object-contain"
            />
          </div>
        </div>
      ) : (
        <div className="flex justify-center">
          <div className="size-20 rounded-[10px] bg-tile-hi flex items-center justify-center text-ink font-extrabold text-3xl tracking-[-0.03em]">
            {agencyInfo.name.charAt(0)}
          </div>
        </div>
      )}

      {/* Welcome message */}
      <div className="space-y-2">
        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          Welcome to {agencyInfo.name}
        </h2>
        <p className="text-muted-foreground text-base max-w-md mx-auto">
          Hi {creatorName}! We&apos;re excited to have you on board. Let&apos;s take a few
          minutes to set up your creator portal.
        </p>
      </div>

      {/* What to expect */}
      <div className="grid gap-3 text-left max-w-sm mx-auto pt-4">
        {[
          { icon: User, text: "Set up your profile" },
          { icon: Globe, text: "Choose your timezone" },
          { icon: Play, text: "Quick portal tutorial" },
        ].map((item, index) => (
          <div
            key={index}
            className="flex min-h-11 items-center gap-3 rounded-[var(--tw-r-ctl)] bg-well px-3 py-2.5"
          >
            <div className="flex size-5 items-center justify-center text-icon" aria-hidden="true">
              <item.icon className="w-4 h-4" />
            </div>
            <span className="text-[15px] font-medium">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// PROFILE SETUP STEP COMPONENT

interface ProfileStepProps {
  profile: CreatorProfile;
  onProfileChange: (updates: Partial<CreatorProfile>) => void;
  creatorEmail: string;
}

function ProfileStep({ profile, onProfileChange, creatorEmail }: ProfileStepProps) {
  const handleAvatarUpload = useCallback(
    async (base64: string) => {
      onProfileChange({ avatar: base64 });
      toast.success("Photo uploaded");
    },
    [onProfileChange]
  );

  const handleAvatarRemove = useCallback(async () => {
    onProfileChange({ avatar: undefined });
  }, [onProfileChange]);

  return (
    <div className="space-y-6">
      {/* Avatar upload */}
      <div className="flex justify-center">
        <AvatarUpload
          user={{ name: profile.name, email: creatorEmail }}
          currentAvatarUrl={profile.avatar}
          onUpload={handleAvatarUpload}
          onRemove={handleAvatarRemove}
          size="2xl"
        />
      </div>

      {/* Name field */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium">
          Display Name
        </Label>
        <Input
          id="name"
          value={profile.name}
          onChange={(e) => onProfileChange({ name: e.target.value })}
          placeholder="Your name"
          className="h-12"
        />
        <p className="text-xs text-muted-foreground">
          This is how you&apos;ll appear to the agency team.
        </p>
      </div>

      {/* Bio field */}
      <div className="space-y-2">
        <Label htmlFor="bio" className="text-sm font-medium">
          Short Bio{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="bio"
          value={profile.bio}
          onChange={(e) => onProfileChange({ bio: e.target.value })}
          placeholder="Tell the team a little about yourself..."
          className="min-h-[100px] resize-none"
          maxLength={200}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Brief description about you</span>
          <span>{profile.bio.length}/200</span>
        </div>
      </div>

      {/* Phone field */}
      <div className="space-y-2">
        <Label htmlFor="phone" className="text-sm font-medium">
          Phone Number{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="phone"
          type="tel"
          value={profile.phone}
          onChange={(e) => onProfileChange({ phone: e.target.value })}
          placeholder="+44 7700 900123"
          className="h-12"
        />
        <p className="text-xs text-muted-foreground">
          Include your country code. Needed if you want texts from your team.
        </p>
      </div>
    </div>
  );
}

// TIMEZONE STEP COMPONENT

interface TimezoneStepProps {
  timezone: string;
  onTimezoneChange: (timezone: string) => void;
}

function TimezoneStep({ timezone, onTimezoneChange }: TimezoneStepProps) {
  // Try to detect user's timezone
  const [detectedTimezone] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  });

  useEffect(() => {
    // Auto-select if not already set
    if (!timezone && detectedTimezone) {
      const match = TIMEZONES.find((tz) => tz.value === detectedTimezone);
      if (match) {
        onTimezoneChange(match.value);
      }
    }
  }, [timezone, detectedTimezone, onTimezoneChange]);

  const currentTime = new Date().toLocaleTimeString("en-US", {
    timeZone: timezone || undefined,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="space-y-6">
      {/* Detected timezone notice */}
      {detectedTimezone && (
        <div className="rounded-[var(--tw-r-ctl)] bg-well p-3">
          <div className="flex items-start gap-3">
            <Globe className="mt-0.5 size-5 shrink-0 text-icon" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">
                We detected your timezone
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Based on your browser settings: {detectedTimezone}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Timezone selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Your time zone</Label>
        <Select value={timezone} onValueChange={onTimezoneChange}>
          <SelectTrigger aria-label="Your time zone" className="h-12">
            <SelectValue placeholder="Choose your time zone" />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                <div className="flex items-center justify-between gap-4 w-full">
                  <span>{tz.label}</span>
                  <span className="text-xs text-muted-foreground">{tz.offset}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Due dates and notifications will be shown in your local time.
        </p>
      </div>

      {/* Current time preview */}
      {timezone && (
        <div className="rounded-[var(--tw-r-ctl)] bg-well p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Current time</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-ink">{currentTime}</p>
        </div>
      )}
    </div>
  );
}

// TUTORIAL STEP COMPONENT

interface TutorialStepProps {
  onStartTutorial: () => void;
  onSkipTutorial: () => void;
}

function TutorialStep({ onStartTutorial, onSkipTutorial }: TutorialStepProps) {
  return (
    <div className="space-y-6 text-center py-4">
      {/* Tutorial illustration */}
      <div className="flex justify-center">
        <div className="size-20 rounded-[10px] bg-tile-hi flex items-center justify-center">
          <Sparkles className="size-9 text-icon" aria-hidden="true" />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2 max-w-md mx-auto">
        <h3 className="text-lg font-semibold">Ready to explore?</h3>
        <p className="text-muted-foreground text-sm">
          Take a quick interactive tour to learn how to navigate your creator portal
          and make the most of its features.
        </p>
      </div>

      {/* Feature previews */}
      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto pt-2">
        {[
          { icon: Upload, text: "Upload content" },
          { icon: FileText, text: "View requests" },
          { icon: MessageCircle, text: "Communicate" },
          { icon: Settings, text: "Manage settings" },
        ].map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-2 rounded-[var(--tw-r-ctl)] bg-well p-3 text-sm"
          >
            <item.icon className="size-4 text-icon" aria-hidden="true" />
            <span>{item.text}</span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
        <Button
          onClick={onStartTutorial}
          className="w-full sm:w-auto min-w-[160px] h-11 touch-manipulation"
        >
          <Play className="w-4 h-4 mr-2" />
          Start the tour
        </Button>
        <Button
          variant="ghost"
          onClick={onSkipTutorial}
          className="w-full sm:w-auto text-muted-foreground h-11 touch-manipulation"
        >
          Skip for now
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// MAIN ONBOARDING PAGE

export default function CreatorOnboardingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [creatorEmail, setCreatorEmail] = useState<string>("");
  const [showTutorial, setShowTutorial] = useState(false);

  // Agency info from the portal's BrandingProvider
  const { agencyName, branding } = useBranding();
  const agencyInfo: AgencyInfo = {
    name: agencyName || BRAND.name,
    logo: branding.logoLight ?? undefined,
  };

  // Profile state
  const [profile, setProfile] = useState<CreatorProfile>({
    name: "",
    bio: "",
    phone: "",
    timezone: "",
    avatar: undefined,
  });

  // Check authentication and load creator data
  useEffect(() => {
    const token = localStorage.getItem("creatorToken");
    const storedCreatorId = localStorage.getItem("creatorId");
    const storedName = localStorage.getItem("creatorName");
    const storedEmail = localStorage.getItem("creatorEmail");
    const onboardingComplete = localStorage.getItem("creatorOnboardingComplete");

    if (!token || !storedCreatorId) {
      router.push("/login");
      return;
    }

    // If onboarding already completed, redirect to portal
    if (onboardingComplete === "true") {
      router.push("/creator/dashboard");
      return;
    }

    setCreatorId(storedCreatorId);
    setCreatorEmail(storedEmail || "");
    setProfile((prev) => ({
      ...prev,
      name: storedName || "",
    }));
    setIsLoading(false);
  }, [router]);

  // Handle profile updates
  const handleProfileChange = useCallback((updates: Partial<CreatorProfile>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  }, []);

  // Persist the onboarding-complete flag (and optionally profile fields) to the
  // server. Uses the real creator session token. Returns true on success.
  const persistOnboardingComplete = useCallback(
    async (includeProfile: boolean): Promise<boolean> => {
      const token = localStorage.getItem("creatorToken");
      if (!token) {
        router.push("/login");
        return false;
      }

      const body: Record<string, unknown> = { onboardingCompleted: true };
      if (includeProfile) {
        body.name = profile.name;
        body.phone = profile.phone;
        body.timezone = profile.timezone;
        body.avatar = profile.avatar;
      }

      const response = await fetch(`/api/portal/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-creator-token": token,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Failed to save onboarding");
      }

      localStorage.setItem("creatorOnboardingComplete", "true");
      return true;
    },
    [profile, router]
  );

  // Handle onboarding completion
  const handleComplete = useCallback(async () => {
    if (!creatorId) return;

    setIsSaving(true);
    try {
      const ok = await persistOnboardingComplete(true);
      if (!ok) return;

      localStorage.setItem("creatorName", profile.name);
      localStorage.setItem("creatorTimezone", profile.timezone);

      toast.success("Welcome aboard! Your portal is ready.");
      router.push("/creator/dashboard");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Your profile didn't save. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }, [creatorId, profile, router, persistOnboardingComplete]);

  // Handle skip onboarding
  const handleSkip = useCallback(async () => {
    if (!creatorId) return;

    try {
      await persistOnboardingComplete(false);
      toast.success("You can always update your settings later.");
      router.push("/creator/dashboard");
    } catch (error) {
      console.error("Error skipping onboarding:", error);
      toast.error("Something went wrong. Please try again.");
    }
  }, [creatorId, router, persistOnboardingComplete]);

  // Handle tutorial completion
  // The tutorial overlay navigates straight to the dashboard, so the wizard's
  // final step never runs. Persist the profile (name, avatar, timezone,
  // notifications) here so the details entered earlier are not lost.
  const handleTutorialComplete = useCallback(async () => {
    setShowTutorial(false);
    if (!creatorId) return;

    try {
      await persistOnboardingComplete(true);
      localStorage.setItem("creatorName", profile.name);
      localStorage.setItem("creatorTimezone", profile.timezone);
      localStorage.setItem("creatorTutorialComplete", "true");
      toast.success("Great job! You're all set to start.");
      router.push("/creator/dashboard");
    } catch (error) {
      console.error("Error completing onboarding:", error);
      toast.error("Something went wrong. Please try again.");
    }
  }, [creatorId, profile, router, persistOnboardingComplete]);

  // Handle tutorial skip
  const handleTutorialSkip = useCallback(async () => {
    setShowTutorial(false);
    if (!creatorId) return;

    try {
      await persistOnboardingComplete(true);
      localStorage.setItem("creatorName", profile.name);
      localStorage.setItem("creatorTimezone", profile.timezone);
      toast.success("You can restart the tutorial anytime from settings.");
      router.push("/creator/dashboard");
    } catch (error) {
      console.error("Error completing onboarding:", error);
      toast.error("Something went wrong. Please try again.");
    }
  }, [creatorId, profile, router, persistOnboardingComplete]);

  // Tutorial steps (shown after onboarding wizard)
  const tutorialSteps: TutorialStep[] = [
    {
      id: "dashboard",
      target: "[data-tutorial='dashboard']",
      title: "Your Dashboard",
      content:
        "This is your home base. Here you'll see an overview of your pending requests, recent activity, and quick stats.",
      position: "bottom",
      spotlight: true,
    },
    {
      id: "requests",
      target: "[data-tutorial='requests']",
      title: "Content Requests",
      content:
        "View all your content requests here. You can filter by status, due date, and more.",
      position: "bottom",
      spotlight: true,
    },
    {
      id: "upload",
      target: "[data-tutorial='upload']",
      title: "Upload Content",
      content:
        "Click here to upload files for a request. You can drag and drop multiple files at once.",
      position: "bottom",
      spotlight: true,
    },
    {
      id: "messages",
      target: "[data-tutorial='messages']",
      title: "Messages",
      content:
        "Communicate with your agency team here. Ask questions, get feedback, and collaborate on content.",
      position: "left",
      spotlight: true,
    },
    {
      id: "settings",
      target: "[data-tutorial='settings']",
      title: "Settings",
      content:
        "Update your profile, notification preferences, and other account settings anytime.",
      position: "bottom-right",
      spotlight: true,
    },
  ];

  // Define wizard steps
  const onboardingSteps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Welcome",
      description: "Let's get you started",
      icon: <Sparkles className="w-5 h-5" />,
      content: (
        <WelcomeStep agencyInfo={agencyInfo} creatorName={profile.name || "Creator"} />
      ),
    },
    {
      id: "profile",
      title: "Profile",
      description: "Tell us about yourself",
      icon: <User className="w-5 h-5" />,
      content: (
        <ProfileStep
          profile={profile}
          onProfileChange={handleProfileChange}
          creatorEmail={creatorEmail}
        />
      ),
      validationFn: () => {
        if (!profile.name.trim()) {
          toast.error("Add the name CCM should call you.");
          return false;
        }
        return true;
      },
    },
    {
      id: "timezone",
      title: "Timezone",
      description: "Set your local time",
      icon: <Globe className="w-5 h-5" />,
      content: (
        <TimezoneStep
          timezone={profile.timezone}
          onTimezoneChange={(tz) => handleProfileChange({ timezone: tz })}
        />
      ),
      validationFn: () => {
        if (!profile.timezone) {
          toast.error("Choose your time zone to continue.");
          return false;
        }
        return true;
      },
    },
    {
      id: "tutorial",
      title: "Quick tour",
      description: "Learn the basics",
      icon: <Play className="w-5 h-5" />,
      content: (
        <TutorialStep
          onStartTutorial={() => setShowTutorial(true)}
          onSkipTutorial={() => setShowTutorial(false)}
        />
      ),
      optional: true,
    },
    {
      id: "complete",
      title: "Complete",
      description: "You're all set!",
      icon: <CheckCircle2 className="w-5 h-5" />,
      content: (
        <div className="text-center py-8 space-y-6">
          <div className="flex justify-center">
            <div className="size-20 rounded-[10px] bg-tile-hi flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">You&apos;re all set!</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Your profile is ready. You can now view your content requests
              and start uploading.
            </p>
          </div>
        </div>
      ),
      optional: false,
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto size-8 animate-spin text-icon motion-reduce:animate-none" aria-hidden="true" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
      {/* Main content */}
      <div className="relative z-10 w-full max-w-2xl mx-auto">
        <OnboardingWizard
          steps={onboardingSteps}
          title={`Welcome to ${agencyInfo.name}`}
          subtitle="A few quick steps, then you'll see your requests."
          agencyName={agencyInfo.name}
          onComplete={handleComplete}
          onSkip={handleSkip}
          allowSkip={true}
          showProgress={true}
          onStepComplete={(stepId, index) => {
            console.log(`Completed step: ${stepId} (${index})`);
          }}
        />
      </div>

      {/* Tutorial overlay */}
      <TutorialOverlay
        steps={tutorialSteps}
        isActive={showTutorial}
        onComplete={handleTutorialComplete}
        onSkip={handleTutorialSkip}
        showDontShowAgain={true}
        storageKey="creator-portal-tutorial"
      />

      {/* Saving overlay */}
      {isSaving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(8_9_11/0.74)]" role="status">
          <div className="flex items-center gap-4 rounded-[10px] bg-raised p-6 shadow-lg">
            <Loader2 className="size-6 animate-spin text-icon motion-reduce:animate-none" aria-hidden="true" />
            <span className="font-medium">Saving your profile...</span>
          </div>
        </div>
      )}
    </div>
  );
}
