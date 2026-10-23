import * as Sentry from "@sentry/nextjs";

const SENSITIVE_HEADERS = ["x-creator-token", "cookie", "authorization"];

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: process.env.NODE_ENV === "production",

  sendDefaultPii: false,

  tracesSampleRate: 0.1,

  // API routes catch their errors and console.error them instead of rethrowing,
  // so report those logs too or almost no server errors would reach Sentry
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],

  ignoreErrors: [
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
  ],

  // Strip credentials and query strings before events leave the server.
  beforeSend(event) {
    const headers = event.request?.headers;
    if (headers) {
      for (const name of Object.keys(headers)) {
        if (SENSITIVE_HEADERS.includes(name.toLowerCase())) {
          headers[name] = "[redacted]";
        }
      }
    }
    if (event.request?.query_string) {
      event.request.query_string = "[redacted]";
    }
    if (event.request?.url) {
      event.request.url = event.request.url.split("?")[0];
    }
    return event;
  },
});
