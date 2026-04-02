/**
 * Fetch with timeout and retry capabilities
 *
 * Prevents indefinite hangs and provides automatic retry with exponential backoff.
 */

export interface FetchWithTimeoutOptions extends RequestInit {
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Number of retry attempts (default: 0) */
  retries?: number;
  /** Base delay between retries in ms (default: 1000) */
  retryDelay?: number;
  /** Maximum delay between retries in ms (default: 10000) */
  maxRetryDelay?: number;
  /** Callback when a retry attempt is made */
  onRetry?: (attempt: number, error: Error) => void;
}

export class FetchTimeoutError extends Error {
  constructor(url: string, timeout: number) {
    super(`Request to ${url} timed out after ${timeout}ms`);
    this.name = "FetchTimeoutError";
  }
}

export class FetchRetryError extends Error {
  lastError: Error;
  attempts: number;

  constructor(url: string, attempts: number, lastError: Error) {
    super(`Request to ${url} failed after ${attempts} attempts: ${lastError.message}`);
    this.name = "FetchRetryError";
    this.lastError = lastError;
    this.attempts = attempts;
  }
}

/**
 * Fetch with automatic timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeout = 10000,
    retries = 0,
    retryDelay = 1000,
    maxRetryDelay = 10000,
    onRetry,
    ...fetchOptions
  } = options;

  let lastError: Error = new Error("Unknown error");
  let attempt = 0;

  while (attempt <= retries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error) {
          if (error.name === "AbortError") {
            throw new FetchTimeoutError(url, timeout);
          }
          throw error;
        }
        throw new Error("Unknown fetch error");
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");

      // Don't retry on timeout errors
      if (error instanceof FetchTimeoutError) {
        throw error;
      }

      attempt++;

      if (attempt <= retries) {
        // Calculate delay with exponential backoff
        const delay = Math.min(retryDelay * Math.pow(2, attempt - 1), maxRetryDelay);
        onRetry?.(attempt, lastError);

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new FetchRetryError(url, attempt, lastError);
}

/**
 * Fetch JSON with timeout and automatic parsing
 */
export async function fetchJsonWithTimeout<T>(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<T> {
  const response = await fetchWithTimeout(url, options);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error("Failed to parse JSON response");
  }
}

/**
 * Create a fetch function with default timeout settings
 */
export function createFetchWithTimeout(defaultOptions: FetchWithTimeoutOptions) {
  return (url: string, options: FetchWithTimeoutOptions = {}) =>
    fetchWithTimeout(url, { ...defaultOptions, ...options });
}

/**
 * Widget-specific fetch with appropriate timeouts
 * - Shorter timeout for widgets (5 seconds)
 * - One retry attempt
 */
export const widgetFetch = createFetchWithTimeout({
  timeout: 5000,
  retries: 1,
  retryDelay: 500,
});

/**
 * API fetch with standard settings
 * - 10 second timeout
 * - No retries by default
 */
export const apiFetch = createFetchWithTimeout({
  timeout: 10000,
  retries: 0,
});

export default fetchWithTimeout;
