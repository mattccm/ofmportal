"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { ErrorFallback } from "./error-fallback";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: unknown[];
  level?: "page" | "section" | "widget";
  showReportButton?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches JavaScript errors anywhere in the child
 * component tree, logs those errors, and displays a fallback UI.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to console for debugging
    console.error("Error Boundary caught an error:", error);
    console.error("Error Info:", errorInfo);

    // Store error info in state for display
    this.setState({ errorInfo });

    // Call optional error handler prop
    this.props.onError?.(error, errorInfo);

    // Log error to external service (can be extended)
    this.logErrorToService(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state if resetKeys changed
    if (this.state.hasError && this.props.resetKeys) {
      const hasChangedKeys = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      if (hasChangedKeys) {
        this.resetError();
      }
    }
  }

  logErrorToService = (error: Error, errorInfo: ErrorInfo): void => {
    // In production, send to error tracking service (e.g., Sentry, LogRocket)
    const errorLog = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: typeof window !== "undefined" ? window.location.href : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    };

    // For now, just log to console in a structured format
    console.group("Error Log");
    console.log("Timestamp:", errorLog.timestamp);
    console.log("URL:", errorLog.url);
    console.log("Message:", errorLog.message);
    console.log("Stack:", errorLog.stack);
    console.log("Component Stack:", errorLog.componentStack);
    console.groupEnd();

    // TODO: Send to actual error tracking service
    // fetch('/api/log-error', { method: 'POST', body: JSON.stringify(errorLog) });
  };

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReport = (): void => {
    const { error, errorInfo } = this.state;

    // Create error report
    const report = {
      error: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      url: typeof window !== "undefined" ? window.location.href : "",
      timestamp: new Date().toISOString(),
    };

    // Copy to clipboard for manual reporting
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      alert("Error report copied to clipboard. Please send to support.");
    }

    console.log("Error Report:", report);
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Render custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Render default error fallback
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.resetError}
          onReport={this.props.showReportButton !== false ? this.handleReport : undefined}
          level={this.props.level}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-friendly wrapper for ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<ErrorBoundaryProps, "children">
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...options}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || "Component"})`;

  return WrappedComponent;
}

/**
 * Simple error boundary for widgets/small sections
 */
export function WidgetErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary level="widget" showReportButton={false}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error boundary for page sections
 */
export function SectionErrorBoundary({
  children,
  onError,
}: {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}) {
  return (
    <ErrorBoundary level="section" onError={onError}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error boundary for full pages
 */
export function PageErrorBoundary({
  children,
  onError,
}: {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}) {
  return (
    <ErrorBoundary level="page" onError={onError} showReportButton>
      {children}
    </ErrorBoundary>
  );
}
