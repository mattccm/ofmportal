"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { formatDay, useViewerTimeZone } from "@/components/title-wall";
import { cn } from "@/lib/utils";

/**
 * Invite links (creator and staff) shown to the person who made them: the
 * link in a read-only field, a Copy button, and how long it works. The link
 * is a bearer secret, so nothing here logs it.
 */

/** "Works once, expires in 7 days (Sat 1 Nov)." */
export function inviteNote(expiresAt?: string | null, tz?: string): string {
  if (!expiresAt) return "Works once, expires in 7 days.";
  const days = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
  const when = days >= 1 ? `in ${days} ${days === 1 ? "day" : "days"}` : "today";
  return `Works once, expires ${when} (${formatDay(expiresAt, tz)}).`;
}

/** Writes text to the clipboard; false when the browser refuses (e.g. after a slow fetch). */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function InviteLinkBox({
  link,
  expiresAt,
  primary = false,
  label = "Invite link",
  className,
}: {
  link: string;
  expiresAt?: string | null;
  /** The Copy button is the region's one primary action */
  primary?: boolean;
  label?: string;
  className?: string;
}) {
  const tz = useViewerTimeZone();
  const id = React.useId();
  const noteId = `${id}-note`;
  const { copied, copy } = useCopyToClipboard({
    onSuccess: () => toast.success("Invite link copied"),
    onError: () => toast.error("The link could not be copied. Select it and copy it yourself."),
  });

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          readOnly
          value={link}
          aria-describedby={noteId}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 min-w-0 flex-1 rounded-[8px] border border-ctl bg-well px-3 font-mono text-[13px] text-ink outline-none transition-colors hover:border-ctl-hi focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring md:h-9"
        />
        <Button
          type="button"
          variant={primary ? "default" : "outline"}
          onClick={() => copy(link)}
          className="h-11 shrink-0 md:h-9"
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
      <p id={noteId} className="text-[13px] text-ink-2" suppressHydrationWarning>
        {inviteNote(expiresAt, tz)}
      </p>
    </div>
  );
}

/** Asks before an action that stops a link working (new link, cancel). */
export function InviteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-ink-2">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>
              Keep it
            </Button>
          </DialogClose>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A link shown after it was made or replaced (or when the clipboard said no). */
export function InviteLinkDialog({
  open,
  onOpenChange,
  title,
  description,
  link,
  expiresAt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  link: string | null;
  expiresAt?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription className="text-ink-2">{description}</DialogDescription>}
        </DialogHeader>
        {link && <InviteLinkBox link={link} expiresAt={expiresAt} primary />}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
