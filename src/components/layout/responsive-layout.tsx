"use client";

import * as React from "react";
import { ReactNode, Suspense } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile, useIsTablet } from "@/hooks/use-media-query";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { MobileHeader } from "./mobile-header";
import { AnnouncementsDisplay } from "@/components/announcements";

interface ResponsiveLayoutProps {
  children: ReactNode;
  title?: string;
  showBackButton?: boolean;
  backHref?: string;
  headerRightContent?: ReactNode;
  className?: string;
  hideNavigation?: boolean;
  fullWidth?: boolean;
}

// Memoized gradient accent line
const GradientAccent = React.memo(function GradientAccent({ height = "h-1" }: { height?: string }) {
  return (
    <div className={`${height} bg-gradient-to-r from-primary via-violet-500 to-purple-600`} />
  );
});

// Memoized content wrapper for desktop/tablet
const ContentWrapper = React.memo(function ContentWrapper({
  children,
  className,
  fullWidth,
  padding,
}: {
  children: ReactNode;
  className?: string;
  fullWidth: boolean;
  padding: string;
}) {
  return (
    <div className={cn(padding, !fullWidth && "max-w-[1600px]")}>
      {children}
    </div>
  );
});

function ResponsiveLayoutComponent({
  children,
  title,
  showBackButton,
  backHref,
  headerRightContent,
  className,
  hideNavigation = false,
  fullWidth = false,
}: ResponsiveLayoutProps) {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  // Mobile layout
  if (isMobile) {
    return (
      <div
        className={cn(
          "min-h-screen bg-background",
          "flex flex-col",
          // PWA standalone mode styling
          "standalone:pb-safe-area-inset-bottom"
        )}
      >
        {/* Mobile Header */}
        {!hideNavigation && (
          <MobileHeader
            title={title}
            showBackButton={showBackButton}
            backHref={backHref}
            rightContent={headerRightContent}
          />
        )}

        {/* Main Content */}
        <main
          className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden",
            "pb-[env(safe-area-inset-bottom,80px)]", // Dynamic safe area with fallback
            className
          )}
          style={{ paddingBottom: 'max(80px, env(safe-area-inset-bottom, 80px))' }}
        >
          {/* Top gradient accent */}
          {!hideNavigation && !showBackButton && (
            <GradientAccent height="h-0.5" />
          )}

          {/* Announcements Banner */}
          {!hideNavigation && <AnnouncementsDisplay />}

          {/* Content */}
          <div
            className={cn(
              "min-h-full",
              !fullWidth && "px-4 py-4"
            )}
          >
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        {!hideNavigation && <MobileNav />}
      </div>
    );
  }

  // Tablet layout - Uses sidebar but more compact
  if (isTablet) {
    return (
      <div className="flex h-screen bg-background">
        {/* Sidebar (hidden on mobile, visible on tablet+) */}
        {!hideNavigation && <Sidebar />}

        {/* Main content */}
        <main
          className={cn(
            "flex-1 overflow-auto scrollbar-thin",
            className
          )}
        >
          <div className="min-h-full">
            {/* Top gradient accent */}
            {!hideNavigation && <GradientAccent />}

            {/* Announcements Banner */}
            {!hideNavigation && <AnnouncementsDisplay />}

            {/* Content area - tighter padding on tablet */}
            <ContentWrapper fullWidth={fullWidth} padding="p-4 lg:p-6">
              {children}
            </ContentWrapper>
          </div>
        </main>
      </div>
    );
  }

  // Desktop layout - Full sidebar and wider content
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      {!hideNavigation && <Sidebar />}

      {/* Main content */}
      <main
        className={cn(
          "flex-1 overflow-auto scrollbar-thin",
          className
        )}
      >
        <div className="min-h-full">
          {/* Top gradient accent */}
          {!hideNavigation && <GradientAccent />}

          {/* Announcements Banner */}
          {!hideNavigation && <AnnouncementsDisplay />}

          {/* Content area */}
          <ContentWrapper fullWidth={fullWidth} padding="p-6 lg:p-8 xl:p-10">
            {children}
          </ContentWrapper>
        </div>
      </main>
    </div>
  );
}

// Export memoized layout to prevent unnecessary re-renders
export const ResponsiveLayout = React.memo(ResponsiveLayoutComponent);

// Simple wrapper that just handles responsive padding
interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "main";
}

export function ResponsiveContainer({
  children,
  className,
  as: Component = "div",
}: ResponsiveContainerProps) {
  return (
    <Component
      className={cn(
        "w-full",
        "px-4 md:px-6 lg:px-8",
        "py-4 md:py-6",
        className
      )}
    >
      {children}
    </Component>
  );
}

// Grid that adjusts columns based on screen size
interface ResponsiveGridProps {
  children: ReactNode;
  className?: string;
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: "sm" | "md" | "lg";
}

export function ResponsiveGrid({
  children,
  className,
  cols = { mobile: 1, tablet: 2, desktop: 3 },
  gap = "md",
}: ResponsiveGridProps) {
  const gapClasses = {
    sm: "gap-2 md:gap-3",
    md: "gap-4 md:gap-6",
    lg: "gap-6 md:gap-8",
  };

  return (
    <div
      className={cn(
        "grid",
        gapClasses[gap],
        className
      )}
      style={{
        gridTemplateColumns: `repeat(var(--grid-cols, ${cols.mobile}), minmax(0, 1fr))`,
      }}
    >
      <style jsx>{`
        div {
          --grid-cols: ${cols.mobile};
        }
        @media (min-width: 768px) {
          div {
            --grid-cols: ${cols.tablet};
          }
        }
        @media (min-width: 1024px) {
          div {
            --grid-cols: ${cols.desktop};
          }
        }
      `}</style>
      {children}
    </div>
  );
}

// Stack layout that switches between horizontal/vertical
interface ResponsiveStackProps {
  children: ReactNode;
  className?: string;
  reverseOnMobile?: boolean;
  gap?: "sm" | "md" | "lg";
}

export function ResponsiveStack({
  children,
  className,
  reverseOnMobile = false,
  gap = "md",
}: ResponsiveStackProps) {
  const gapClasses = {
    sm: "gap-2 md:gap-3",
    md: "gap-4 md:gap-6",
    lg: "gap-6 md:gap-8",
  };

  return (
    <div
      className={cn(
        "flex",
        "flex-col md:flex-row",
        reverseOnMobile && "flex-col-reverse md:flex-row",
        gapClasses[gap],
        className
      )}
    >
      {children}
    </div>
  );
}

// Show/hide content based on device
interface ResponsiveShowProps {
  children: ReactNode;
  on: "mobile" | "tablet" | "desktop" | "mobile-tablet" | "tablet-desktop";
  className?: string;
}

export function ResponsiveShow({
  children,
  on,
  className,
}: ResponsiveShowProps) {
  const visibilityClasses = {
    mobile: "block md:hidden",
    tablet: "hidden md:block lg:hidden",
    desktop: "hidden lg:block",
    "mobile-tablet": "block lg:hidden",
    "tablet-desktop": "hidden md:block",
  };

  return (
    <div className={cn(visibilityClasses[on], className)}>
      {children}
    </div>
  );
}

// Hide content based on device
interface ResponsiveHideProps {
  children: ReactNode;
  on: "mobile" | "tablet" | "desktop" | "mobile-tablet" | "tablet-desktop";
  className?: string;
}

export function ResponsiveHide({
  children,
  on,
  className,
}: ResponsiveHideProps) {
  const visibilityClasses = {
    mobile: "hidden md:block",
    tablet: "block md:hidden lg:block",
    desktop: "block lg:hidden",
    "mobile-tablet": "hidden lg:block",
    "tablet-desktop": "block md:hidden",
  };

  return (
    <div className={cn(visibilityClasses[on], className)}>
      {children}
    </div>
  );
}
