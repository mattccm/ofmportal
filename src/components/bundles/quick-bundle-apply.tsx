"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Package,
  ChevronDown,
  Play,
  Clock,
  Layers,
  CheckCircle,
  Loader2,
  History,
  Zap,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { RequestBundle, QuickApplyHistory, BundleExecutionResult } from "@/types/request-bundles";

// ============================================
// TYPES
// ============================================

interface BundleSummary {
  id: string;
  name: string;
  description?: string;
  templateCount: number;
  isOnboardingBundle: boolean;
  autoTrigger?: "on_creator_create" | "manual";
}

interface QuickBundleApplyProps {
  creatorId: string;
  creatorName: string;
  bundles: BundleSummary[];
  lastApplied?: QuickApplyHistory | null;
  onApply: (bundleId: string, creatorId: string) => Promise<BundleExecutionResult>;
  onViewHistory?: () => void;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
}

// ============================================
// LOCAL STORAGE KEY FOR HISTORY
// ============================================

const HISTORY_STORAGE_KEY = "bundle-apply-history";

function getLocalHistory(creatorId: string): QuickApplyHistory | null {
  if (typeof window === "undefined") return null;
  try {
    const history = localStorage.getItem(`${HISTORY_STORAGE_KEY}-${creatorId}`);
    if (history) {
      const parsed = JSON.parse(history);
      return {
        ...parsed,
        appliedAt: new Date(parsed.appliedAt),
      };
    }
  } catch {
    // Ignore errors
  }
  return null;
}

function setLocalHistory(creatorId: string, history: QuickApplyHistory) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${HISTORY_STORAGE_KEY}-${creatorId}`,
      JSON.stringify(history)
    );
  } catch {
    // Ignore errors
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export function QuickBundleApply({
  creatorId,
  creatorName,
  bundles,
  lastApplied: lastAppliedProp,
  onApply,
  onViewHistory,
  className,
  variant = "outline",
  size = "default",
  showLabel = true,
}: QuickBundleApplyProps) {
  const [isApplying, setIsApplying] = useState<string | null>(null);
  const [localHistory, setLocalHistoryState] = useState<QuickApplyHistory | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Load local history on mount
  useEffect(() => {
    const history = getLocalHistory(creatorId);
    setLocalHistoryState(history);
  }, [creatorId]);

  const lastApplied = lastAppliedProp || localHistory;

  // Separate bundles by type
  const onboardingBundles = bundles.filter((b) => b.isOnboardingBundle);
  const standardBundles = bundles.filter((b) => !b.isOnboardingBundle);

  // Handle quick apply
  const handleApply = async (bundle: BundleSummary) => {
    setIsApplying(bundle.id);

    try {
      const result = await onApply(bundle.id, creatorId);

      // Update local history
      const newHistory: QuickApplyHistory = {
        bundleId: bundle.id,
        bundleName: bundle.name,
        appliedAt: new Date(),
        requestsCreated: result.totalCreated,
      };
      setLocalHistory(creatorId, newHistory);
      setLocalHistoryState(newHistory);

      if (result.totalFailed === 0) {
        toast.success(
          `Applied "${bundle.name}" - ${result.totalCreated} request${result.totalCreated !== 1 ? "s" : ""} created`
        );
      } else {
        toast.warning(
          `Applied "${bundle.name}" - ${result.totalCreated} created, ${result.totalFailed} failed`
        );
      }

      setIsOpen(false);
    } catch (error) {
      toast.error(`Failed to apply bundle "${bundle.name}"`);
    } finally {
      setIsApplying(null);
    }
  };

  // Render bundle item
  const renderBundleItem = (bundle: BundleSummary) => {
    const isCurrentlyApplying = isApplying === bundle.id;
    const wasLastApplied = lastApplied?.bundleId === bundle.id;

    return (
      <DropdownMenuItem
        key={bundle.id}
        className="flex items-start gap-3 p-3 cursor-pointer"
        onSelect={(e) => {
          e.preventDefault();
          handleApply(bundle);
        }}
        disabled={isCurrentlyApplying}
      >
        <div
          className={cn(
            "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center",
            bundle.isOnboardingBundle
              ? "bg-violet-500/10 text-violet-500"
              : "bg-blue-500/10 text-blue-500"
          )}
        >
          {isCurrentlyApplying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Package className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{bundle.name}</span>
            {wasLastApplied && (
              <Badge variant="secondary" className="text-xs shrink-0">
                Last used
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {bundle.templateCount} template{bundle.templateCount !== 1 ? "s" : ""}
            </span>
            {bundle.autoTrigger === "on_creator_create" && (
              <span className="flex items-center gap-1 text-amber-500">
                <Zap className="h-3 w-3" />
                Auto
              </span>
            )}
          </div>
        </div>
        <Play className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
      </DropdownMenuItem>
    );
  };

  if (bundles.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant={variant}
                size={size}
                className={cn(
                  "gap-2",
                  isApplying && "opacity-70",
                  className
                )}
                disabled={!!isApplying}
              >
                {isApplying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Package className="h-4 w-4" />
                )}
                {showLabel && <span>Apply Bundle</span>}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Apply a bundle of requests to this creator</p>
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Apply Bundle to {creatorName}</span>
            {onViewHistory && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={(e) => {
                  e.preventDefault();
                  onViewHistory();
                  setIsOpen(false);
                }}
              >
                <History className="h-3 w-3 mr-1" />
                History
              </Button>
            )}
          </DropdownMenuLabel>

          {/* Last Applied */}
          {lastApplied && (
            <>
              <div className="px-2 py-2 mx-2 mb-2 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="h-3 w-3 text-emerald-500" />
                  <span>
                    Last applied: <strong>{lastApplied.bundleName}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground pl-5">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(lastApplied.appliedAt), { addSuffix: true })}
                  </span>
                  <span>{lastApplied.requestsCreated} requests created</span>
                </div>
              </div>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Onboarding Bundles */}
          {onboardingBundles.length > 0 && (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                Onboarding Bundles
              </DropdownMenuLabel>
              {onboardingBundles.map(renderBundleItem)}
            </DropdownMenuGroup>
          )}

          {onboardingBundles.length > 0 && standardBundles.length > 0 && (
            <DropdownMenuSeparator />
          )}

          {/* Standard Bundles */}
          {standardBundles.length > 0 && (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1">
                <Package className="h-3 w-3" />
                Standard Bundles
              </DropdownMenuLabel>
              {standardBundles.map(renderBundleItem)}
            </DropdownMenuGroup>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}

// ============================================
// COMPACT VARIANT FOR LISTS
// ============================================

interface QuickBundleApplyCompactProps {
  creatorId: string;
  creatorName: string;
  bundles: BundleSummary[];
  onApply: (bundleId: string, creatorId: string) => Promise<BundleExecutionResult>;
}

export function QuickBundleApplyCompact({
  creatorId,
  creatorName,
  bundles,
  onApply,
}: QuickBundleApplyCompactProps) {
  return (
    <QuickBundleApply
      creatorId={creatorId}
      creatorName={creatorName}
      bundles={bundles}
      onApply={onApply}
      variant="ghost"
      size="sm"
      showLabel={false}
    />
  );
}

export default QuickBundleApply;
