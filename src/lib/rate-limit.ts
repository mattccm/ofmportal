import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// TYPES

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

// REDIS CLIENT (lazy initialized)

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

/**
 * Check if Redis is available for distributed rate limiting
 */
export function isRedisAvailable(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// UPSTASH RATELIMIT INSTANCES (cached)

const ratelimitInstances = new Map<string, Ratelimit>();

function getUpstashRatelimit(config: RateLimitConfig): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;

  const cacheKey = `${config.maxRequests}:${config.interval}`;
  const existing = ratelimitInstances.get(cacheKey);
  if (existing) return existing;

  const instance = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(config.maxRequests, `${config.interval} ms`),
    analytics: true,
    prefix: "ratelimit",
  });

  ratelimitInstances.set(cacheKey, instance);
  return instance;
}

// IN-MEMORY FALLBACK (for dev / when Redis unavailable)

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitCache = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60 * 1000;
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

  if (rateLimitCache.size > 10000) {
    const entries = Array.from(rateLimitCache.entries());
    entries.sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (let i = 0; i < entries.length - 5000; i++) {
      rateLimitCache.delete(entries[i][0]);
    }
  }
}

function memoryRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  cleanupExpired();

  const now = Date.now();
  const entry = rateLimitCache.get(key);

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

  entry.count = newCount;
  rateLimitCache.set(key, entry);

  return {
    success: true,
    remaining: config.maxRequests - newCount,
    reset: entry.resetAt,
  };
}

// MAIN RATE LIMIT FUNCTION
// Uses Redis when available, falls back to in-memory

export async function rateLimitAsync(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const upstash = getUpstashRatelimit(config);

  if (upstash) {
    try {
      const result = await upstash.limit(key);
      return {
        success: result.success,
        remaining: result.remaining,
        reset: result.reset,
        retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
      };
    } catch (error) {
      // Redis failed — fall back to in-memory
      console.error("[RateLimit] Redis error, falling back to memory:", error);
      return memoryRateLimit(key, config);
    }
  }

  return memoryRateLimit(key, config);
}

/**
 * Synchronous rate limiter (in-memory only, for backwards compatibility)
 * Prefer rateLimitAsync when possible for Redis-backed limiting
 */
export function rateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  return memoryRateLimit(key, config);
}

// COMMON RATE LIMIT CONFIGURATIONS

export const RATE_LIMITS = {
  // Login: 5 attempts per 15 minutes per IP
  login: {
    interval: 15 * 60 * 1000,
    maxRequests: 5,
  },
  // Password change: 5 attempts per 15 minutes per account + IP
  passwordChange: {
    interval: 15 * 60 * 1000,
    maxRequests: 5,
  },
  // 2FA setup/verify/disable/backup codes: 10 attempts per 15 minutes per account + IP
  // (a little looser than login so a mistyped code or QR re-scan doesn't lock users out)
  twoFactor: {
    interval: 15 * 60 * 1000,
    maxRequests: 10,
  },
  // API general: 100 requests per minute per user
  api: {
    interval: 60 * 1000,
    maxRequests: 100,
  },
  // Uploads: 20 uploads per minute per user
  upload: {
    interval: 60 * 1000,
    maxRequests: 20,
  },
  // Password reset: 3 attempts per hour per email
  passwordReset: {
    interval: 60 * 60 * 1000,
    maxRequests: 3,
  },
  // Webhook delivery: 1000 per minute (outgoing)
  webhook: {
    interval: 60 * 1000,
    maxRequests: 1000,
  },
} as const;

// UTILITY: Get client IP

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "127.0.0.1";
}

// REDIS CACHE UTILITIES (for general caching)

/**
 * Get a value from Redis cache
 */
export async function redisGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;

  try {
    return await r.get<T>(key);
  } catch {
    return null;
  }
}

/**
 * Set a value in Redis cache with TTL
 */
export async function redisSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const r = getRedis();
  if (!r) return;

  try {
    await r.set(key, value, { ex: ttlSeconds });
  } catch (error) {
    console.error("[Redis] Set failed:", error);
  }
}

/**
 * Delete a key from Redis
 */
export async function redisDel(key: string): Promise<void> {
  const r = getRedis();
  if (!r) return;

  try {
    await r.del(key);
  } catch (error) {
    console.error("[Redis] Del failed:", error);
  }
}
