"use client";

import * as React from "react";
import { Ban, Link2, Loader2, Mail, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InviteConfirmDialog, InviteLinkBox, InviteLinkDialog } from "@/components/invites/invite-link";
import { Pill } from "@/components/creators/people-ui";
import { formatDay } from "@/components/title-wall";
import type { StaffInviteRow } from "@/lib/staff-invites";

/** A role the inviter may hand out (never owner; never more access than their own unless they manage roles) */
type InviteRole = { id: string; name: string; kind: "owner" | "preset" | "custom"; description: string | null };

/**
 * "Invite teammate": pick a role (never owner), optionally a name and email,
 * then copy the link and/or email it. The link is shown once, here; tokens
 * are stored hashed, so afterwards it can only be replaced.
 */
export function InviteTeammateDialog({
  open,
  onOpenChange,
  roles,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: InviteRole[];
  onCreated: (invite: StaffInviteRow) => void;
}) {
  const defaultRole = roles.find((r) => r.id === "member")?.id ?? roles[roles.length - 1]?.id ?? "";
  const [role, setRole] = React.useState<string>(defaultRole);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [sendEmail, setSendEmail] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [made, setMade] = React.useState<{ link: string; expiresAt: string; emailed: boolean; emailWanted: boolean; to: string | null } | null>(null);

  const reset = () => {
    setRole(defaultRole);
    setName("");
    setEmail("");
    setSendEmail(false);
    setError(null);
    setMade(null);
  };

  const hasEmail = email.trim().length > 0;
  const description = roles.find((r) => r.id === role)?.description;
  const builtIn = roles.filter((r) => r.kind !== "custom");
  const custom = roles.filter((r) => r.kind === "custom");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: role,
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          sendEmail: sendEmail && hasEmail,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "The invite could not be made. Try again.");
        return;
      }
      onCreated(data.invite);
      setMade({
        link: data.link,
        expiresAt: data.invite.expiresAt,
        emailed: !!data.emailed,
        emailWanted: sendEmail && hasEmail,
        to: data.invite.email,
      });
    } catch {
      setError("The invite could not be made. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        onOpenChange(o);
        if (!o) setTimeout(reset, 200);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {made ? (
          <>
            <DialogHeader>
              <DialogTitle>Invite ready</DialogTitle>
              <DialogDescription className="text-ink-2">
                {made.emailed
                  ? `We emailed the invite to ${made.to}. You can also send them this link yourself.`
                  : made.emailWanted
                    ? "The invite email could not be sent. Send them this link yourself instead."
                    : "Send this link to your teammate yourself, by email, text or any chat app."}
              </DialogDescription>
            </DialogHeader>
            <InviteLinkBox link={made.link} expiresAt={made.expiresAt} primary />
            <p className="text-[13px] text-ink-2">
              Copy it now: for safety the link isn&apos;t shown again. You can always make a new one from the invite list.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                Invite someone else
              </Button>
              <DialogClose asChild>
                <Button variant="outline">Done</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Invite teammate</DialogTitle>
              <DialogDescription className="text-ink-2">
                You get a link to send them. They choose their own password when they open it.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <p role="alert" className="rounded-[8px] border border-late/35 bg-late/10 p-3 text-sm text-ink">
                {error}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="invite-role" aria-describedby="invite-role-hint">
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  {builtIn.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Built-in roles</SelectLabel>
                      {builtIn.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {custom.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Your roles</SelectLabel>
                      {custom.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              <p id="invite-role-hint" className="text-[13px] text-ink-2">
                {description || "Owners can't be invited. Make someone an owner after they join."} Only roles with no more access than yours are listed.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invite-name">Name (optional)</Label>
                <Input id="invite-name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email (optional)</Label>
                <Input
                  id="invite-email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (!e.target.value.trim()) setSendEmail(false);
                  }}
                  disabled={busy}
                  aria-describedby="invite-email-hint"
                />
              </div>
            </div>
            <p id="invite-email-hint" className="-mt-2 text-[13px] text-ink-2">
              With an email, only that address can use the invite.
            </p>

            <label className="flex cursor-pointer items-start gap-3 rounded-[8px] bg-well p-3.5 has-[[data-disabled]]:cursor-not-allowed">
              <Checkbox
                checked={sendEmail && hasEmail}
                onCheckedChange={(v) => setSendEmail(v === true)}
                disabled={busy || !hasEmail}
                aria-label="Email the invite to them"
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className={`block text-[15px] font-medium ${hasEmail ? "text-ink" : "text-ink-2"}`}>Email the invite to them</span>
                <span className="mt-0.5 block text-[13px] text-ink-2">
                  {hasEmail ? "Either way you also get the link to copy." : "Add their email to send it. You always get the link to copy."}
                </span>
              </span>
            </label>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={busy}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : sendEmail && hasEmail ? <Mail aria-hidden="true" /> : <Link2 aria-hidden="true" />}
                {sendEmail && hasEmail ? "Send invite" : "Create invite link"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Open invites on the Team page: who, which role, until when, and New link / Resend email / Cancel. */
export function PendingInvites({
  invites,
  onChange,
  onInvite,
}: {
  invites: StaffInviteRow[];
  onChange: (next: StaffInviteRow[]) => void;
  onInvite: () => void;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [shown, setShown] = React.useState<{ title: string; description: string; link: string; expiresAt: string } | null>(null);
  const [confirm, setConfirm] = React.useState<{ kind: "rotate" | "cancel"; invite: StaffInviteRow } | null>(null);

  const label = (i: StaffInviteRow) => i.name || i.email || "Anyone with the link";

  const replace = (row: StaffInviteRow) => onChange(invites.map((i) => (i.id === row.id ? row : i)));

  const act = async (invite: StaffInviteRow, action: "rotate" | "email") => {
    setBusy(`${invite.id}:${action}`);
    try {
      const res = await fetch(`/api/team/invites/${invite.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.link) {
          setShown({ title: `New invite link for ${label(invite)}`, description: data.error, link: data.link, expiresAt: invite.expiresAt });
          return;
        }
        throw new Error(data?.error || "The invite could not be updated");
      }
      replace(data.invite);
      setConfirm(null);
      if (action === "email") {
        toast.success(`Invite emailed to ${invite.email}`, { description: "Earlier links to this invite no longer work." });
      } else {
        setShown({
          title: `New invite link for ${label(invite)}`,
          description: "Any earlier link for this invite has stopped working. Send this one instead.",
          link: data.link,
          expiresAt: data.invite.expiresAt,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The invite could not be updated");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (invite: StaffInviteRow) => {
    setBusy(`${invite.id}:cancel`);
    try {
      const res = await fetch(`/api/team/invites/${invite.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "The invite could not be cancelled");
      onChange(invites.filter((i) => i.id !== invite.id));
      setConfirm(null);
      toast.success(`Invite for ${label(invite)} cancelled. The link no longer works.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The invite could not be cancelled");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="pending-invites-h" className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="pending-invites-h" className="text-[17px] font-semibold leading-snug text-ink">
          Invites waiting
        </h2>
        <span className="text-sm text-ink-2">
          {invites.length === 0
            ? "None right now."
            : `${invites.length} not accepted yet. Links work once, for 7 days.`}
        </span>
      </div>

      {invites.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-ctl px-4 py-4 text-sm text-ink-2">
          Nobody is waiting to join.{" "}
          <button
            type="button"
            onClick={onInvite}
            className="font-medium text-ink underline decoration-ctl-hi underline-offset-[3px] hover:decoration-ink"
          >
            Invite a teammate
          </button>{" "}
          to get a link you can send them.
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-[10px] bg-tile">
          {invites.map((i) => {
            const expired = i.state === "expired";
            return (
              <li key={i.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[15px] font-semibold text-ink">{label(i)}</span>
                    <Pill tone="neutral">{i.roleLabel}</Pill>
                    {expired && <Pill tone="quiet">Link expired</Pill>}
                  </div>
                  <p className="mt-1 text-[13px] text-ink-2" suppressHydrationWarning>
                    {[
                      i.name && i.email ? i.email : null,
                      expired ? `Expired ${formatDay(i.expiresAt)}` : `Link works until ${formatDay(i.expiresAt)}`,
                      i.emailSentAt ? `emailed ${formatDay(i.emailSentAt)}` : "not emailed",
                      i.invitedBy ? `invited by ${i.invitedBy}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!!busy}
                    onClick={() => (expired ? act(i, "rotate") : setConfirm({ kind: "rotate", invite: i }))}
                  >
                    {busy === `${i.id}:rotate` ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Link2 aria-hidden="true" />}
                    New link
                  </Button>
                  {i.email && (
                    <Button variant="outline" size="sm" disabled={!!busy} onClick={() => act(i, "email")}>
                      {busy === `${i.id}:email` ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Mail aria-hidden="true" />}
                      Resend email
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!!busy}
                    onClick={() => setConfirm({ kind: "cancel", invite: i })}
                    aria-label={`Cancel the invite for ${label(i)}`}
                    className="text-ink-2 hover:text-ink"
                  >
                    <Ban aria-hidden="true" />
                    Cancel
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <InviteLinkDialog
        open={!!shown}
        onOpenChange={(o) => !o && setShown(null)}
        title={shown?.title ?? "Invite link"}
        description={shown?.description}
        link={shown?.link ?? null}
        expiresAt={shown?.expiresAt}
      />
      <InviteConfirmDialog
        open={confirm?.kind === "rotate"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Make a new invite link?"
        description="Any link you already sent for this invite stops working straight away. You'll get a new link to copy, good for 7 days."
        confirmLabel="Make a new link"
        onConfirm={() => (confirm ? act(confirm.invite, "rotate") : undefined)}
      />
      <InviteConfirmDialog
        open={confirm?.kind === "cancel"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? `Cancel the invite for ${label(confirm.invite)}?` : "Cancel the invite?"}
        description="The invite link stops working straight away. You can invite them again later."
        confirmLabel="Cancel invite"
        destructive
        onConfirm={() => (confirm ? cancel(confirm.invite) : undefined)}
      />
    </section>
  );
}

export function InviteTeammateButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="light" onClick={onClick}>
      <Plus aria-hidden="true" />
      Invite teammate
    </Button>
  );
}
