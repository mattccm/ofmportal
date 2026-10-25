"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Copy, Link2, Loader2, MoreHorizontal, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InviteConfirmDialog, InviteLinkDialog, inviteNote, writeClipboard } from "@/components/invites/invite-link";
import { cn } from "@/lib/utils";

export type CreatorInviteUiState = "pending" | "expired" | "cancelled";

/**
 * What staff can do with a creator's invite before it is accepted: copy the
 * link, email it again, replace it with a new link (the old one stops
 * working) or cancel it. "card" is the compact row on the Creators list;
 * "panel" is the block on the profile.
 */
export function CreatorInviteActions({
  creatorId,
  name,
  email,
  state: initialState,
  expiresAt: initialExpires,
  variant = "card",
  className,
}: {
  creatorId: string;
  name: string;
  email: string;
  state: CreatorInviteUiState;
  expiresAt: string | null;
  variant?: "card" | "panel";
  className?: string;
}) {
  const [state, setState] = React.useState(initialState);
  const [expiresAt, setExpiresAt] = React.useState(initialExpires);
  const [busy, setBusy] = React.useState<null | "copy" | "email" | "rotate" | "cancel">(null);
  const [shown, setShown] = React.useState<{ title: string; description: string; link: string; expiresAt: string | null } | null>(null);
  const [confirm, setConfirm] = React.useState<null | "rotate" | "cancel">(null);
  const first = name.split(/\s+/)[0] || name;
  const router = useRouter();
  // The status pill beside us is server-rendered: refresh it after a change
  const changed = () => router.refresh();

  const copyLink = async () => {
    setBusy("copy");
    try {
      const res = await fetch(`/api/creators/${creatorId}/invite`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.state === "expired" || data?.state === "cancelled") setState(data.state);
        throw new Error(data?.error || "The link could not be loaded");
      }
      setExpiresAt(data.expiresAt);
      if (await writeClipboard(data.link)) {
        toast.success(`Invite link for ${first} copied`, { description: inviteNote(data.expiresAt) });
      } else {
        setShown({ title: `Invite link for ${first}`, description: "Copy it and send it to them yourself.", link: data.link, expiresAt: data.expiresAt });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The link could not be loaded");
    } finally {
      setBusy(null);
    }
  };

  const emailAgain = async () => {
    setBusy("email");
    try {
      const res = await fetch(`/api/creators/${creatorId}/resend-invite`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "The invite could not be sent");
      setState("pending");
      setExpiresAt(new Date(Date.now() + 7 * 86_400_000).toISOString());
      toast.success(`Invite emailed to ${email}`);
      changed();
    } catch (e) {
      toast.error(`${e instanceof Error ? e.message : "The invite could not be sent"}. Try again in a minute.`);
    } finally {
      setBusy(null);
    }
  };

  const rotate = async () => {
    setBusy("rotate");
    try {
      const res = await fetch(`/api/creators/${creatorId}/invite`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "A new link could not be made");
      setState("pending");
      setExpiresAt(data.expiresAt);
      setConfirm(null);
      changed();
      setShown({
        title: `New invite link for ${first}`,
        description: "The old link has stopped working. Send this one instead.",
        link: data.link,
        expiresAt: data.expiresAt,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "A new link could not be made");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy("cancel");
    try {
      const res = await fetch(`/api/creators/${creatorId}/invite`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "The invite could not be cancelled");
      setState("cancelled");
      setExpiresAt(null);
      setConfirm(null);
      toast.success(`Invite for ${first} cancelled. The link no longer works.`);
      changed();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The invite could not be cancelled");
    } finally {
      setBusy(null);
    }
  };

  const live = state === "pending";
  const stateLine =
    state === "pending"
      ? `Invite sent, not accepted yet. ${inviteNote(expiresAt).replace("Works once, e", "The link e")}`
      : state === "expired"
        ? "The invite link has expired. Make a new link or email the invite again."
        : "The invite was cancelled. Make a new link or email the invite again.";

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={variant === "card" ? "sm" : "icon"}
          className={variant === "card" ? "px-2" : undefined}
          aria-label={`More invite options for ${name}`}
          disabled={!!busy}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {variant === "card" && live && (
          <DropdownMenuItem onClick={copyLink}>
            <Copy aria-hidden="true" />
            Copy invite link
          </DropdownMenuItem>
        )}
        {variant === "card" && (
          <DropdownMenuItem onClick={emailAgain}>
            <Send aria-hidden="true" />
            Email invite again
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => (live ? setConfirm("rotate") : rotate())}>
          <Link2 aria-hidden="true" />
          New link
        </DropdownMenuItem>
        {live && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setConfirm("cancel")} className="text-late focus:text-late">
              <Ban aria-hidden="true" />
              Cancel invite
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const primary = live ? (
    <Button variant="outline" size={variant === "card" ? "sm" : "default"} onClick={copyLink} disabled={!!busy} className={variant === "panel" ? "flex-1" : undefined}>
      {busy === "copy" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Copy aria-hidden="true" />}
      Copy invite link
    </Button>
  ) : (
    <Button variant="outline" size={variant === "card" ? "sm" : "default"} onClick={rotate} disabled={!!busy} className={variant === "panel" ? "flex-1" : undefined}>
      {busy === "rotate" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Link2 aria-hidden="true" />}
      New link
    </Button>
  );

  return (
    <>
      {variant === "card" ? (
        <div className={cn("flex gap-2", className)}>
          {primary}
          {menu}
        </div>
      ) : (
        <div className={cn("space-y-2", className)}>
          <p className="text-[13px] text-ink-2" suppressHydrationWarning>
            {stateLine}
          </p>
          <div className="flex gap-2">
            {primary}
            {menu}
          </div>
          <Button variant="outline" className="w-full" onClick={emailAgain} disabled={!!busy}>
            {busy === "email" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            Email invite again
          </Button>
        </div>
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
        open={confirm === "rotate"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Make a new invite link for ${first}?`}
        description="The link you sent before stops working straight away. You'll get a new link to copy."
        confirmLabel="Make a new link"
        onConfirm={rotate}
      />
      <InviteConfirmDialog
        open={confirm === "cancel"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Cancel ${first}'s invite?`}
        description={`The invite link stops working straight away. ${first} stays on your list, and you can invite them again later.`}
        confirmLabel="Cancel invite"
        destructive
        onConfirm={cancel}
      />
    </>
  );
}
