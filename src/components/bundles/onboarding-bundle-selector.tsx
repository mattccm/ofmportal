"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Package,
  Layers,
  CheckCircle,
  Loader2,
  Users,
  Zap,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { UrgencyLevel } from "@/types/request-bundles";

// ============================================
// TYPES
// ============================================

interface BundleSummary {
  id: string;
  name: string;
  description?: string;
  templateCount: number;
  templates: { id: string; name: string }[];
  isOnboardingBundle: boolean;
  autoTrigger?: "on_creator_create" | "manual";
}

interface OnboardingBundleSelectorProps {
  onBundleSelect: (bundleId: string | null) => void;
  selectedBundleId: string | null;
  disabled?: boolean;
  className?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function OnboardingBundleSelector({
  onBundleSelect,
  selectedBundleId,
  disabled = false,
  className,
}: OnboardingBundleSelectorProps) {
  const [bundles, setBundles] = useState<BundleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyBundle, setApplyBundle] = useState(true);

  // Fetch onboarding bundles
  useEffect(() => {
    async function fetchBundles() {
      try {
        const response = await fetch("/api/bundles?onboarding=true");
        if (response.ok) {
          const data = await response.json();
          setBundles(data.bundles || []);

          // Auto-select the first auto-trigger bundle, or first bundle if none
          const autoTriggerBundle = data.bundles.find(
            (b: BundleSummary) => b.autoTrigger === "on_creator_create"
          );
          if (autoTriggerBundle) {
            onBundleSelect(autoTriggerBundle.id);
          } else if (data.bundles.length > 0) {
            onBundleSelect(data.bundles[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch bundles:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchBundles();
  }, []);

  // Handle toggle
  const handleToggle = (checked: boolean) => {
    setApplyBundle(checked);
    if (!checked) {
      onBundleSelect(null);
    } else if (bundles.length > 0) {
      const autoTriggerBundle = bundles.find(
        (b) => b.autoTrigger === "on_creator_create"
      );
      onBundleSelect(autoTriggerBundle?.id || bundles[0].id);
    }
  };

  // No onboarding bundles available
  if (!loading && bundles.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor="apply-bundle" className="font-medium cursor-pointer">
            Apply Onboarding Bundle
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Automatically create a set of content requests when this creator is
                  invited. Great for standardizing your onboarding process.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch
          id="apply-bundle"
          checked={applyBundle}
          onCheckedChange={handleToggle}
          disabled={disabled || loading}
        />
      </div>

      {applyBundle && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading bundles...
            </div>
          ) : (
            <div className="grid gap-2">
              {bundles.map((bundle) => {
                const isSelected = selectedBundleId === bundle.id;
                const isAutoTrigger = bundle.autoTrigger === "on_creator_create";

                return (
                  <button
                    key={bundle.id}
                    type="button"
                    onClick={() => onBundleSelect(bundle.id)}
                    disabled={disabled}
                    className={cn(
                      "w-full text-left p-4 rounded-xl border transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50 hover:bg-muted/50",
                      disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-violet-500/10 text-violet-500"
                        )}
                      >
                        <Package className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{bundle.name}</span>
                          {isAutoTrigger && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-amber-500/10 text-amber-600 border-amber-200"
                            >
                              <Zap className="h-3 w-3 mr-1" />
                              Default
                            </Badge>
                          )}
                          {isSelected && (
                            <CheckCircle className="h-4 w-4 text-primary ml-auto" />
                          )}
                        </div>
                        {bundle.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {bundle.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            {bundle.templateCount} template{bundle.templateCount !== 1 ? "s" : ""}
                          </span>
                          <span className="truncate">
                            {bundle.templates.slice(0, 3).map((t) => t.name).join(", ")}
                            {bundle.templates.length > 3 && ` +${bundle.templates.length - 3} more`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && selectedBundleId && (
            <p className="text-xs text-muted-foreground">
              These requests will be created automatically after the creator is invited.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// POST-INVITE BUNDLE APPLY COMPONENT
// ============================================

interface PostInviteBundleApplyProps {
  creatorId: string;
  creatorName: string;
  bundleId: string | null;
  onComplete?: () => void;
}

export function PostInviteBundleApply({
  creatorId,
  creatorName,
  bundleId,
  onComplete,
}: PostInviteBundleApplyProps) {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    totalCreated: number;
    totalFailed: number;
  } | null>(null);

  // Auto-apply bundle after mount
  useEffect(() => {
    if (bundleId && !applied && !applying) {
      applyBundle();
    }
  }, [bundleId]);

  async function applyBundle() {
    if (!bundleId) return;

    setApplying(true);
    setError(null);

    try {
      const response = await fetch(`/api/bundles/${bundleId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorIds: [creatorId],
          sendNotifications: false, // Don't send notifications during invite, they'll get the invite email
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to apply bundle");
      }

      const data = await response.json();
      setResult({
        totalCreated: data.totalCreated,
        totalFailed: data.totalFailed,
      });
      setApplied(true);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply bundle");
    } finally {
      setApplying(false);
    }
  }

  if (!bundleId) return null;

  return (
    <Card className="mt-4">
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          {applying ? (
            <>
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
              <div>
                <p className="font-medium">Applying onboarding bundle...</p>
                <p className="text-sm text-muted-foreground">
                  Creating content requests for {creatorName}
                </p>
              </div>
            </>
          ) : applied ? (
            <>
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="font-medium text-emerald-600">
                  Onboarding bundle applied!
                </p>
                <p className="text-sm text-muted-foreground">
                  {result?.totalCreated} request{result?.totalCreated !== 1 ? "s" : ""} created
                  {result?.totalFailed ? ` (${result.totalFailed} failed)` : ""}
                </p>
              </div>
            </>
          ) : error ? (
            <>
              <div className="h-5 w-5 rounded-full bg-red-500/10 flex items-center justify-center">
                <span className="text-red-500 text-xs font-bold">!</span>
              </div>
              <div>
                <p className="font-medium text-red-600">
                  Failed to apply bundle
                </p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={applyBundle}
                className="ml-auto"
              >
                Retry
              </Button>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default OnboardingBundleSelector;
