"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Palette,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Sparkles,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BrandingForm } from "@/components/settings/branding-form";
import { toast } from "sonner";
import { DEFAULT_BRANDING, type BrandingSettings } from "@/lib/branding";

export default function BrandingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [agencyName, setAgencyName] = useState<string>("");

  // Fetch current branding settings
  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const response = await fetch("/api/agency/branding");

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Please log in to access branding settings");
          }
          throw new Error("Failed to load branding settings");
        }

        const data = await response.json();
        setBranding(data.branding);
        setAgencyName(data.agencyName || "");
      } catch (err) {
        console.error("Error fetching branding:", err);
        setError(err instanceof Error ? err.message : "Failed to load branding");
      } finally {
        setLoading(false);
      }
    };

    fetchBranding();
  }, []);

  // Save branding changes
  const handleSave = async (newBranding: BrandingSettings) => {
    const response = await fetch("/api/agency/branding", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newBranding),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to save branding");
    }

    const data = await response.json();
    setBranding(data.branding);
  };

  // Loading state
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/settings">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Agency Branding</h1>
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        </div>

        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-5xl mx-auto py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/settings">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Agency Branding</h1>
            <p className="text-muted-foreground">Customize your creator portal</p>
          </div>
        </div>

        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-destructive">
                  Failed to load branding settings
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => window.location.reload()}
                >
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/settings">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500/20 via-purple-500/20 to-fuchsia-500/20 flex items-center justify-center">
          <Palette className="h-7 w-7 text-violet-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Agency Branding</h1>
          <p className="text-muted-foreground">
            Customize your portal with your brand colors and logo
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="overflow-hidden border-violet-200/50 bg-gradient-to-r from-violet-50/50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/20 dark:border-violet-800/30">
        <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-violet-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-violet-700 dark:text-violet-400">
                Customize Your Portal
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Make the creator portal your own! Upload your logo, choose your brand
                colors, and customize the portal appearance. Your creators will see your
                branding throughout their experience.
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">Custom logos</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">Brand colors</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-violet-500" />
                  <span className="text-muted-foreground">Custom domain</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-muted-foreground">Email templates</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agency Info */}
      {agencyName && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                {branding.logoLight ? (
                  <img
                    src={branding.logoLight}
                    alt={agencyName}
                    className="h-8 w-8 object-contain"
                  />
                ) : (
                  <Building2 className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <p className="font-semibold">{agencyName}</p>
                <p className="text-sm text-muted-foreground">
                  {branding.subdomain
                    ? `${branding.subdomain}.uploadportal.com`
                    : branding.customDomain || "No custom domain set"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Branding Form */}
      <BrandingForm
        initialBranding={branding}
        agencyName={agencyName}
        onSave={handleSave}
      />
    </div>
  );
}
