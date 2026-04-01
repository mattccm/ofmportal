"use client";

import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OnboardingWizard, type OnboardingStep } from "@/components/onboarding/onboarding-wizard";
import { TutorialOverlay, type TutorialStep } from "@/components/onboarding/tutorial-overlay";
import {
  User,
  Globe,
  Bell,
  CheckCircle2,
  Mail,
  MessageSquare,
  Phone,
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

// ============================================
// TYPES
// ============================================

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
  emailNotifications: boolean;
  smsNotifications: boolean;
  avatar?: string;
}

// ============================================
// TIMEZONE DATA - Comprehensive list sorted by offset
// ============================================

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

// ============================================
// WELCOME STEP COMPONENT
// ============================================

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
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 flex items-center justify-center overflow-hidden">
            <Image
              src={agencyInfo.logo}
              alt={agencyInfo.name}
              width={64}
              height={64}
              className="object-contain"
            />
          </div>
        </div>
      ) : (
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-indigo-500/25">
            {agencyInfo.name.charAt(0)}
          </div>
        </div>
      )}

      {/* Welcome message */}
      <div className="space-y-2">
        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          Welcome to {agencyInfo.name}!
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
          { icon: Bell, text: "Configure notifications" },
          { icon: Play, text: "Quick portal tutorial" },
        ].map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/10 to-violet-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <item.icon className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// PROFILE SETUP STEP COMPONENT
// ============================================

interface ProfileStepProps {
  profile: CreatorProfile;
  onProfileChange: (updates: Partial<CreatorProfile>) => void;
  creatorEmail: string;
}

function ProfileStep({ profile, onProfileChange, creatorEmail }: ProfileStepProps) {
  const handleAvatarUpload = useCallback(
    async (base64: string) => {
      // In a real app, upload to server and get URL
      onProfileChange({ avatar: base64 });
      toast.success("Photo uploaded successfully!");
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
          placeholder="+1 (555) 123-4567"
          className="h-12"
        />
        <p className="text-xs text-muted-foreground">
          Required if you want to receive SMS notifications.
        </p>
      </div>
    </div>
  );
}

// ============================================
// TIMEZONE STEP COMPONENT
// ============================================

interface TimezoneStepProps {
  timezone: string;
  onTimezoneChange: (timezone: string) => void;
}

function TimezoneStep({ timezone, onTimezoneChange }: TimezoneStepProps) {
  const [detectedTimezone, setDetectedTimezone] = useState<string | null>(null);

  useEffect(() => {
    // Try to detect user's timezone
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setDetectedTimezone(detected);

    // Auto-select if not already set
    if (!timezone && detected) {
      const match = TIMEZONES.find((tz) => tz.value === detected);
      if (match) {
        onTimezoneChange(match.value);
      }
    }
  }, [timezone, onTimezoneChange]);

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
        <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800">
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
                We detected your timezone
              </p>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">
                Based on your browser settings: {detectedTimezone}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Timezone selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Your Timezone</Label>
        <Select value={timezone} onValueChange={onTimezoneChange}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Select your timezone" />
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
        <div className="p-4 rounded-xl bg-muted/50 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Current time</span>
          </div>
          <p className="text-2xl font-bold gradient-text">{currentTime}</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// NOTIFICATIONS STEP COMPONENT
// ============================================

interface NotificationsStepProps {
  profile: CreatorProfile;
  onProfileChange: (updates: Partial<CreatorProfile>) => void;
  creatorEmail: string;
}

function NotificationsStep({
  profile,
  onProfileChange,
  creatorEmail,
}: NotificationsStepProps) {
  return (
    <div className="space-y-6">
      {/* Email notifications */}
      <label
        className={cn(
          "flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all",
          profile.emailNotifications
            ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20"
            : "border-border hover:border-muted-foreground/30"
        )}
      >
        <div className="pt-0.5">
          <Checkbox
            checked={profile.emailNotifications}
            onCheckedChange={(checked) =>
              onProfileChange({ emailNotifications: checked as boolean })
            }
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="font-medium">Email Notifications</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Receive updates about new requests, due date reminders, and feedback
            at {creatorEmail}
          </p>
        </div>
      </label>

      {/* SMS notifications */}
      <label
        className={cn(
          "flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all",
          profile.smsNotifications
            ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20"
            : "border-border hover:border-muted-foreground/30",
          !profile.phone && "opacity-60 cursor-not-allowed"
        )}
      >
        <div className="pt-0.5">
          <Checkbox
            checked={profile.smsNotifications}
            onCheckedChange={(checked) => {
              if (profile.phone) {
                onProfileChange({ smsNotifications: checked as boolean });
              }
            }}
            disabled={!profile.phone}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="font-medium">SMS Notifications</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {profile.phone
              ? `Get urgent alerts via text message at ${profile.phone}`
              : "Add a phone number in your profile to enable SMS notifications"}
          </p>
        </div>
      </label>

      {/* Notification types preview */}
      <div className="pt-4">
        <p className="text-sm font-medium mb-3">You&apos;ll be notified about:</p>
        <div className="grid gap-2">
          {[
            { icon: FileText, text: "New content requests" },
            { icon: Clock, text: "Upcoming due dates" },
            { icon: MessageCircle, text: "Feedback and comments" },
            { icon: CheckCircle2, text: "Approval updates" },
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
              <item.icon className="w-4 h-4 text-indigo-500" />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// TUTORIAL STEP COMPONENT
// ============================================

interface TutorialStepProps {
  onStartTutorial: () => void;
  onSkipTutorial: () => void;
}

function TutorialStep({ onStartTutorial, onSkipTutorial }: TutorialStepProps) {
  return (
    <div className="space-y-6 text-center py-4">
      {/* Tutorial illustration */}
      <div className="flex justify-center">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 flex items-center justify-center">
          <Sparkles className="w-12 h-12 text-indigo-500" />
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
            className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 text-sm"
          >
            <item.icon className="w-4 h-4 text-indigo-500" />
            <span>{item.text}</span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
        <Button
          onClick={onStartTutorial}
          className="w-full sm:w-auto min-w-[160px] h-11 btn-gradient touch-manipulation"
        >
          <Play className="w-4 h-4 mr-2" />
          Start Tutorial
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

// ============================================
// MAIN ONBOARDING PAGE
// ============================================

export default function CreatorOnboardingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [creatorEmail, setCreatorEmail] = useState<string>("");
  const [showTutorial, setShowTutorial] = useState(false);
  const [skipTutorial, setSkipTutorial] = useState(false);

  // Agency info (would come from API in real app)
  const [agencyInfo] = useState<AgencyInfo>({
    name: "Upload Portal",
    logo: undefined,
  });

  // Profile state
  const [profile, setProfile] = useState<CreatorProfile>({
    name: "",
    bio: "",
    phone: "",
    timezone: "",
    emailNotifications: true,
    smsNotifications: false,
    avatar: undefined,
  });

  // Refs for tutorial targets
  const dashboardRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLDivElement>(null);
  const requestsRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

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

  // Handle onboarding completion
  const handleComplete = useCallback(async () => {
    if (!creatorId) return;

    setIsSaving(true);
    try {
      // Save profile to server
      const response = await fetch(`/api/portal/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorId,
        },
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone,
          timezone: profile.timezone,
          avatar: profile.avatar,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save profile');
      }

      // Mark onboarding as complete
      localStorage.setItem("creatorOnboardingComplete", "true");
      localStorage.setItem("creatorName", profile.name);
      localStorage.setItem("creatorTimezone", profile.timezone);

      toast.success("Welcome aboard! Your portal is ready.");
      router.push("/creator/dashboard");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [creatorId, profile, router]);

  // Handle skip onboarding
  const handleSkip = useCallback(() => {
    if (!creatorId) return;

    localStorage.setItem("creatorOnboardingComplete", "true");
    toast.success("You can always update your settings later.");
    router.push("/creator/dashboard");
  }, [creatorId, router]);

  // Handle tutorial completion
  const handleTutorialComplete = useCallback(() => {
    setShowTutorial(false);
    if (creatorId) {
      localStorage.setItem("creatorTutorialComplete", "true");
      toast.success("Great job! You're all set to start.");
      router.push("/creator/dashboard");
    }
  }, [creatorId, router]);

  // Handle tutorial skip
  const handleTutorialSkip = useCallback(() => {
    setShowTutorial(false);
    if (creatorId) {
      toast.success("You can restart the tutorial anytime from settings.");
      router.push("/creator/dashboard");
    }
  }, [creatorId, router]);

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
          toast.error("Please enter your display name");
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
          toast.error("Please select your timezone");
          return false;
        }
        return true;
      },
    },
    {
      id: "complete",
      title: "Complete",
      description: "You're all set!",
      icon: <CheckCircle2 className="w-5 h-5" />,
      content: (
        <div className="text-center py-8 space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
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
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-200/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-violet-200/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-purple-200/25 rounded-full blur-3xl" />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-2xl mx-auto">
        <OnboardingWizard
          steps={onboardingSteps}
          title={`Welcome to ${agencyInfo.name}!`}
          subtitle="Let's set up your creator portal"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 flex items-center gap-4 shadow-xl">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="font-medium">Saving your profile...</span>
          </div>
        </div>
      )}
    </div>
  );
}
