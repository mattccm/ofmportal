"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

interface SkipLinksProps {
  links?: Array<{
    href: string;
    label: string;
  }>;
  className?: string;
}

// ============================================
// SKIP LINK COMPONENT
// ============================================

/**
 * Individual skip link that becomes visible when focused.
 * Allows keyboard users to bypass repeated navigation.
 */
export function SkipLink({ href, children, className }: SkipLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    const targetId = href.replace("#", "");
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
      // Remove tabindex if it was temporarily added
      const hadTabIndex = targetElement.hasAttribute("tabindex");

      // Make element focusable if it isn't already
      if (!hadTabIndex) {
        targetElement.setAttribute("tabindex", "-1");
      }

      // Focus the target element
      targetElement.focus({ preventScroll: false });

      // Scroll element into view
      targetElement.scrollIntoView({ behavior: "smooth", block: "start" });

      // Remove tabindex after blur if we added it
      if (!hadTabIndex) {
        targetElement.addEventListener(
          "blur",
          () => targetElement.removeAttribute("tabindex"),
          { once: true }
        );
      }
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className={cn(
        // Hidden by default, visible when focused
        "sr-only focus:not-sr-only",
        // Fixed positioning at top of page
        "focus:fixed focus:top-4 focus:left-4 focus:z-[9999]",
        // Visual styles when visible
        "focus:block focus:px-4 focus:py-2",
        "focus:bg-primary focus:text-primary-foreground",
        "focus:rounded-lg focus:shadow-lg",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        // Typography
        "focus:text-sm focus:font-medium",
        // Smooth appearance
        "focus:animate-in focus:fade-in-0 focus:zoom-in-95",
        "transition-all duration-200",
        className
      )}
    >
      {children}
    </a>
  );
}

// ============================================
// SKIP LINKS CONTAINER
// ============================================

/**
 * Container for multiple skip links.
 * Provides default skip links for main content and navigation.
 */
export function SkipLinks({ links, className }: SkipLinksProps) {
  const defaultLinks = [
    { href: "#main-content", label: "Skip to main content" },
    { href: "#main-nav", label: "Skip to navigation" },
  ];

  const skipLinks = links || defaultLinks;

  return (
    <div
      className={cn(
        "skip-links-container",
        // Stacking context for multiple skip links
        "fixed top-0 left-0 z-[9999]",
        className
      )}
      role="navigation"
      aria-label="Skip links"
    >
      {skipLinks.map((link, index) => (
        <SkipLink
          key={link.href}
          href={link.href}
          className={cn(
            // Stack multiple skip links when focused
            index > 0 && "focus:top-14"
          )}
        >
          {link.label}
        </SkipLink>
      ))}
    </div>
  );
}

// ============================================
// LANDMARK TARGETS
// ============================================

interface MainContentProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

/**
 * Main content landmark with proper ID for skip links.
 */
export function MainContent({ children, className, ...props }: MainContentProps) {
  return (
    <main
      id="main-content"
      className={cn("focus:outline-none", className)}
      tabIndex={-1}
      {...props}
    >
      {children}
    </main>
  );
}

interface MainNavProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

/**
 * Main navigation landmark with proper ID for skip links.
 */
export function MainNav({ children, className, ...props }: MainNavProps) {
  return (
    <nav
      id="main-nav"
      aria-label="Main navigation"
      className={cn("focus:outline-none", className)}
      tabIndex={-1}
      {...props}
    >
      {children}
    </nav>
  );
}

// ============================================
// EXPORTS
// ============================================

export default SkipLinks;
