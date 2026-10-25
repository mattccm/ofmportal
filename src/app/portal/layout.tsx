"use client";

import { BrandingProvider } from "@/components/providers/branding-provider";

/**
 * /portal hosts the creator's sign-in, invite setup and onboarding (the live
 * creator shell is /creator). It sits on the plain Title Wall ground; the
 * pages themselves centre their own column.
 */
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BrandingProvider>
      <div className="min-h-screen bg-background text-foreground">{children}</div>
    </BrandingProvider>
  );
}
