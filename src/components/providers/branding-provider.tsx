"use client";

import * as React from "react";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { DEFAULT_BRANDING, hexToHsl, type BrandingSettings } from "@/lib/branding";

interface BrandingContextType {
  branding: BrandingSettings;
  agencyName: string;
  isLoading: boolean;
  error: string | null;
  refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType>({
  branding: DEFAULT_BRANDING,
  agencyName: "",
  isLoading: true,
  error: null,
  refreshBranding: async () => {},
});

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error("useBranding must be used within a BrandingProvider");
  }
  return context;
}

interface BrandingProviderProps {
  children: React.ReactNode;
  creatorId?: string;
}

export function BrandingProvider({ children, creatorId }: BrandingProviderProps) {
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [agencyName, setAgencyName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBranding = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try fetching with creator token first
      const creatorToken = localStorage.getItem("creatorToken");

      if (creatorToken) {
        const response = await fetch("/api/portal/branding", {
          headers: {
            "x-creator-token": creatorToken,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setBranding(data.branding);
          setAgencyName(data.agencyName || "");
          return;
        }
      }

      // Fallback: fetch by creatorId if available
      if (creatorId) {
        const response = await fetch("/api/portal/branding", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ creatorId }),
        });

        if (response.ok) {
          const data = await response.json();
          setBranding(data.branding);
          setAgencyName(data.agencyName || "");
          return;
        }
      }

      // Use defaults if no branding available
      setBranding(DEFAULT_BRANDING);
    } catch (err) {
      console.error("Error fetching branding:", err);
      setError(err instanceof Error ? err.message : "Failed to load branding");
      setBranding(DEFAULT_BRANDING);
    } finally {
      setIsLoading(false);
    }
  }, [creatorId]);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  // Apply branding CSS variables to document
  useEffect(() => {
    const primary = hexToHsl(branding.primaryColor);
    const secondary = hexToHsl(branding.secondaryColor);
    const accent = hexToHsl(branding.accentColor);

    const root = document.documentElement;
    root.style.setProperty("--brand-primary-h", String(primary.h));
    root.style.setProperty("--brand-primary-s", `${primary.s}%`);
    root.style.setProperty("--brand-primary-l", `${primary.l}%`);
    root.style.setProperty("--brand-secondary-h", String(secondary.h));
    root.style.setProperty("--brand-secondary-s", `${secondary.s}%`);
    root.style.setProperty("--brand-secondary-l", `${secondary.l}%`);
    root.style.setProperty("--brand-accent-h", String(accent.h));
    root.style.setProperty("--brand-accent-s", `${accent.s}%`);
    root.style.setProperty("--brand-accent-l", `${accent.l}%`);

    // Also set the primary color for components that use it directly
    root.style.setProperty("--brand-primary", branding.primaryColor);
    root.style.setProperty("--brand-secondary", branding.secondaryColor);
    root.style.setProperty("--brand-accent", branding.accentColor);

    return () => {
      // Cleanup
      root.style.removeProperty("--brand-primary-h");
      root.style.removeProperty("--brand-primary-s");
      root.style.removeProperty("--brand-primary-l");
      root.style.removeProperty("--brand-secondary-h");
      root.style.removeProperty("--brand-secondary-s");
      root.style.removeProperty("--brand-secondary-l");
      root.style.removeProperty("--brand-accent-h");
      root.style.removeProperty("--brand-accent-s");
      root.style.removeProperty("--brand-accent-l");
      root.style.removeProperty("--brand-primary");
      root.style.removeProperty("--brand-secondary");
      root.style.removeProperty("--brand-accent");
    };
  }, [branding]);

  return (
    <BrandingContext.Provider
      value={{
        branding,
        agencyName,
        isLoading,
        error,
        refreshBranding: fetchBranding,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

// Hook for getting branding-aware styles
export function useBrandingStyles() {
  const { branding } = useBranding();

  return {
    // Primary button style
    primaryButton: {
      backgroundColor: branding.primaryColor,
      color: "#ffffff",
    },
    // Secondary/outline button style
    outlineButton: {
      borderColor: branding.primaryColor,
      color: branding.primaryColor,
    },
    // Ghost button style
    ghostButton: {
      backgroundColor: `${branding.primaryColor}15`,
      color: branding.primaryColor,
    },
    // Gradient style
    gradient: {
      background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor}, ${branding.accentColor})`,
    },
    // Header gradient
    headerGradient: {
      background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`,
    },
    // Accent background
    accentBg: {
      backgroundColor: `${branding.accentColor}20`,
      color: branding.accentColor,
    },
    // Primary text
    primaryText: {
      color: branding.primaryColor,
    },
    // Border primary
    borderPrimary: {
      borderColor: branding.primaryColor,
    },
  };
}

export default BrandingProvider;
