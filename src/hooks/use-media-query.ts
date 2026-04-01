"use client";

import { useState, useEffect, useSyncExternalStore } from "react";

/**
 * Generic media query hook using useSyncExternalStore for better SSR compatibility
 * @param query - CSS media query string (e.g., "(min-width: 768px)")
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
  const getSnapshot = () => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  };

  const getServerSnapshot = () => false;

  const subscribe = (callback: () => void) => {
    if (typeof window === "undefined") return () => {};
    const mediaQuery = window.matchMedia(query);
    mediaQuery.addEventListener("change", callback);
    return () => mediaQuery.removeEventListener("change", callback);
  };

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Hook to detect if the viewport is mobile-sized
 * @returns boolean - true if viewport width is less than 768px
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

/**
 * Hook to detect if the viewport is tablet-sized
 * @returns boolean - true if viewport width is between 768px and 1023px
 */
export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
}

/**
 * Hook to detect if the viewport is desktop-sized
 * @returns boolean - true if viewport width is 1024px or larger
 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}

/**
 * Hook to detect if user prefers reduced motion
 * @returns boolean - true if user has enabled reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/**
 * Hook to detect if user prefers dark color scheme
 * @returns boolean - true if user prefers dark mode
 */
export function usePrefersDarkMode(): boolean {
  return useMediaQuery("(prefers-color-scheme: dark)");
}

/**
 * Hook to detect if the device supports touch
 * @returns boolean - true if device has touch capability
 */
export function useIsTouchDevice(): boolean {
  const getSnapshot = () => {
    if (typeof window === "undefined") return false;
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  };

  const getServerSnapshot = () => false;

  const subscribe = () => {
    // Touch capability doesn't change, so no need to subscribe
    return () => {};
  };

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Hook to detect if device is in portrait or landscape orientation
 * @returns "portrait" | "landscape"
 */
export function useOrientation(): "portrait" | "landscape" {
  const isPortrait = useMediaQuery("(orientation: portrait)");
  return isPortrait ? "portrait" : "landscape";
}

/**
 * Hook to get current breakpoint
 * @returns "mobile" | "tablet" | "desktop" | "wide"
 */
export function useBreakpoint(): "mobile" | "tablet" | "desktop" | "wide" {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
  const isDesktop = useMediaQuery("(min-width: 1024px) and (max-width: 1279px)");

  if (isMobile) return "mobile";
  if (isTablet) return "tablet";
  if (isDesktop) return "desktop";
  return "wide";
}

/**
 * Hook to detect safe area insets for notched devices
 * @returns object with top, right, bottom, left inset values
 */
export function useSafeAreaInsets() {
  const [insets, setInsets] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const computeInsets = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      setInsets({
        top: parseInt(computedStyle.getPropertyValue("--sat") || "0", 10) ||
             parseInt(computedStyle.getPropertyValue("env(safe-area-inset-top)") || "0", 10),
        right: parseInt(computedStyle.getPropertyValue("--sar") || "0", 10) ||
               parseInt(computedStyle.getPropertyValue("env(safe-area-inset-right)") || "0", 10),
        bottom: parseInt(computedStyle.getPropertyValue("--sab") || "0", 10) ||
                parseInt(computedStyle.getPropertyValue("env(safe-area-inset-bottom)") || "0", 10),
        left: parseInt(computedStyle.getPropertyValue("--sal") || "0", 10) ||
              parseInt(computedStyle.getPropertyValue("env(safe-area-inset-left)") || "0", 10),
      });
    };

    computeInsets();
    window.addEventListener("resize", computeInsets);

    return () => {
      window.removeEventListener("resize", computeInsets);
    };
  }, []);

  return insets;
}
