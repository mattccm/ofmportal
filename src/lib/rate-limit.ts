export interface RateLimitConfig {
  interval: number; // in milliseconds
  maxRequests: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

// Simple in-memory cache for rate limiting
// In production, consider using Redis for distributed rate limiting
const rateLimitCache = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
let lastCleanup = Date.now();

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitCache.entries()) {
    if (now >= entry.resetAt) {
      rateLimitCache.delete(key);
    }
  }

  // Limit cache size to prevent memory issues
  if (rateLimitCache.size > 10000) {
    const entries = Array.from(rateLimitCache.entries());
    entries.sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (let i = 0; i < entries.length - 5000; i++) {
      rateLimitCache.delete(entries[i][0]);
    }
  }
}

/**
 * Rate limiter using in-memory Map
 * For production, consider using Redis for distributed rate limiting
 */
export function rateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpired();

  const now = Date.now();
  const entry = rateLimitCache.get(key);

  // If no entry exists or it has expired, create a new one
  if (!entry || now >= entry.resetAt) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.interval,
    };
    rateLimitCache.set(key, newEntry);

    return {
      success: true,
      remaining: config.maxRequests - 1,
      reset: newEntry.resetAt,
    };
  }

  // Entry exists and hasn't expired
  const newCount = entry.count + 1;

  if (newCount > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      success: false,
      remaining: 0,
      reset: entry.resetAt,
      retryAfter,
    };
  }

  // Update count
  entry.count = newCount;
  rateLimitCache.set(key, entry);

  return {
    success: true,
    remaining: config.maxRequests - newCount,
    reset: entry.resetAt,
  };
}

// Common rate limit configurations
export const RATE_LIMITS = {
  // Login: 5 attempts per 15 minutes per IP
  login: {
    interval: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },
  // API general: 100 requests per minute per user
  api: {
    interval: 60 * 1000, // 1 minute
    maxRequests: 100,
  },
  // Uploads: 20 uploads per minute per user
  upload: {
    interval: 60 * 1000, // 1 minute
    maxRequests: 20,
  },
  // Password reset: 3 attempts per hour per email
  passwordReset: {
    interval: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
  },
} as const;

/**
 * Get client IP from request headers
 */
export function getClientIp(headers: Headers): string {
  // Check common proxy headers
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, use the first one
    return forwarded.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback for local development
  return "127.0.0.1";
}
