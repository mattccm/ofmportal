import * as Sentry from "@sentry/nextjs";

// Signed R2 URLs and invite/reset links carry credentials in the query string
const stripQuery = (url: string) => url.split("?")[0];

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // No routine session recording (creator content is sensitive); only replay
  // the moments around an error, with all text masked and media blocked
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // Filter out noisy errors
  ignoreErrors: [
    "ResizeObserver loop",
    "AbortError",
    "Network request failed",
    "Load failed",
    "ChunkLoadError",
  ],

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  beforeSend(event) {
    if (event.request?.url) event.request.url = stripQuery(event.request.url);
    if (event.request?.query_string) event.request.query_string = "[redacted]";
    return event;
  },

  beforeBreadcrumb(breadcrumb) {
    const data = breadcrumb.data;
    if (data) {
      if (typeof data.url === "string") data.url = stripQuery(data.url);
      if (typeof data.from === "string") data.from = stripQuery(data.from);
      if (typeof data.to === "string") data.to = stripQuery(data.to);
    }
    return breadcrumb;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
