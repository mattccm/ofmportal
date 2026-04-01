"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { OnboardingWizard, type OnboardingStep } from "./onboarding-wizard";
import { useOnboarding } from "@/hooks/use-onboarding";
import {
  User,
  Camera,
  Bell,
  LayoutDashboard,
  Upload,
  Mail,
  MessageSquare,
  Smartphone,
  FileImage,
  FileVideo,
  Clock,
  Shield,
  Eye,
  CheckCircle2,
  Lightbulb,
  Folder,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface CreatorOnboardingProps {
  creatorName?: string;
  agencyName?: string;
  onComplete?: () => void;
  className?: string;
}

// ============================================
// HELPER TIP COMPONENT
// ============================================

function HelperTip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10",
        className
      )}
    >
      <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

// ============================================
// STEP 1: WELCOME + PROFILE SETUP
// ============================================

interface ProfileSetupStepProps {
  displayName: string;
  setDisplayName: (value: string) => void;
  bio: string;
  setBio: (value: string) => void;
  avatar: File | null;
  setAvatar: (file: File | null) => void;
  avatarPreview: string | null;
  agencyName?: string;
}

function ProfileSetupStep({
  displayName,
  setDisplayName,
  bio,
  setBio,
  avatar,
  setAvatar,
  avatarPreview,
  agencyName,
}: ProfileSetupStepProps) {
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatar(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center p-6 bg-gradient-to-br from-primary/5 to-violet-500/5 rounded-xl border border-primary/10">
        <h3 className="text-xl font-semibold mb-2">
          Welcome to Your Creator Portal!
        </h3>
        <p className="text-muted-foreground">
          {agencyName
            ? `${agencyName} has invited you to use this portal for content submissions.`
            : "You've been invited to use this portal for content submissions."}
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden bg-muted/50">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Camera className="w-8 h-8 text-muted-foreground/50" />
              )}
            </div>
            <label
              htmlFor="avatar-upload"
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors"
            >
              <Camera className="w-4 h-4" />
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Profile Photo</p>
            <p className="text-xs text-muted-foreground">
              Optional. This helps the agency team recognize you.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="display-name">Display Name</Label>
          <Input
            id="display-name"
            placeholder="How should we call you?"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Short Bio (Optional)</Label>
          <Input
            id="bio"
            placeholder="A brief description about yourself"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      <HelperTip>
        Setting up your profile helps build a professional relationship with your agency
        team and makes collaboration smoother.
      </HelperTip>
    </div>
  );
}

// ============================================
// STEP 2: UPLOAD PREFERENCES
// ============================================

interface UploadPreferencesStepProps {
  preferredFormats: string[];
  setPreferredFormats: (formats: string[]) => void;
  defaultFolder: string;
  setDefaultFolder: (folder: string) => void;
  autoOrganize: boolean;
  setAutoOrganize: (value: boolean) => void;
}

function UploadPreferencesStep({
  preferredFormats,
  setPreferredFormats,
  defaultFolder,
  setDefaultFolder,
  autoOrganize,
  setAutoOrganize,
}: UploadPreferencesStepProps) {
  const formatOptions = [
    { id: "photos", label: "Photos", icon: FileImage, formats: "JPG, PNG, HEIC" },
    { id: "videos", label: "Videos", icon: FileVideo, formats: "MP4, MOV, AVI" },
    { id: "both", label: "Both", icon: Camera, formats: "All media types" },
  ];

  const toggleFormat = (format: string) => {
    if (preferredFormats.includes(format)) {
      setPreferredFormats(preferredFormats.filter((f) => f !== format));
    } else {
      setPreferredFormats([...preferredFormats, format]);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Tell us about your content preferences so we can optimize your upload experience.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>What type of content do you usually create?</Label>
          <div className="grid grid-cols-3 gap-3">
            {formatOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setPreferredFormats([option.id]);
                }}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                  preferredFormats.includes(option.id)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <option.icon
                  className={cn(
                    "w-8 h-8",
                    preferredFormats.includes(option.id)
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                />
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.formats}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="default-folder">Default Upload Folder Name</Label>
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-muted-foreground" />
            <Input
              id="default-folder"
              placeholder="e.g., My Uploads"
              value={defaultFolder}
              onChange={(e) => setDefaultFolder(e.target.value)}
              className="h-10"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Your uploads will be organized in folders by request
          </p>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <Checkbox
            id="auto-organize"
            checked={autoOrganize}
            onCheckedChange={(checked) => setAutoOrganize(checked as boolean)}
          />
          <div className="flex-1">
            <label
              htmlFor="auto-organize"
              className="text-sm font-medium cursor-pointer"
            >
              Auto-organize by date
            </label>
            <p className="text-xs text-muted-foreground">
              Automatically create subfolders by upload date
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-muted/50 rounded-lg">
        <p className="text-sm font-medium mb-2 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Your content is secure
        </p>
        <p className="text-xs text-muted-foreground">
          All uploads are encrypted and stored securely. Only your agency team can access
          your submitted content.
        </p>
      </div>
    </div>
  );
}

// ============================================
// STEP 3: NOTIFICATION PREFERENCES
// ============================================

interface NotificationPreferencesStepProps {
  emailNotifications: boolean;
  setEmailNotifications: (value: boolean) => void;
  smsNotifications: boolean;
  setSmsNotifications: (value: boolean) => void;
  reminderDays: number;
  setReminderDays: (days: number) => void;
  notifyOnApproval: boolean;
  setNotifyOnApproval: (value: boolean) => void;
  notifyOnComment: boolean;
  setNotifyOnComment: (value: boolean) => void;
}

function NotificationPreferencesStep({
  emailNotifications,
  setEmailNotifications,
  smsNotifications,
  setSmsNotifications,
  reminderDays,
  setReminderDays,
  notifyOnApproval,
  setNotifyOnApproval,
  notifyOnComment,
  setNotifyOnComment,
}: NotificationPreferencesStepProps) {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Choose how you'd like to stay updated on new requests and feedback.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-base">Notification Channels</Label>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
              <Checkbox
                id="email-notif"
                checked={emailNotifications}
                onCheckedChange={(checked) =>
                  setEmailNotifications(checked as boolean)
                }
              />
              <div className="flex-1">
                <label
                  htmlFor="email-notif"
                  className="text-sm font-medium cursor-pointer flex items-center gap-2"
                >
                  <Mail className="w-4 h-4 text-blue-500" />
                  Email Notifications
                </label>
                <p className="text-xs text-muted-foreground">
                  Get notified via email for important updates
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
              <Checkbox
                id="sms-notif"
                checked={smsNotifications}
                onCheckedChange={(checked) =>
                  setSmsNotifications(checked as boolean)
                }
              />
              <div className="flex-1">
                <label
                  htmlFor="sms-notif"
                  className="text-sm font-medium cursor-pointer flex items-center gap-2"
                >
                  <Smartphone className="w-4 h-4 text-emerald-500" />
                  SMS Notifications
                </label>
                <p className="text-xs text-muted-foreground">
                  Get text messages for urgent deadlines
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-base">What should we notify you about?</Label>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <Checkbox
                id="notify-approval"
                checked={notifyOnApproval}
                onCheckedChange={(checked) =>
                  setNotifyOnApproval(checked as boolean)
                }
              />
              <label
                htmlFor="notify-approval"
                className="text-sm cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Content approvals & rejections
              </label>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <Checkbox
                id="notify-comment"
                checked={notifyOnComment}
                onCheckedChange={(checked) =>
                  setNotifyOnComment(checked as boolean)
                }
              />
              <label
                htmlFor="notify-comment"
                className="text-sm cursor-pointer flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4 text-blue-500" />
                New comments & feedback
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reminder-days" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Deadline Reminders
          </Label>
          <select
            id="reminder-days"
            value={reminderDays}
            onChange={(e) => setReminderDays(Number(e.target.value))}
            className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value={1}>1 day before deadline</option>
            <option value={2}>2 days before deadline</option>
            <option value={3}>3 days before deadline</option>
            <option value={7}>1 week before deadline</option>
          </select>
        </div>
      </div>

      <HelperTip>
        You can change these preferences anytime from your Settings page.
      </HelperTip>
    </div>
  );
}

// ============================================
// STEP 4: PORTAL TOUR
// ============================================

function PortalTourStep() {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Here's a quick overview of your creator portal. Let's explore what you can do!
      </p>

      <div className="space-y-4">
        <div className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
          <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Your Dashboard</h4>
            <p className="text-sm text-muted-foreground">
              See all active requests, upcoming deadlines, and recent activity in one place.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Upload className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Upload Content</h4>
            <p className="text-sm text-muted-foreground">
              Easily upload photos and videos for each request. Drag and drop or select files.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
          <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500">
            <Eye className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Track Status</h4>
            <p className="text-sm text-muted-foreground">
              See real-time status of your uploads - pending review, approved, or needs revision.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
          <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Communicate</h4>
            <p className="text-sm text-muted-foreground">
              Get feedback directly on your uploads and chat with your agency team.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-gradient-to-br from-primary/5 to-violet-500/5 rounded-lg border border-primary/10">
        <p className="text-sm font-medium mb-2">Ready to start?</p>
        <p className="text-sm text-muted-foreground">
          Click "Complete" to finish setup and start viewing your content requests!
        </p>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CreatorOnboarding({
  creatorName = "Creator",
  agencyName,
  onComplete,
  className,
}: CreatorOnboardingProps) {
  const router = useRouter();
  const { markStepComplete } = useOnboarding();

  // Step 1: Profile setup
  const [displayName, setDisplayName] = useState(creatorName);
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Step 2: Upload preferences
  const [preferredFormats, setPreferredFormats] = useState<string[]>(["both"]);
  const [defaultFolder, setDefaultFolder] = useState("");
  const [autoOrganize, setAutoOrganize] = useState(true);

  // Step 3: Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [reminderDays, setReminderDays] = useState(2);
  const [notifyOnApproval, setNotifyOnApproval] = useState(true);
  const [notifyOnComment, setNotifyOnComment] = useState(true);

  // Generate avatar preview
  React.useEffect(() => {
    if (avatar) {
      const url = URL.createObjectURL(avatar);
      setAvatarPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAvatarPreview(null);
    }
  }, [avatar]);

  const handleComplete = useCallback(async () => {
    // Mark onboarding as complete
    await markStepComplete("creator_onboarding_complete");

    // Call the provided callback
    onComplete?.();

    // Navigate to portal
    router.push("/portal");
  }, [markStepComplete, onComplete, router]);

  const handleStepComplete = useCallback(
    async (stepId: string) => {
      // Mark individual steps as complete
      await markStepComplete(stepId);
    },
    [markStepComplete]
  );

  const steps: OnboardingStep[] = [
    {
      id: "creator_profile",
      title: "Welcome",
      description: "Set up your profile",
      icon: <User className="w-5 h-5" />,
      content: (
        <ProfileSetupStep
          displayName={displayName}
          setDisplayName={setDisplayName}
          bio={bio}
          setBio={setBio}
          avatar={avatar}
          setAvatar={setAvatar}
          avatarPreview={avatarPreview}
          agencyName={agencyName}
        />
      ),
    },
    {
      id: "upload_preferences",
      title: "Uploads",
      description: "Set your upload preferences",
      icon: <Upload className="w-5 h-5" />,
      content: (
        <UploadPreferencesStep
          preferredFormats={preferredFormats}
          setPreferredFormats={setPreferredFormats}
          defaultFolder={defaultFolder}
          setDefaultFolder={setDefaultFolder}
          autoOrganize={autoOrganize}
          setAutoOrganize={setAutoOrganize}
        />
      ),
    },
    {
      id: "notification_preferences",
      title: "Notifications",
      description: "Choose how to stay updated",
      icon: <Bell className="w-5 h-5" />,
      content: (
        <NotificationPreferencesStep
          emailNotifications={emailNotifications}
          setEmailNotifications={setEmailNotifications}
          smsNotifications={smsNotifications}
          setSmsNotifications={setSmsNotifications}
          reminderDays={reminderDays}
          setReminderDays={setReminderDays}
          notifyOnApproval={notifyOnApproval}
          setNotifyOnApproval={setNotifyOnApproval}
          notifyOnComment={notifyOnComment}
          setNotifyOnComment={setNotifyOnComment}
        />
      ),
    },
    {
      id: "portal_tour",
      title: "Quick Tour",
      description: "Learn the basics",
      icon: <LayoutDashboard className="w-5 h-5" />,
      content: <PortalTourStep />,
    },
  ];

  return (
    <div className={cn("min-h-screen flex items-center justify-center p-4", className)}>
      <OnboardingWizard
        steps={steps}
        title={`Welcome, ${creatorName}!`}
        subtitle="Let's personalize your creator portal experience"
        onComplete={handleComplete}
        onStepComplete={handleStepComplete}
        allowSkip={true}
        showProgress={true}
      />
    </div>
  );
}

export default CreatorOnboarding;
