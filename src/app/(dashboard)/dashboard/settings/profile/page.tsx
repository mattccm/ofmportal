"use client";

import * as React from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  User,
  Mail,
  Phone,
  Globe,
  FileText,
  Loader2,
  Save,
  ArrowLeft,
  Shield,
  ChevronRight,
  Clock,
  Settings2,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { TimezoneSelector, TimezoneBadge } from "@/components/settings/timezone-selector";
import { formatTime } from "@/lib/timezone-utils";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatusBar } from "@/components/forms/autosave-indicator";
import { RecoveryDialog } from "@/components/forms/recovery-dialog";
import { clearFormData } from "@/lib/form-storage";
import { clearRememberToken, setSignedOutFlag } from "@/lib/remember-token";

// Languages (for future use)
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
];

interface ProfileData {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatar: string | null;
  bio: string | null;
  timezone: string;
  preferredLanguage: string;
  role: string;
  twoFactorEnabled: boolean;
}

interface ProfileFormData {
  name: string;
  email: string;
  phone: string;
  bio: string;
  timezone: string;
  preferredLanguage: string;
  [key: string]: unknown;
}

const FORM_ID = "profile-settings-form";

// Helper component to display current time in a timezone
function TimezoneCurrentTime({ timezone }: { timezone: string }) {
  const [currentTime, setCurrentTime] = React.useState<string>("");

  React.useEffect(() => {
    const updateTime = () => {
      setCurrentTime(formatTime(new Date(), timezone, { hour12: true }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  return (
    <p className="text-sm text-muted-foreground">{currentTime}</p>
  );
}

export default function ProfileSettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [profile, setProfile] = React.useState<ProfileData | null>(null);
  const [showRecoveryDialog, setShowRecoveryDialog] = React.useState(false);
  const [formData, setFormData] = React.useState<ProfileFormData>({
    name: "",
    email: "",
    phone: "",
    bio: "",
    timezone: "America/New_York",
    preferredLanguage: "en",
  });

  // Initialize autosave
  const autosave = useAutosave<ProfileFormData>({
    formId: FORM_ID,
    data: formData,
    debounceMs: 1500,
    enabled: !isLoading && !!profile,
    onConflict: () => {
      setShowRecoveryDialog(true);
    },
  });

  // Handle recovery
  const handleRestore = () => {
    const recovered = autosave.recover();
    if (recovered) {
      setFormData({
        name: recovered.name || "",
        email: recovered.email || profile?.email || "",
        phone: recovered.phone || "",
        bio: recovered.bio || "",
        timezone: recovered.timezone || "America/New_York",
        preferredLanguage: recovered.preferredLanguage || "en",
      });
      toast.success("Form data restored successfully");
    }
  };

  const handleDiscard = () => {
    autosave.dismissRecovery();
    toast.info("Previous data discarded");
  };

  // Fetch profile data
  React.useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch("/api/users/profile");
        if (!response.ok) {
          throw new Error("Failed to fetch profile");
        }
        const data = await response.json();
        setProfile(data);
        setFormData({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          bio: data.bio || "",
          timezone: data.timezone || "America/New_York",
          preferredLanguage: data.preferredLanguage || "en",
        });
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast.error("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, []);

  // Track changes
  React.useEffect(() => {
    if (profile) {
      const changed =
        formData.name !== (profile.name || "") ||
        formData.phone !== (profile.phone || "") ||
        formData.bio !== (profile.bio || "") ||
        formData.timezone !== (profile.timezone || "America/New_York") ||
        formData.preferredLanguage !== (profile.preferredLanguage || "en");
      setHasChanges(changed);
    }
  }, [formData, profile]);

  // Handle input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    setIsSaving(true);

    try {
      // Build update payload - only include email if it changed (for owners)
      const updatePayload: Record<string, unknown> = {
        name: formData.name,
        phone: formData.phone || null,
        bio: formData.bio || null,
        timezone: formData.timezone,
        preferredLanguage: formData.preferredLanguage,
      };

      // Include email if changed (API will validate owner role)
      if (formData.email && formData.email !== profile?.email) {
        updatePayload.email = formData.email;
      }

      const response = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update profile");
      }

      const data = await response.json();
      setProfile((prev) => (prev ? { ...prev, ...data.user } : null));
      setHasChanges(false);

      // Clear autosaved data on successful submit
      clearFormData(FORM_ID);

      // Update session if name changed
      if (session?.user?.name !== formData.name) {
        await updateSession({ name: formData.name });
      }

      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Handle avatar upload
  const handleAvatarUpload = async (base64: string) => {
    try {
      const response = await fetch("/api/users/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload avatar");
      }

      const data = await response.json();

      // Add cache-busting parameter to force browser to load new image
      const cacheBustedUrl = data.url.startsWith("data:")
        ? data.url
        : `${data.url}${data.url.includes("?") ? "&" : "?"}t=${Date.now()}`;

      setProfile((prev) => (prev ? { ...prev, avatar: cacheBustedUrl } : null));

      // Update session to reflect new avatar everywhere
      // Use cache-busted URL to ensure immediate update
      await updateSession({ image: cacheBustedUrl });

      // Force router refresh to ensure all components re-render with new session
      router.refresh();

      toast.success("Avatar updated successfully");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload avatar"
      );
      throw error;
    }
  };

  // Handle avatar removal
  const handleAvatarRemove = async () => {
    try {
      const response = await fetch("/api/users/avatar", {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove avatar");
      }

      setProfile((prev) => (prev ? { ...prev, avatar: null } : null));

      // Update session to reflect removed avatar everywhere
      await updateSession({ image: null });

      // Force router refresh to ensure all components re-render with new session
      router.refresh();

      toast.success("Avatar removed");
    } catch (error) {
      console.error("Error removing avatar:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to remove avatar"
      );
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-24">
      {/* Recovery Dialog */}
      <RecoveryDialog
        open={showRecoveryDialog}
        onOpenChange={setShowRecoveryDialog}
        data={autosave.recoverableData}
        onRestore={handleRestore}
        onDiscard={handleDiscard}
        formName="profile"
        fieldLabels={{
          name: "Full Name",
          phone: "Phone Number",
          bio: "Bio",
          timezone: "Timezone",
          preferredLanguage: "Preferred Language",
        }}
      />

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profile Settings</h1>
          <p className="text-muted-foreground">
            Manage your account information and preferences
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Avatar Section */}
        <Card className="card-elevated overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-primary/20 via-violet-500/20 to-purple-500/20" />
          <CardContent className="relative pt-0 pb-6">
            <div className="-mt-12 flex flex-col items-center text-center">
              <AvatarUpload
                user={profile}
                currentAvatarUrl={profile?.avatar}
                onUpload={handleAvatarUpload}
                onRemove={handleAvatarRemove}
                size="3xl"
              />
              <div className="mt-4">
                <h2 className="text-xl font-semibold">{profile?.name}</h2>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card className="card-elevated">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Update your personal details
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter your name"
                  className="pl-10 h-10"
                  required
                />
              </div>
            </div>

            {/* Email - editable for owners only */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                {profile?.role === "OWNER" ? (
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    className="pl-10 h-10"
                  />
                ) : (
                  <Input
                    id="email"
                    value={profile?.email || ""}
                    className="pl-10 h-10 bg-muted/50"
                    disabled
                    readOnly
                  />
                )}
              </div>
              {profile?.role === "OWNER" ? (
                <p className="text-xs text-muted-foreground">
                  As the account owner, you can update your email address
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Contact your account owner to change your email address
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 000-0000"
                  className="pl-10 h-10"
                />
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  placeholder="Tell us a little about yourself..."
                  className="pl-10 min-h-[100px] resize-none"
                  maxLength={500}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">
                {formData.bio.length}/500 characters
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="card-elevated">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <CardTitle>Preferences</CardTitle>
                <CardDescription>
                  Customize your regional and language settings
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Timezone - Using Enhanced Selector */}
            <div className="space-y-2">
              <TimezoneSelector
                value={formData.timezone}
                onChange={(value) => handleSelectChange("timezone", value)}
                showAutoDetect
                showCurrentTime
                label="Timezone"
                description="Used for scheduling, notifications, and displaying dates"
              />
            </div>

            {/* Timezone Quick Info */}
            {formData.timezone && (
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Current Time</p>
                      <TimezoneCurrentTime timezone={formData.timezone} />
                    </div>
                  </div>
                  <TimezoneBadge timezone={formData.timezone} showTime={false} />
                </div>
              </div>
            )}

            {/* Language */}
            <div className="space-y-2">
              <Label htmlFor="language">Preferred Language</Label>
              <Select
                value={formData.preferredLanguage}
                onValueChange={(value) =>
                  handleSelectChange("preferredLanguage", value)
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Coming soon: Full interface localization
              </p>
            </div>

            {/* Advanced Timezone Settings Link */}
            <div className="pt-2">
              <Link
                href="/dashboard/settings/timezone"
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Settings2 className="h-4 w-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Advanced Timezone Settings</p>
                    <p className="text-xs text-muted-foreground">
                      Date formats, business hours, and more
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Security Quick Link */}
        <Card className="card-elevated">
          <CardContent className="p-4">
            <Link
              href="/dashboard/settings/security"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="font-medium">Security Settings</p>
                  <p className="text-sm text-muted-foreground">
                    {profile?.twoFactorEnabled
                      ? "2FA enabled"
                      : "Set up two-factor authentication"}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </Link>
          </CardContent>
        </Card>

        {/* Sign Out */}
        <Card className="card-elevated border-red-200 dark:border-red-900/50">
          <CardContent className="p-4">
            <button
              type="button"
              onClick={async () => {
                setSignedOutFlag();
                await clearRememberToken();
                signOut({ callbackUrl: "/login" });
              }}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group w-full text-left"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <LogOut className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="font-medium text-red-600">Sign Out</p>
                  <p className="text-sm text-muted-foreground">
                    Sign out of your account on this device
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-red-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </CardContent>
        </Card>

        </form>

      {/* Sticky Save Status Bar */}
      <div className="fixed bottom-4 left-0 right-0 px-4 z-40">
        <div className="max-w-3xl mx-auto">
          <SaveStatusBar
            status={autosave.status}
            lastSavedText={autosave.lastSavedText}
            hasChanges={hasChanges}
            className="bg-background/95 backdrop-blur-sm"
          >
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={!hasChanges || isSaving}
              className={hasChanges ? "bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90" : ""}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </SaveStatusBar>
        </div>
      </div>
    </div>
  );
}
