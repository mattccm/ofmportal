import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

type MonitorConfig = NonNullable<Parameters<typeof Sentry.withMonitor>[2]>;

interface RunCronOptions {
  /** Error message returned in the 500 JSON body when the job throws */
  errorMessage?: string;
  /** Wrap the job in a Sentry cron monitor so missed or failed runs alert */
  monitor?: { slug: string; config: MonitorConfig };
}

/**
 * Run a cron job body with error reporting and duration logging.
 *
 * Call this after verifyCronAuth so unauthorized hits never count as runs.
 * Errors thrown by `fn` are reported to Sentry tagged with the cron name and
 * turned into a 500 JSON response; the route's own success response is
 * returned unchanged.
 */
export async function runCron(
  name: string,
  fn: () => Promise<NextResponse>,
  options: RunCronOptions = {}
): Promise<NextResponse> {
  const startedAt = Date.now();
  const { monitor, errorMessage = `Cron ${name} failed` } = options;

  try {
    const response = monitor
      ? await Sentry.withMonitor(monitor.slug, fn, monitor.config)
      : await fn();

    console.log(
      `[cron:${name}] finished in ${Date.now() - startedAt}ms (status ${response.status})`
    );
    return response;
  } catch (error) {
    Sentry.captureException(error, { tags: { cron: name } });
    // console.warn rather than console.error: the exception is already
    // reported above and console.error would send a duplicate Sentry event
    console.warn(`[cron:${name}] failed after ${Date.now() - startedAt}ms:`, error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
