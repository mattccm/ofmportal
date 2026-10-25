import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The calm page shown in place of a screen someone's role doesn't include.
 * Server or client. `what` finishes "Your role doesn't include …".
 */
export function NoAccess({ what, roleName }: { what: string; roleName?: string }) {
  return (
    <div className="mx-auto max-w-[640px] pt-6 sm:pt-12">
      <div className="rounded-[10px] bg-tile p-5 sm:p-6">
        <Lock className="size-5 text-icon" aria-hidden="true" />
        <h1 className="mt-3 text-[22px] font-bold leading-tight tracking-[-0.015em] text-ink">You don&apos;t have access to this</h1>
        <p className="mt-2 max-w-[60ch] text-[15px] leading-normal text-ink">
          {roleName ? `Your role, ${roleName}, doesn't include ${what}.` : `Your role doesn't include ${what}.`} If you need it, ask an
          owner or anyone who manages roles to change your role.
        </p>
        <Button asChild variant="outline" className="mt-5 max-sm:h-11 max-sm:w-full">
          <Link href="/dashboard">Go to the overview</Link>
        </Button>
      </div>
    </div>
  );
}
