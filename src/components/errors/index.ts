// Error Boundary Components
export {
  ErrorBoundary,
  withErrorBoundary,
  WidgetErrorBoundary,
  SectionErrorBoundary,
  PageErrorBoundary,
} from "./error-boundary";

// Provider Error Boundary (prevents cascading failures)
export {
  ProviderErrorBoundary,
  withProviderErrorBoundary,
  hasProviderFailed,
  getFailedProviders,
  resetFailedProviders,
} from "./provider-error-boundary";

// Error Display Components
export {
  ErrorFallback,
  InlineError,
  LoadingError,
} from "./error-fallback";

// Error Wrapper Components
export {
  DashboardWidgetWrapper,
  DashboardSectionWrapper,
  AsyncWrapper,
} from "./error-wrapper";

// Branded full-page error card (error.tsx / not-found.tsx)
export { ErrorShell } from "./error-shell";
export type { ErrorShellAction, ErrorShellProps } from "./error-shell";
