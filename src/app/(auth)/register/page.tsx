"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Registration is disabled - this is a private portal
// All users (staff and creators) are invited by the agency owner
export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login page
    router.replace("/login");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
}
