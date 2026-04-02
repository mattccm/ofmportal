"use client";

import * as React from "react";
import { ReactNode, Suspense, lazy, memo } from "react";
import { ResponsiveLayout } from "./responsive-layout";
import { SearchProvider } from "@/components/search";
import { QuickActionsProvider } from "@/components/quick-actions";
import { PageErrorBoundary, WidgetErrorBoundary, ProviderErrorBoundary } from "@/components/errors";
import { AnnouncementsProvider } from "@/components/announcements";
import { CreatorContextProvider } from "@/components/providers/creator-context-provider";
import { useRouteCleanup } from "@/hooks/use-route-cleanup";

const ActivityPanel = lazy(() =>
  import("@/components/activity").then((mod) => ({
    default: mod.ActivityPanel,
  }))
);

interface DashboardLayoutClientProps {
  children: ReactNode;
}

/**
 * Dashboard Layout with Isolated Providers
 *
 * Each provider is wrapped in its own ProviderErrorBoundary to prevent
 * cascading failures. If one provider fails, others continue working.
 *
 * Provider hierarchy (outer to inner):
 * 1. SearchProvider - Global search (Cmd+K)
 * 2. QuickActionsProvider - FAB quick actions
 * 3. AnnouncementsProvider - Banner announcements
 * 4. CreatorContextProvider - Creator context panel
 */
export const DashboardLayoutClient = memo(function DashboardLayoutClient({
  children,
}: DashboardLayoutClientProps) {
  // Clean up global caches on route change to prevent stale state
  useRouteCleanup();

  return (
    <ProviderErrorBoundary providerName="SearchProvider">
      <SearchProvider>
        <ProviderErrorBoundary providerName="QuickActionsProvider">
          <QuickActionsProvider>
            <ProviderErrorBoundary providerName="AnnouncementsProvider">
              <AnnouncementsProvider>
                <ProviderErrorBoundary providerName="CreatorContextProvider">
                  <CreatorContextProvider>
                    <ResponsiveLayout>
                      <PageErrorBoundary>
                        {children}
                      </PageErrorBoundary>
                      {/* Lazy load activity panel with Suspense */}
                      <Suspense fallback={null}>
                        <WidgetErrorBoundary>
                          <ActivityPanel maxItems={20} compact={false} />
                        </WidgetErrorBoundary>
                      </Suspense>
                    </ResponsiveLayout>
                  </CreatorContextProvider>
                </ProviderErrorBoundary>
              </AnnouncementsProvider>
            </ProviderErrorBoundary>
          </QuickActionsProvider>
        </ProviderErrorBoundary>
      </SearchProvider>
    </ProviderErrorBoundary>
  );
});
