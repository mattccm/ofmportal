"use client";

import * as React from "react";
import { ReactNode, Suspense, lazy, memo } from "react";
import { ResponsiveLayout } from "./responsive-layout";
import { SearchProvider } from "@/components/search";
import { QuickActionsProvider } from "@/components/quick-actions";
import { PageErrorBoundary, WidgetErrorBoundary } from "@/components/errors";
import { AnnouncementsProvider } from "@/components/announcements";
import { CreatorContextProvider } from "@/components/providers/creator-context-provider";

const ActivityPanel = lazy(() =>
  import("@/components/activity").then((mod) => ({
    default: mod.ActivityPanel,
  }))
);

interface DashboardLayoutClientProps {
  children: ReactNode;
}

// Memoize the layout to prevent unnecessary re-renders
export const DashboardLayoutClient = memo(function DashboardLayoutClient({
  children,
}: DashboardLayoutClientProps) {
  return (
    <SearchProvider>
      <QuickActionsProvider>
        <AnnouncementsProvider>
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
        </AnnouncementsProvider>
      </QuickActionsProvider>
    </SearchProvider>
  );
});
