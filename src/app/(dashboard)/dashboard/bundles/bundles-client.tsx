"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { BundleManager } from "@/components/bundles/bundle-manager";
import { BundleExecutor } from "@/components/bundles/bundle-executor";
import { toast } from "sonner";
import type {
  RequestBundle,
  BundleExecutionConfig,
  BundleExecutionResult,
  UrgencyLevel,
} from "@/types/request-bundles";

// ============================================
// TYPES
// ============================================

interface Template {
  id: string;
  name: string;
  description?: string | null;
  fieldCount: number;
  defaultDueDays: number;
  defaultUrgency: UrgencyLevel;
  isActive: boolean;
}

interface Creator {
  id: string;
  name: string;
  email: string;
}

interface BundleWithTemplates extends RequestBundle {
  templates: Template[];
}

interface BundlesClientProps {
  initialBundles: BundleWithTemplates[];
  availableTemplates: Template[];
  creators: Creator[];
}

// ============================================
// MAIN COMPONENT
// ============================================

export function BundlesClient({
  initialBundles,
  availableTemplates,
  creators,
}: BundlesClientProps) {
  const [bundles, setBundles] = useState<BundleWithTemplates[]>(initialBundles);
  const [executingBundle, setExecutingBundle] = useState<BundleWithTemplates | null>(null);
  const [showExecutor, setShowExecutor] = useState(false);

  // Create bundle
  const handleCreateBundle = useCallback(
    async (bundleData: Omit<RequestBundle, "id" | "createdAt" | "updatedAt">) => {
      const response = await fetch("/api/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bundleData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create bundle");
      }

      const newBundle = await response.json();

      // Fetch the full bundle with templates
      const bundlesResponse = await fetch("/api/bundles");
      if (bundlesResponse.ok) {
        const data = await bundlesResponse.json();
        setBundles(data.bundles);
      }
    },
    []
  );

  // Update bundle
  const handleUpdateBundle = useCallback(
    async (id: string, bundleData: Partial<RequestBundle>) => {
      const response = await fetch("/api/bundles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...bundleData }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update bundle");
      }

      // Fetch the updated bundles
      const bundlesResponse = await fetch("/api/bundles");
      if (bundlesResponse.ok) {
        const data = await bundlesResponse.json();
        setBundles(data.bundles);
      }
    },
    []
  );

  // Delete bundle
  const handleDeleteBundle = useCallback(async (id: string) => {
    const response = await fetch(`/api/bundles?id=${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete bundle");
    }

    setBundles((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // Duplicate bundle
  const handleDuplicateBundle = useCallback(
    async (id: string) => {
      const bundle = bundles.find((b) => b.id === id);
      if (!bundle) return;

      await handleCreateBundle({
        name: `${bundle.name} (Copy)`,
        description: bundle.description,
        templateIds: bundle.templateIds,
        templateConfigs: bundle.templateConfigs,
        isOnboardingBundle: bundle.isOnboardingBundle,
        autoTrigger: bundle.autoTrigger,
      });

      toast.success("Bundle duplicated");
    },
    [bundles, handleCreateBundle]
  );

  // Open execute dialog
  const handleExecuteBundle = useCallback(
    (bundleId: string) => {
      const bundle = bundles.find((b) => b.id === bundleId);
      if (bundle) {
        setExecutingBundle(bundle);
        setShowExecutor(true);
      }
    },
    [bundles]
  );

  // Execute bundle
  const handleExecute = useCallback(
    async (config: BundleExecutionConfig): Promise<BundleExecutionResult> => {
      const response = await fetch(`/api/bundles/${config.bundleId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorIds: config.creatorIds,
          sendNotifications: config.sendNotifications,
          startDate: config.startDate,
          overrides: config.overrides,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to execute bundle");
      }

      return await response.json();
    },
    []
  );

  return (
    <>
      <BundleManager
        bundles={bundles}
        availableTemplates={availableTemplates}
        onCreateBundle={handleCreateBundle}
        onUpdateBundle={handleUpdateBundle}
        onDeleteBundle={handleDeleteBundle}
        onDuplicateBundle={handleDuplicateBundle}
        onExecuteBundle={handleExecuteBundle}
      />

      <BundleExecutor
        open={showExecutor}
        onOpenChange={setShowExecutor}
        bundle={executingBundle}
        creators={creators}
        onExecute={handleExecute}
      />
    </>
  );
}

export default BundlesClient;
