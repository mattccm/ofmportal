"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirect old portal login to unified login page
export default function PortalLoginRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-ink-2 border-t-transparent motion-reduce:animate-none"></div>
        <p className="text-muted-foreground">Opening sign-in…</p>
      </div>
    </div>
  );
}
