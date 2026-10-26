"use client";

import { useState } from "react";
import { TimezoneSelector } from "@/components/settings/timezone-selector";
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
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAccess } from "@/lib/access/client";
import {
  User,
  Mail,
  Phone,
  Key,
  AlertCircle,
  Send,
  Shield,
  RefreshCw,
} from "lucide-react";


const CONTACT_METHODS = [
  { value: "EMAIL", label: "Email Only" },
  { value: "SMS", label: "SMS Only" },
  { value: "BOTH", label: "Email & SMS" },
];

// Fields the viewer's role can't see arrive as null and are neither shown nor sent back
interface Creator {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  timezone: string | null;
  preferredContact: string | null;
  inviteStatus: string;
  notes: string | null;
}

interface EditCreatorProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: Creator;
  onUpdate: (updatedCreator: Partial<Creator>) => void;
  /** No longer read: permissions come from the role (useAccess) */
  currentUserRole?: string;
}

export function EditCreatorProfileModal({
  open,
  onOpenChange,
  creator,
  onUpdate,
}: EditCreatorProfileModalProps) {
  const { can, canAny, isOwner } = useAccess();
  const see = {
    email: can("creatorInfo.email"),
    phone: can("creatorInfo.phone"),
    notes: can("creatorInfo.notes"),
    location: can("creatorInfo.location"),
    preferences: can("creatorInfo.preferences"),
    invite: can("creatorInfo.invite"),
  };
  const showContactTab = see.email || see.phone || see.location || see.preferences;
  const [activeTab, setActiveTab] = useState("profile");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: creator.name,
    email: creator.email ?? "",
    phone: creator.phone || "",
    timezone: creator.timezone || "UTC",
    preferredContact: creator.preferredContact || "EMAIL",
    notes: creator.notes || "",
    avatar: creator.avatar || "",
  });

  // What this person's role allows (the server checks every one of these too)
  const canEdit = can("creators.edit");
  const canSendPasswordReset = can("creators.resetAccess");
  const canResendInvite = canAny(["creators.invite", "creators.resetAccess"]);

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
        // Only the details this role can see are sent
        body: JSON.stringify({
          name: formData.name,
          ...(see.email ? { email: formData.email } : {}),
          ...(see.phone ? { phone: formData.phone || null } : {}),
          ...(see.location ? { timezone: formData.timezone } : {}),
          ...(see.preferences ? { preferredContact: formData.preferredContact } : {}),
          ...(see.notes ? { notes: formData.notes || null } : {}),
          avatar: formData.avatar || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update profile");
      }

      const updated = await response.json();

      // Apply cache-busting to avatar URL if it was changed and isn't a data URL
      if (updated.creator.avatar &&
          updated.creator.avatar !== creator.avatar &&
          !updated.creator.avatar.startsWith("data:")) {
        updated.creator.avatar = `${updated.creator.avatar}${updated.creator.avatar.includes("?") ? "&" : "?"}t=${Date.now()}`;
      }

      onUpdate(updated.creator);
      toast.success("Profile updated");
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

      toast.success("Invite resent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend invite");
    }
  };

  // Upload avatar to dedicated API endpoint for S3 storage
  const handleAvatarUpload = async (dataUrl: string) => {
    try {
      const response = await fetch(`/api/creators/${creator.id}/avatar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload avatar");
      }

      const data = await response.json();
      // Use the URL from S3/API response with cache-busting
      const cacheBustedUrl = data.url.startsWith("data:")
        ? data.url
        : `${data.url}${data.url.includes("?") ? "&" : "?"}t=${Date.now()}`;
      handleInputChange("avatar", cacheBustedUrl);
      toast.success("New avatar saved");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload avatar");
      throw error;
    }
  };

  const handleAvatarRemove = async () => {
    try {
      const response = await fetch(`/api/creators/${creator.id}/avatar`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove avatar");
      }

      handleInputChange("avatar", "");
      toast.success("Avatar removed");
    } catch (error) {
      console.error("Error removing avatar:", error);
      toast.error(error instanceof Error ? error.message : "Failed to remove avatar");
      throw error;
    }
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
            Update the creator&apos;s profile information, contact details, and settings.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className={cn("grid w-full", showContactTab ? "grid-cols-3" : "grid-cols-2")}>
            <TabsTrigger value="profile" className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            {showContactTab && (
              <TabsTrigger value="contact" className="flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                Contact
              </TabsTrigger>
            )}
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
                onUpload={handleAvatarUpload}
                onRemove={handleAvatarRemove}
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
            {see.notes && (
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
            )}

            {/* Invite Status */}
            {see.invite && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Portal Access Status</Label>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      creator.inviteStatus === "ACCEPTED"
                        ? "bg-success/10 text-success border-success/30"
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
              {creator.inviteStatus === "PENDING" && canResendInvite && (
                <Button variant="outline" size="sm" onClick={handleResendInvite}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Resend Invite
                </Button>
              )}
            </div>
            )}
          </TabsContent>

          {/* Contact Tab */}
          <TabsContent value="contact" className="space-y-6 pt-4">
            {/* Email */}
            {see.email && (
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
            )}

            {/* Phone */}
            {see.phone && (
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
            )}

            {/* Timezone */}
            {see.location && (
            <div className="space-y-2">
              <TimezoneSelector
                value={formData.timezone}
                onChange={(value) => handleInputChange("timezone", value)}
                showCurrentTime
                label="Time zone"
                description="Due dates end at 11:59 pm here. Changing it keeps every open request on the same due date."
              />
            </div>
            )}

            {/* Preferred Contact Method */}
            {see.preferences && (
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
            )}
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6 pt-4">
            {/* Password Reset */}
            {canSendPasswordReset && (
            <div className="p-4 rounded-lg border space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Key className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <h4 className="font-medium">Password Reset</h4>
                  <p className="text-sm text-muted-foreground">
                    Send a password reset link to the creator&apos;s email address. They can use this to set a new password for their portal access.
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
            </div>
            )}

            {/* Account Status */}
            <div className="p-4 rounded-lg border space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <h4 className="font-medium">Account Security</h4>
                  <p className="text-sm text-muted-foreground">
                    Manage the creator&apos;s account access and security settings.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {see.invite && (
                <div>
                  <span className="text-muted-foreground">Portal Status:</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "ml-2",
                      creator.inviteStatus === "ACCEPTED"
                        ? "bg-success/10 text-success"
                        : "bg-amber-50 text-amber-700"
                    )}
                  >
                    {creator.inviteStatus === "ACCEPTED" ? "Active" : "Pending"}
                  </Badge>
                </div>
                )}
                {see.email && (
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <span className="ml-2 font-mono text-xs">{creator.email}</span>
                </div>
                )}
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
                    Deactivate or delete this creator&apos;s portal access. This action requires Owner permissions.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                disabled={!isOwner}
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
