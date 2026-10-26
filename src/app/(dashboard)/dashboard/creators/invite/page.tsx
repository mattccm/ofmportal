"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Mail, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHead, Panel } from "@/components/creators/people-ui";
import { InviteLinkBox } from "@/components/invites/invite-link";
import {
  OnboardingBundleSelector,
  PostInviteBundleApply,
} from "@/components/bundles/onboarding-bundle-selector";
import { useAccess } from "@/lib/access/client";
import { NoAccess } from "@/components/access/no-access";

const EMPTY = {
  name: "",
  email: "",
  phone: "",
  preferredContact: "EMAIL",
  notes: "",
};

interface Invited {
  creatorId: string | null;
  name: string;
  email: string;
  link: string;
  expiresAt: string | null;
  /** The person asked for an email */
  emailWanted: boolean;
  /** The email actually went out */
  emailed: boolean;
  /** False when the role sees only chosen creators (an admin adds them) */
  visibleToYou: boolean;
}

export default function InviteCreatorPage() {
  const { can, roleName, creatorScope } = useAccess();
  if (!can("creators.invite")) return <NoAccess what="inviting creators" roleName={roleName} />;
  return (
    <InviteCreatorForm
      see={{
        phone: can("creatorInfo.phone"),
        preferences: can("creatorInfo.preferences"),
        notes: can("creatorInfo.notes"),
      }}
      canBundle={can("bundles.run")}
      creatorScope={creatorScope}
    />
  );
}

interface GroupOption {
  id: string;
  name: string;
  inScope?: boolean;
}

/** Details this role can't see are not asked for (the server ignores them too) */
function InviteCreatorForm({
  see,
  canBundle,
  creatorScope,
}: {
  see: { phone: boolean; preferences: boolean; notes: boolean };
  canBundle: boolean;
  /** "groups": the new creator must go in one of the role's groups to stay visible */
  creatorScope: "all" | "groups" | "creators";
}) {
  const needsGroup = creatorScope === "groups";
  const [groups, setGroups] = useState<GroupOption[] | null>(null);
  const [groupId, setGroupId] = useState("");
  useEffect(() => {
    if (!needsGroup) return;
    fetch("/api/creators/groups")
      .then((r) => (r.ok ? r.json() : []))
      .then((all: GroupOption[]) => {
        const mine = all.filter((g) => g.inScope);
        setGroups(mine);
        if (mine.length === 1) setGroupId(mine[0].id);
      })
      .catch(() => setGroups([]));
  }, [needsGroup]);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [invited, setInvited] = useState<Invited | null>(null);
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [sendEmail, setSendEmail] = useState(true);
  const [formData, setFormData] = useState(EMPTY);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, sendInvite: sendEmail, ...(groupId ? { groupId } : {}) }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "The creator could not be invited");
        return;
      }

      setInvited({
        creatorId: data.creator?.id || null,
        name: formData.name.trim(),
        email: formData.email.trim(),
        link: data.inviteLink,
        expiresAt: data.inviteExpiresAt ?? null,
        emailWanted: sendEmail,
        emailed: !!data.emailed,
        visibleToYou: data.visibleToYou !== false,
      });
      toast.success(sendEmail && data.emailed ? "Invite emailed" : "Invite link ready");
    } catch {
      toast.error("The creator could not be invited. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const back = { href: "/dashboard/creators", label: "Creators" };

  if (invited) {
    const first = invited.name.split(/\s+/)[0] || invited.name;
    const line = invited.emailed
      ? `We emailed the invite to ${invited.email}. You can also send ${first} this link yourself.`
      : invited.emailWanted
        ? `The invite email could not be sent. Send ${first} this link yourself instead.`
        : `No email was sent. Send ${first} this link yourself, by text or any chat app.`;

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHead back={back} title={`${invited.name} is invited`} lede={line} />

        <Panel className="space-y-5">
          <InviteLinkBox link={invited.link} expiresAt={invited.expiresAt} primary />

          {!invited.visibleToYou && (
            <p className="text-sm text-ink-2">
              Your role sees only chosen creators, so {first} won&apos;t appear in your lists until an admin adds them to
              your role.
            </p>
          )}

          {invited.creatorId && selectedBundleId && (
            <PostInviteBundleApply
              creatorId={invited.creatorId}
              creatorName={invited.name}
              bundleId={selectedBundleId}
            />
          )}

          <div className="flex flex-col gap-2 border-t border-line pt-5 sm:flex-row">
            {invited.creatorId && invited.visibleToYou && (
              <Button asChild variant="outline">
                <Link href={`/dashboard/creators/${invited.creatorId}`}>Open {first}&apos;s profile</Link>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setInvited(null);
                setSelectedBundleId(null);
                setSendEmail(true);
                setFormData(EMPTY);
                setGroupId(groups?.length === 1 ? groups[0].id : "");
              }}
            >
              Invite another creator
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  const emailLabel = formData.email.trim() ? `Email the invite to ${formData.email.trim()}` : "Email the invite to them";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHead
        back={back}
        title="Invite creator"
        lede="Add their details. We can email the invite, and you always get a link you can send them yourself."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Panel className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                autoComplete="off"
                placeholder="Their name or stage name"
                value={formData.name}
                onChange={handleChange}
                required
                minLength={2}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="off"
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
          </div>

          {(see.phone || see.preferences) && (
          <div className="grid gap-4 md:grid-cols-2">
            {see.phone && (
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="off"
                placeholder="+61 400 000 000"
                value={formData.phone}
                onChange={handleChange}
                disabled={loading}
                aria-describedby="phone-hint"
              />
              <p id="phone-hint" className="text-[13px] text-ink-2">
                With the country code. Needed for SMS reminders
              </p>
            </div>
            )}
            {see.preferences && (
            <div className="space-y-2">
              <Label htmlFor="preferredContact">Preferred contact</Label>
              <Select
                value={formData.preferredContact}
                onValueChange={(value) => setFormData({ ...formData, preferredContact: value })}
              >
                <SelectTrigger id="preferredContact" disabled={loading}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="BOTH">Email and SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            )}
          </div>
          )}

          {needsGroup && (
            <div className="space-y-2">
              <Label htmlFor="group">Group</Label>
              {groups && groups.length === 0 ? (
                <p id="group" className="text-sm text-ink-2">
                  Your role sees creators in chosen groups, and none is chosen yet. Ask an admin to add a group to your role.
                </p>
              ) : (
                <>
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger id="group" disabled={loading || !groups} aria-describedby="group-hint">
                      <SelectValue placeholder={groups ? "Choose a group" : "Loading groups…"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(groups ?? []).map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p id="group-hint" className="text-[13px] text-ink-2">
                    Your role sees creators in your groups, so they go in one of them.
                  </p>
                </>
              )}
            </div>
          )}

          {creatorScope === "creators" && (
            <p className="text-[13px] text-ink-2">
              Your role sees only chosen creators. After you add this creator, an admin adds them to your role before
              they show in your lists.
            </p>
          )}

          {see.notes && (
          <div className="space-y-2">
            <Label htmlFor="notes">Notes for the team (optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Only your team sees these"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              disabled={loading}
            />
          </div>
          )}

          {canBundle && (
            <div className="border-t border-line pt-5 empty:hidden">
              <OnboardingBundleSelector
                selectedBundleId={selectedBundleId}
                onBundleSelect={setSelectedBundleId}
                disabled={loading}
              />
            </div>
          )}
        </Panel>

        <Panel className="space-y-4">
          <h2 className="text-[17px] font-semibold leading-snug text-ink">How they get the invite</h2>
          <label className="flex cursor-pointer items-start gap-3 rounded-[8px] bg-well p-3.5">
            <Checkbox
              checked={sendEmail}
              onCheckedChange={(v) => setSendEmail(v === true)}
              disabled={loading}
              aria-label={emailLabel}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block break-words text-[15px] font-medium text-ink">{emailLabel}</span>
              <span className="mt-0.5 block text-[13px] text-ink-2">
                {sendEmail
                  ? "They get an email with a button to set up their account."
                  : "No email goes out. You share the link yourself, by text or any chat app."}
              </span>
            </span>
          </label>
          <p className="flex items-start gap-2 text-[13px] text-ink-2">
            <Link2 className="mt-0.5 size-4 shrink-0 text-icon" aria-hidden="true" />
            Either way you get an invite link to copy on the next screen. It works once and expires in 7 days.
          </p>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row">
            <Button type="submit" disabled={loading || (needsGroup && !groupId)}>
              {loading ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : sendEmail ? (
                <Mail aria-hidden="true" />
              ) : (
                <Link2 aria-hidden="true" />
              )}
              {loading ? "Inviting…" : sendEmail ? "Send invite" : "Create invite link"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
              Cancel
            </Button>
          </div>
        </Panel>
      </form>
    </div>
  );
}
