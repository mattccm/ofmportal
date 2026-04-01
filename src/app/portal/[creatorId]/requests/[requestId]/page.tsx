"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";

// Redirect old portal URLs to new creator request detail page
export default function PortalRequestDetailRedirectPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/creator/requests/${requestId}`);
  }, [router, requestId]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}
