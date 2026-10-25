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
        <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-ink-2 border-t-transparent motion-reduce:animate-none"></div>
        <p className="text-[15px] text-ink-2">Opening your requests…</p>
      </div>
    </div>
  );
}
