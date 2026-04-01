"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Template component for dashboard page transitions.
 * Unlike layout.tsx, template.tsx re-mounts on navigation,
 * making it ideal for entry animations.
 */
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = React.useState(false);

  // Trigger animation on mount/route change
  React.useEffect(() => {
    setIsVisible(false);
    // Small delay to ensure the animation triggers
    const timer = requestAnimationFrame(() => {
      setIsVisible(true);
    });
    return () => cancelAnimationFrame(timer);
  }, [pathname]);

  return (
    <div
      className={`transition-all duration-200 ease-out ${
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-1"
      }`}
      style={{
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
