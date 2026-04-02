"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  User,
  Mail,
  Phone,
  Globe,
  Key,
  Camera,
  Clock,
  AlertCircle,
  Send,
  Shield,
  Settings,
  RefreshCw,
} from "lucide-react";

// Timezone options
const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "UTC", label: "UTC" },
];

const CONTACT_METHODS = [
  { value: "EMAIL", label: "Email Only" },
  { value: "SMS", label: "SMS Only" },
  { value: "BOTH", label: "Email & SMS" },
];

interface Creator {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  timezone: string;
  preferredContact: string;
  inviteStatus: string;
  notes: string | null;
}

interface EditCreatorProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: Creator;
  onUpdate: (updatedCreator: Partial<Creator>) => void;
  currentUserRole: string;
}

export function EditCreatorProfileModal({
  open,
  onOpenChange,
  creator,
  onUpdate,
  currentUserRole,
}: EditCreatorProfileModalProps) {
  const [activeTab, setActiveTab] = useState("profile");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: creator.name,
    email: creator.email,
    phone: creator.phone || "",
    timezone: creator.timezone || "UTC",
    preferredContact: creator.preferredContact || "EMAIL",
    notes: creator.notes || "",
    avatar: creator.avatar || "",
  });

  // Check if user has admin permissions
  const canEdit = ["OWNER", "ADMIN", "MANAGER"].includes(currentUserRole);
  const canSendPasswordReset = ["OWNER", "ADMIN"].includes(currentUserRole);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!canEdit) {
      toast.error("You don't have permission to edit creator profiles");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/creators/${creator.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          timezone: formData.timezone,
          preferredContact: formData.preferredContact,
          notes: formData.notes || null,
          avatar: formData.avatar || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update profile");
      }

      const updated = await response.json();
      onUpdate(updated.creator);
      toast.success("Creator profile updated successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!canSendPasswordReset) {
      toast.error("You don't have permission to send password reset links");
      return;
    }

    setIsSendingReset(true);
    try {
      const response = await fetch(`/api/creators/${creator.id}/reset-password`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send password reset");
      }

      toast.success("Password reset link sent to creator's email");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send password reset");
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleResendInvite = async () => {
    try {
      const response = await fetch(`/api/creators/${creator.id}/resend-invite`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to resend invite");
      }

      toast.success("Invitation resent successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend invite");
    }
  };

  const handleAvatarChange = (url: string) => {
    handleInputChange("avatar", url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Edit Creator Profile
          </DialogTitle>
          <DialogDescription>
            Update the creator's profile information, contact details, and settings.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="contact" className="flex items-center gap-1.5">
              <Mail className="h-4 w-4" />
              Contact
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-1.5">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6 pt-4">
            {/* Avatar */}
            <div className="flex items-start gap-6">
              <AvatarUpload
                user={{ name: formData.name, image: formData.avatar }}
                currentAvatarUrl={formData.avatar}
                onUpload={async (dataUrl) => {
                  handleInputChange("avatar", dataUrl);
                }}
                onRemove={async () => {
                  handleInputChange("avatar", "");
                }}
                size="xl"
              />
              <div className="flex-1 space-y-2 pt-2">
                <Label>Profile Picture URL</Label>
                <Input
                  placeholder="Or paste an image URL directly"
                  value={formData.avatar}
                  onChange={(e) => handleInputChange("avatar", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Click the avatar to upload, or paste an image URL above
                </p>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Creator's full name"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Internal Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Private notes about this creator (not visible to them)"
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                These notes are only visible to your team, not the creator.
              </p>
            </div>

            {/* Invite Status */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Portal Access Status</Label>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      creator.inviteStatus === "ACCEPTED"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : creator.inviteStatus === "PENDING"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-gray-50 text-gray-600 border-gray-200"
                    )}
                  >
                    {creator.inviteStatus === "ACCEPTED"
                      ? "Active"
                      : creator.inviteStatus === "PENDING"
                      ? "Invite Pending"
                      : "Inactive"}
                  </Badge>
                </div>
              </div>
              {creator.inviteStatus === "PENDING" && (
                <Button variant="outline" size="sm" onClick={handleResendInvite}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Resend Invite
                </Button>
              )}
            </div>
          </TabsContent>

          {/* Contact Tab */}
          <TabsContent value="contact" className="space-y-6 pt-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="creator@example.com"
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This email is used for portal login and notifications.
              </p>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Used for SMS notifications if enabled.
              </p>
            </div>

            {/* Timezone */}
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => handleInputChange("timezone", value)}
              >
                <SelectTrigger id="timezone" className="w-full">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Select timezone" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used for scheduling and displaying times correctly.
              </p>
            </div>

            {/* Preferred Contact Method */}
            <div className="space-y-2">
              <Label htmlFor="preferredContact">Preferred Contact Method</Label>
              <Select
                value={formData.preferredContact}
                onValueChange={(value) => handleInputChange("preferredContact", value)}
              >
                <SelectTrigger id="preferredContact" className="w-full">
                  <SelectValue placeholder="Select contact method" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6 pt-4">
            {/* Password Reset */}
            <div className="p-4 rounded-lg border space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Key className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <h4 className="font-medium">Password Reset</h4>
                  <p className="text-sm text-muted-foreground">
                    Send a password reset link to the creator's email address. They can use this to set a new password for their portal access.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleSendPasswordReset}
                disabled={isSendingReset || !canSendPasswordReset}
                className="w-full sm:w-auto"
              >
                {isSendingReset ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Password Reset Link
                  </>
                )}
              </Button>
              {!canSendPasswordReset && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Only Owners and Admins can send password reset links.
                </p>
              )}
            </div>

            {/* Account Status */}
            <div className="p-4 rounded-lg border space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <h4 className="font-medium">Account Security</h4>
                  <p className="text-sm text-muted-foreground">
                    Manage the creator's account access and security settings.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Portal Status:</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "ml-2",
                      creator.inviteStatus === "ACCEPTED"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    )}
                  >
                    {creator.inviteStatus === "ACCEPTED" ? "Active" : "Pending"}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <span className="ml-2 font-mono text-xs">{creator.email}</span>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1 space-y-1">
                  <h4 className="font-medium text-destructive">Danger Zone</h4>
                  <p className="text-sm text-muted-foreground">
                    Deactivate or delete this creator's portal access. This action requires Owner permissions.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                disabled={currentUserRole !== "OWNER"}
              >
                Deactivate Portal Access
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !canEdit}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
