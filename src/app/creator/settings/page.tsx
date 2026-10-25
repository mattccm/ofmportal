"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Camera, Lock, Save, LogOut } from "lucide-react";
import { toast } from "sonner";
import { ThemeSwitcher } from "@/components/theme/theme-toggle";
import { useTheme } from "@/components/theme/theme-provider";
import { clearCreatorSession, setSignedOutFlag } from "@/lib/remember-token";
import { compressAvatarImage, validateAvatarFile } from "@/lib/avatar";
import { clearCreatorCookie } from "@/lib/creator-cookies";

const TIMEZONES = [
  // UTC-12 to UTC-8
  { value: "Pacific/Midway", label: "Midway Island (UTC-11)", offset: -11 },
  { value: "Pacific/Honolulu", label: "Hawaii (UTC-10)", offset: -10 },
  { value: "America/Anchorage", label: "Alaska (UTC-9)", offset: -9 },
  { value: "America/Los_Angeles", label: "Los Angeles / Pacific (UTC-8)", offset: -8 },
  { value: "America/Vancouver", label: "Vancouver (UTC-8)", offset: -8 },
  // UTC-7
  { value: "America/Phoenix", label: "Phoenix / Arizona (UTC-7)", offset: -7 },
  { value: "America/Denver", label: "Denver / Mountain (UTC-7)", offset: -7 },
  // UTC-6 to UTC-4
  { value: "America/Chicago", label: "Chicago / Central (UTC-6)", offset: -6 },
  { value: "America/Mexico_City", label: "Mexico City (UTC-6)", offset: -6 },
  { value: "America/New_York", label: "New York / Eastern (UTC-5)", offset: -5 },
  { value: "America/Toronto", label: "Toronto (UTC-5)", offset: -5 },
  { value: "America/Bogota", label: "Bogota (UTC-5)", offset: -5 },
  { value: "America/Halifax", label: "Halifax / Atlantic (UTC-4)", offset: -4 },
  { value: "America/Caracas", label: "Caracas (UTC-4)", offset: -4 },
  // UTC-3 to UTC-1
  { value: "America/Sao_Paulo", label: "Sao Paulo / Brasilia (UTC-3)", offset: -3 },
  { value: "America/Buenos_Aires", label: "Buenos Aires (UTC-3)", offset: -3 },
  { value: "Atlantic/South_Georgia", label: "Mid-Atlantic (UTC-2)", offset: -2 },
  { value: "Atlantic/Azores", label: "Azores (UTC-1)", offset: -1 },
  // UTC+0 to UTC+3
  { value: "Europe/London", label: "London / GMT (UTC+0)", offset: 0 },
  { value: "Europe/Dublin", label: "Dublin (UTC+0)", offset: 0 },
  { value: "Europe/Lisbon", label: "Lisbon (UTC+0)", offset: 0 },
  { value: "Africa/Lagos", label: "Lagos (UTC+1)", offset: 1 },
  { value: "Europe/Paris", label: "Paris (UTC+1)", offset: 1 },
  { value: "Europe/Berlin", label: "Berlin (UTC+1)", offset: 1 },
  { value: "Europe/Amsterdam", label: "Amsterdam (UTC+1)", offset: 1 },
  { value: "Europe/Rome", label: "Rome (UTC+1)", offset: 1 },
  { value: "Europe/Madrid", label: "Madrid (UTC+1)", offset: 1 },
  { value: "Africa/Cairo", label: "Cairo (UTC+2)", offset: 2 },
  { value: "Europe/Helsinki", label: "Helsinki (UTC+2)", offset: 2 },
  { value: "Europe/Athens", label: "Athens (UTC+2)", offset: 2 },
  { value: "Africa/Johannesburg", label: "Johannesburg (UTC+2)", offset: 2 },
  { value: "Europe/Moscow", label: "Moscow (UTC+3)", offset: 3 },
  { value: "Asia/Istanbul", label: "Istanbul (UTC+3)", offset: 3 },
  { value: "Asia/Riyadh", label: "Riyadh (UTC+3)", offset: 3 },
  // UTC+4 to UTC+6
  { value: "Asia/Dubai", label: "Dubai (UTC+4)", offset: 4 },
  { value: "Asia/Baku", label: "Baku (UTC+4)", offset: 4 },
  { value: "Asia/Karachi", label: "Karachi (UTC+5)", offset: 5 },
  { value: "Asia/Tashkent", label: "Tashkent (UTC+5)", offset: 5 },
  { value: "Asia/Kolkata", label: "Mumbai / India (UTC+5:30)", offset: 5.5 },
  { value: "Asia/Dhaka", label: "Dhaka (UTC+6)", offset: 6 },
  { value: "Asia/Almaty", label: "Almaty (UTC+6)", offset: 6 },
  // UTC+7 to UTC+9
  { value: "Asia/Bangkok", label: "Bangkok (UTC+7)", offset: 7 },
  { value: "Asia/Jakarta", label: "Jakarta (UTC+7)", offset: 7 },
  { value: "Asia/Ho_Chi_Minh", label: "Ho Chi Minh City (UTC+7)", offset: 7 },
  { value: "Asia/Singapore", label: "Singapore (UTC+8)", offset: 8 },
  { value: "Asia/Hong_Kong", label: "Hong Kong (UTC+8)", offset: 8 },
  { value: "Asia/Shanghai", label: "Shanghai / Beijing (UTC+8)", offset: 8 },
  { value: "Asia/Taipei", label: "Taipei (UTC+8)", offset: 8 },
  { value: "Asia/Manila", label: "Manila (UTC+8)", offset: 8 },
  { value: "Australia/Perth", label: "Perth (UTC+8)", offset: 8 },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+9)", offset: 9 },
  { value: "Asia/Seoul", label: "Seoul (UTC+9)", offset: 9 },
  // UTC+9:30 to UTC+11 - Australia
  { value: "Australia/Darwin", label: "Darwin (UTC+9:30)", offset: 9.5 },
  { value: "Australia/Adelaide", label: "Adelaide (UTC+9:30)", offset: 9.5 },
  { value: "Australia/Brisbane", label: "Brisbane (UTC+10)", offset: 10 },
  { value: "Australia/Sydney", label: "Sydney (UTC+10/11)", offset: 10 },
  { value: "Australia/Melbourne", label: "Melbourne (UTC+10/11)", offset: 10 },
  { value: "Australia/Hobart", label: "Hobart (UTC+10/11)", offset: 10 },
  { value: "Pacific/Guam", label: "Guam (UTC+10)", offset: 10 },
  { value: "Pacific/Noumea", label: "Noumea (UTC+11)", offset: 11 },
  // UTC+12 to UTC+13
  { value: "Pacific/Auckland", label: "Auckland (UTC+12/13)", offset: 12 },
  { value: "Pacific/Fiji", label: "Fiji (UTC+12)", offset: 12 },
  { value: "Pacific/Tongatapu", label: "Tonga (UTC+13)", offset: 13 },
].sort((a, b) => a.offset - b.offset);

export default function CreatorSettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [avatar, setAvatar] = useState<string | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("creatorToken");
    const creatorId = localStorage.getItem("creatorId");

    if (!token || !creatorId) {
      router.push("/login");
      return;
    }

    fetchProfile();
  }, [router]);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch("/api/portal/profile", {
        headers: {
          "x-creator-token": token || "",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setName(data.name || "");
        setEmail(data.email || localStorage.getItem("creatorEmail") || "");
        setPhone(data.phone || "");
        setTimezone(data.timezone || "America/New_York");
        setAvatar(data.avatar || null);
      } else {
        // Fallback to localStorage
        setName(localStorage.getItem("creatorName") || "");
        setEmail(localStorage.getItem("creatorEmail") || "");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      // Fallback to localStorage
      setName(localStorage.getItem("creatorName") || "");
      setEmail(localStorage.getItem("creatorEmail") || "");
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      toast.error(validation.error || "Invalid image");
      return;
    }

    // Downscale to a small square JPEG before storing. A profile photo never
    // needs to be large, and this keeps the base64 payload well under the
    // request-body limit when it is saved.
    try {
      const compressed = await compressAvatarImage(file);
      setPreviewImage(compressed);
    } catch {
      toast.error("That photo couldn't be read. Try a JPG or PNG.");
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch("/api/portal/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-creator-token": token || "",
        },
        body: JSON.stringify({
          name,
          phone,
          timezone,
          avatar: previewImage || undefined,
        }),
      });

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error("That image is too large — please choose a smaller one");
        }
        throw new Error("Your profile didn't save. Try again.");
      }

      // Update local storage
      localStorage.setItem("creatorName", name);

      toast.success("Profile saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your profile didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("The two new passwords don't match. Type them again.");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Use at least 8 characters for your new password.");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch("/api/portal/profile/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-creator-token": token || "",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Your password didn't change. Check your current password and try again.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      toast.success("Password changed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your password didn't change. Check your current password and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    const token = localStorage.getItem("creatorToken");

    // Set signed-out flag to prevent auto-login
    setSignedOutFlag();

    // Call logout API to invalidate session
    if (token) {
      try {
        await fetch("/api/portal/logout", {
          method: "POST",
          headers: {
            "x-creator-token": token,
          },
        });
      } catch (error) {
        console.error("Error logging out:", error);
      }
    }

    // Clear IndexedDB
    try {
      await clearCreatorSession();
    } catch (error) {
      console.error("Error clearing IndexedDB:", error);
    }

    // Clear local storage
    localStorage.removeItem("creatorToken");
    localStorage.removeItem("creatorId");
    localStorage.removeItem("creatorName");
    localStorage.removeItem("creatorEmail");
    localStorage.removeItem("creatorAvatar");
    localStorage.removeItem("creatorOnboardingComplete");

    // Clear cookies
    clearCreatorCookie("creatorToken");
    clearCreatorCookie("creatorId");
    clearCreatorCookie("creatorName");
    clearCreatorCookie("creatorEmail");

    router.push("/login");
  };

  if (loading) {
    return (
      <div className="px-4 pt-5 lg:max-w-[640px] lg:px-6 lg:pt-10" role="status" aria-label="Loading your settings">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-6 h-72 w-full" />
        <Skeleton className="mt-6 h-32 w-full" />
      </div>
    );
  }

  const sectionH = "mb-2 text-[17px] font-semibold leading-snug";
  const tile = "rounded-[var(--tw-r-tile)] bg-tile p-4";

  return (
    <div className="px-4 pt-5 lg:max-w-[640px] lg:px-6 lg:pt-10">
      <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] lg:text-[26px]">Settings</h1>
      <p className="mt-1 text-[15px] leading-normal text-ink-2">Your profile, time zone and password.</p>

      <section aria-labelledby="profile-h" className="mt-6">
        <h2 id="profile-h" className={sectionH}>
          Profile
        </h2>
        <div className={cn(tile, "space-y-5")}>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar size="2xl" user={{ name, email, image: previewImage || avatar }} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Change your photo"
                className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full bg-tile-hi text-ink outline-2 outline-tile transition-colors after:absolute after:-inset-1 after:content-[''] hover:bg-raised-hi focus-visible:outline-ring"
              >
                <Camera className="size-4" aria-hidden="true" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">Your photo</p>
              <p className="text-[14px] leading-normal text-ink-2">Only your team sees it. Use the camera button to change it.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} disabled aria-describedby="email-note" />
              <p id="email-note" className="text-[13px] text-ink-2">
                To change your email, message your team.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+61 400 000 000"
              autoComplete="tel"
            />
          </div>

          <Button onClick={handleSaveProfile} disabled={saving} className="h-11 md:h-9">
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Save profile
          </Button>
        </div>
      </section>

      <section aria-labelledby="tz-h" className="mt-8">
        <h2 id="tz-h" className={sectionH}>
          Time zone
        </h2>
        <div className={tile}>
          <Label htmlFor="tz" className="text-[14px] font-normal text-ink-2">
            Due dates and times show in this time zone.
          </Label>
          <div className="mt-2 max-w-sm">
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="tz">
                <SelectValue placeholder="Choose a time zone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSaveProfile} disabled={saving} className="mt-4 h-11 md:h-9" variant="outline">
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Save time zone
          </Button>
        </div>
      </section>

      <section aria-labelledby="look-h" className="mt-8">
        <h2 id="look-h" className={sectionH}>
          Appearance
        </h2>
        <div className={tile}>
          <ThemeSwitcher theme={theme} setTheme={setTheme} />
        </div>
      </section>

      <section aria-labelledby="pw-h" className="mt-8">
        <h2 id="pw-h" className={sectionH}>
          Password
        </h2>
        <div className={cn(tile, "space-y-4")}>
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                aria-describedby="pw-rule"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Type it again</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <p id="pw-rule" className="text-[13px] text-ink-2">
            At least 8 characters.
          </p>
          <Button
            onClick={handleChangePassword}
            disabled={saving || !currentPassword || !newPassword}
            variant="outline"
            className="h-11 md:h-9"
          >
            {saving ? <Loader2 className="animate-spin" /> : <Lock />}
            Change password
          </Button>
        </div>
      </section>

      <section aria-labelledby="out-h" className="mt-8">
        <h2 id="out-h" className={sectionH}>
          Sign out
        </h2>
        <div className={cn(tile, "flex flex-wrap items-center gap-3")}>
          <p className="min-w-0 flex-1 text-[14px] leading-normal text-ink-2">
            Signs you out on this device. You&apos;ll need your password to sign in again.
          </p>
          <Button onClick={handleSignOut} variant="destructive" className="h-11 md:h-9">
            <LogOut />
            Sign out
          </Button>
        </div>
      </section>
    </div>
  );
}
