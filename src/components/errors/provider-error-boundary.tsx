"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface ProviderErrorBoundaryProps {
  children: ReactNode;
  /** Name of the provider for logging */
  providerName: string;
  /** Fallback UI - defaults to rendering children without provider context */
  fallback?: ReactNode;
  /** Whether to show a visible error indicator */
  showErrorIndicator?: boolean;
  /** Callback when an error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ProviderErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary specifically designed for context providers.
 *
 * Key behaviors:
 * 1. Catches errors in provider initialization/rendering
 * 2. Allows sibling providers to continue working
 * 3. Renders children without the failed provider's context
 * 4. Logs errors for debugging without crashing the app
 *
 * This prevents cascading failures where one provider's error
 * takes down the entire application.
 */
export class ProviderErrorBoundary extends Component<
  ProviderErrorBoundaryProps,
  ProviderErrorBoundaryState
> {
  constructor(props: ProviderErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ProviderErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { providerName, onError } = this.props;

    // Log the error with provider context
    console.error(`[ProviderErrorBoundary] ${providerName} failed:`, error);
    console.error("Component stack:", errorInfo.componentStack);

    // Log structured error for debugging
    console.group(`Provider Error: ${providerName}`);
    console.log("Error:", error.message);
    console.log("Stack:", error.stack);
    console.log("Provider:", providerName);
    console.log("Timestamp:", new Date().toISOString());
    console.groupEnd();

    // Call optional error handler
    onError?.(error, errorInfo);

    // Track which providers have failed (for potential recovery UI)
    if (typeof window !== "undefined") {
      (window as Window & { __failedProviders?: string[] }).__failedProviders =
        (window as Window & { __failedProviders?: string[] }).__failedProviders || [];
      (window as Window & { __failedProviders?: string[] }).__failedProviders.push(providerName);
    }
  }

  render(): ReactNode {
    const { hasError } = this.state;
    const { children, fallback, providerName, showErrorIndicator } = this.props;

    if (hasError) {
      // If a custom fallback is provided, use it
      if (fallback !== undefined) {
        return fallback;
      }

      // Default behavior: render children without the provider
      // This allows the app to continue working, just without this feature
      return (
        <>
          {showErrorIndicator && (
            <div
              style={{
                position: "fixed",
                bottom: "1rem",
                right: "1rem",
                padding: "0.5rem 1rem",
                background: "rgba(239, 68, 68, 0.9)",
                color: "white",
                borderRadius: "0.5rem",
                fontSize: "0.75rem",
                zIndex: 9999,
                maxWidth: "200px",
              }}
            >
              {providerName} unavailable
            </div>
          )}
          {children}
        </>
      );
    }

    return children;
  }
}

/**
 * HOC to wrap a provider with error boundary protection
 */
export function withProviderErrorBoundary<P extends { children: ReactNode }>(
  ProviderComponent: React.ComponentType<P>,
  providerName: string,
  options?: Omit<ProviderErrorBoundaryProps, "children" | "providerName">
) {
  const WrappedProvider = (props: P) => (
    <ProviderErrorBoundary providerName={providerName} {...options}>
      <ProviderComponent {...props} />
    </ProviderErrorBoundary>
  );

  WrappedProvider.displayName = `withProviderErrorBoundary(${providerName})`;

  return WrappedProvider;
}

/**
 * Utility to check if a provider has failed
 */
export function hasProviderFailed(providerName: string): boolean {
  if (typeof window === "undefined") return false;
  const failedProviders = (window as Window & { __failedProviders?: string[] }).__failedProviders;
  return failedProviders?.includes(providerName) ?? false;
}

/**
 * Utility to get all failed providers
 */
export function getFailedProviders(): string[] {
  if (typeof window === "undefined") return [];
  return (window as Window & { __failedProviders?: string[] }).__failedProviders || [];
}

/**
 * Reset the failed providers list (useful for recovery)
 */
export function resetFailedProviders(): void {
  if (typeof window !== "undefined") {
    (window as Window & { __failedProviders?: string[] }).__failedProviders = [];
  }
}

export default ProviderErrorBoundary;
