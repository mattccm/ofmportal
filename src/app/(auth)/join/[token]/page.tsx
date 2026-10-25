import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Link2Off } from "lucide-react";
import { staffInviteState } from "@/lib/invites";
import { findStaffInviteByToken, toInviteRow } from "@/lib/staff-invites";
import { JoinForm } from "./join-form";

// Generic on purpose, and the link (a bearer secret) never leaks as a referrer
export const metadata: Metadata = {
  title: "Join the team",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const GONE = {
  expired: { title: "This invite link has expired", text: "Invite links work for 7 days." },
  accepted: { title: "This invite link has been used", text: "Each invite link works once. If you set up your account with it, sign in." },
  cancelled: { title: "This invite was cancelled", text: "Whoever sent it cancelled the invite, so the link no longer works." },
  invalid: { title: "This invite link doesn't work", text: "It may have been replaced by a newer link, or copied incompletely." },
} as const;

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let invite: Awaited<ReturnType<typeof findStaffInviteByToken>> = null;
  try {
    invite = await findStaffInviteByToken(token);
  } catch (error) {
    console.error("Join page lookup failed:", error instanceof Error ? error.message : error);
  }

  const state = invite ? staffInviteState(invite) : "invalid";

  if (!invite || state !== "pending") {
    const gone = GONE[state as keyof typeof GONE] ?? GONE.invalid;
    const Icon = state === "expired" ? Clock : Link2Off;
    return (
      <div className="space-y-6">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">{gone.title}</h1>
        <div className="flex gap-3 rounded-[8px] bg-tile p-4">
          <Icon className="mt-0.5 size-4 shrink-0 text-icon" aria-hidden="true" />
          <p className="text-[15px] text-ink">{gone.text}</p>
        </div>
        <p className="text-[15px] leading-normal text-ink-2">
          {state === "accepted" ? "Need another account? " : ""}Ask your team for a new link.
        </p>
        <p className="text-[15px] text-ink-2">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-ink underline decoration-ctl-hi underline-offset-[3px] hover:decoration-ink"
          >
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  const row = toInviteRow(invite);
  return (
    <JoinForm
      token={token}
      agencyName={invite.agency.name}
      roleLabel={row.roleLabel}
      invitedBy={row.invitedBy}
      name={invite.name ?? ""}
      email={invite.email ?? ""}
      emailLocked={!!invite.email}
      expiresAt={row.expiresAt}
    />
  );
}
