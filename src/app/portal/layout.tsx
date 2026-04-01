"use client";

import { Toaster } from "sonner";
import { BrandingProvider, useBranding } from "@/components/providers/branding-provider";

// Inner layout component that uses branding
function PortalLayoutInner({ children }: { children: React.ReactNode }) {
  const { branding } = useBranding();

  // Generate CSS variables for branding colors
  const brandingStyle = {
    "--brand-primary": branding.primaryColor,
    "--brand-secondary": branding.secondaryColor,
    "--brand-accent": branding.accentColor,
  } as React.CSSProperties;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/30"
      style={brandingStyle}
    >
      {/* Subtle decorative background elements using brand colors */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: branding.primaryColor }}
        />
        <div
          className="absolute top-1/2 -left-40 w-96 h-96 rounded-full blur-3xl opacity-15"
          style={{ backgroundColor: branding.secondaryColor }}
        />
        <div
          className="absolute -bottom-40 right-1/3 w-72 h-72 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: branding.accentColor }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10">{children}</div>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        richColors
        toastOptions={{
          className:
            "!bg-white/95 dark:!bg-slate-900/95 !backdrop-blur-sm !shadow-lg !border-border/50",
        }}
      />
    </div>
  );
}

// Main layout wrapper with provider
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BrandingProvider>
      <PortalLayoutInner>{children}</PortalLayoutInner>
    </BrandingProvider>
  );
}
