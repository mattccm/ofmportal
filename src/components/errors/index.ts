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
