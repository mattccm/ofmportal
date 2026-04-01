"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranding } from "@/components/providers/branding-provider";
import {
  Loader2,
  Camera,
  User,
  Lock,
  Globe,
  Save,
} from "lucide-react";
import { toast } from "sonner";

const TIMEZONES = [
  { value: "Pacific/Midway", label: "Midway Island (UTC-11)", offset: -11 },
  { value: "Pacific/Honolulu", label: "Hawaii (UTC-10)", offset: -10 },
  { value: "America/Anchorage", label: "Alaska (UTC-9)", offset: -9 },
  { value: "America/Los_Angeles", label: "Pacific Time (UTC-8)", offset: -8 },
  { value: "America/Phoenix", label: "Arizona (UTC-7)", offset: -7 },
  { value: "America/Denver", label: "Mountain Time (UTC-7)", offset: -7 },
  { value: "America/Chicago", label: "Central Time (UTC-6)", offset: -6 },
  { value: "America/New_York", label: "Eastern Time (UTC-5)", offset: -5 },
  { value: "America/Halifax", label: "Atlantic Time (UTC-4)", offset: -4 },
  { value: "America/Sao_Paulo", label: "Brasilia (UTC-3)", offset: -3 },
  { value: "Atlantic/South_Georgia", label: "Mid-Atlantic (UTC-2)", offset: -2 },
  { value: "Atlantic/Azores", label: "Azores (UTC-1)", offset: -1 },
  { value: "Europe/London", label: "London (UTC+0)", offset: 0 },
  { value: "Europe/Paris", label: "Paris (UTC+1)", offset: 1 },
  { value: "Europe/Berlin", label: "Berlin (UTC+1)", offset: 1 },
  { value: "Europe/Helsinki", label: "Helsinki (UTC+2)", offset: 2 },
  { value: "Europe/Moscow", label: "Moscow (UTC+3)", offset: 3 },
  { value: "Asia/Dubai", label: "Dubai (UTC+4)", offset: 4 },
  { value: "Asia/Karachi", label: "Karachi (UTC+5)", offset: 5 },
  { value: "Asia/Kolkata", label: "Mumbai (UTC+5:30)", offset: 5.5 },
  { value: "Asia/Dhaka", label: "Dhaka (UTC+6)", offset: 6 },
  { value: "Asia/Bangkok", label: "Bangkok (UTC+7)", offset: 7 },
  { value: "Asia/Singapore", label: "Singapore (UTC+8)", offset: 8 },
  { value: "Asia/Shanghai", label: "Shanghai (UTC+8)", offset: 8 },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+9)", offset: 9 },
  { value: "Australia/Sydney", label: "Sydney (UTC+10)", offset: 10 },
  { value: "Pacific/Auckland", label: "Auckland (UTC+12)", offset: 12 },
].sort((a, b) => a.offset - b.offset);

export default function CreatorSettingsPage() {
  const router = useRouter();
  const { branding } = useBranding();
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
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
        throw new Error("Failed to save profile");
      }

      // Update local storage
      localStorage.setItem("creatorName", name);

      toast.success("Profile saved successfully");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
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
        throw new Error(error.error || "Failed to change password");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      toast.success("Password changed successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2
            className="h-10 w-10 animate-spin mx-auto"
            style={{ color: branding.primaryColor }}
          />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile and preferences
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5" style={{ color: branding.primaryColor }} />
            Profile
          </CardTitle>
          <CardDescription>
            Your personal information and profile picture
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Picture */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar
                size="2xl"
                user={{
                  name: name,
                  email: email,
                  image: previewImage || avatar,
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full text-white flex items-center justify-center shadow-lg transition-colors"
                style={{ backgroundColor: branding.primaryColor }}
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
            <div>
              <p className="font-medium">Profile Photo</p>
              <p className="text-sm text-muted-foreground">
                Click the camera icon to upload a new photo
              </p>
            </div>
          </div>

          {/* Name & Email */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Contact your agency to change your email
              </p>
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <Button
            onClick={handleSaveProfile}
            disabled={saving}
            style={{ backgroundColor: branding.primaryColor }}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* Timezone */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-5 w-5" style={{ color: branding.primaryColor }} />
            Timezone
          </CardTitle>
          <CardDescription>
            Set your timezone for due date displays
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
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
          <Button
            onClick={handleSaveProfile}
            disabled={saving}
            className="mt-4"
            variant="outline"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Timezone
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-5 w-5" style={{ color: branding.primaryColor }} />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Password must be at least 8 characters long
          </p>
          <Button
            onClick={handleChangePassword}
            disabled={saving || !currentPassword || !newPassword}
            variant="outline"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Lock className="mr-2 h-4 w-4" />
            )}
            Change Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
