"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyButton } from "@/components/ui/copy-button";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  OnboardingBundleSelector,
  PostInviteBundleApply,
} from "@/components/bundles/onboarding-bundle-selector";

export default function InviteCreatorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [createdCreatorId, setCreatedCreatorId] = useState<string | null>(null);
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    preferredContact: "EMAIL",
    notes: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to invite creator");
        setLoading(false);
        return;
      }

      setInviteLink(data.inviteLink);
      setCreatedCreatorId(data.creator?.id || null);
      toast.success("Creator invited successfully!");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (inviteLink) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Creator Invited!</CardTitle>
            <CardDescription>
              An invitation email has been sent to {formData.email}. You can also share
              this link directly:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input value={inviteLink} readOnly className="font-mono text-sm" />
              <CopyButton
                value={inviteLink}
                variant="outline"
                onCopySuccess={() => toast.success("Link copied to clipboard!")}
              />
            </div>
            <p className="text-sm text-gray-500">
              This link will expire in 7 days. The creator can use it to set up their
              portal access and start uploading content.
            </p>

            {/* Post-Invite Bundle Apply */}
            {createdCreatorId && selectedBundleId && (
              <PostInviteBundleApply
                creatorId={createdCreatorId}
                creatorName={formData.name}
                bundleId={selectedBundleId}
              />
            )}

            <div className="flex gap-2">
              <Button onClick={() => router.push("/dashboard/creators")}>
                View All Creators
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setInviteLink(null);
                  setCreatedCreatorId(null);
                  setFormData({
                    name: "",
                    email: "",
                    phone: "",
                    preferredContact: "EMAIL",
                    notes: "",
                  });
                }}
              >
                Invite Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/creators">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invite Creator</h1>
          <p className="mt-1 text-gray-500">
            Add a new creator to your agency
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Creator Details</CardTitle>
          <CardDescription>
            Enter the creator&apos;s information. They&apos;ll receive an email invitation
            to set up their portal access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Creator's name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="creator@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={loading}
                />
                <p className="text-xs text-gray-500">
                  Required for SMS reminders
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredContact">Preferred Contact Method</Label>
                <Select
                  value={formData.preferredContact}
                  onValueChange={(value) =>
                    setFormData({ ...formData, preferredContact: value })
                  }
                >
                  <SelectTrigger disabled={loading}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                    <SelectItem value="BOTH">Email & SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Internal Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Any notes about this creator (only visible to your team)"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                disabled={loading}
              />
            </div>

            {/* Onboarding Bundle Selector */}
            <div className="pt-4 border-t">
              <OnboardingBundleSelector
                selectedBundleId={selectedBundleId}
                onBundleSelect={setSelectedBundleId}
                disabled={loading}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invitation
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
