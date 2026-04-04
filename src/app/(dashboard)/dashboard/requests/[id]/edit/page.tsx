"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Redirect to request detail page where inline editing is available
 * This route exists for backwards compatibility with edit links
 */
export default function EditRequestPage() {
  const router = useRouter();
  const params = useParams();
  const requestId = params.id as string;

  useEffect(() => {
    if (requestId) {
      // Redirect to the request detail page with edit mode indicator
      router.replace(`/dashboard/requests/${requestId}?mode=edit`);
    }
  }, [requestId, router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Loading request editor...</p>
      </div>
    </div>
  );
}
