"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirect old portal URLs to new creator settings page
export default function PortalSettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/creator/settings");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}
