/**
 * In-memory caching utilities for scaling to 100+ creators
 * Reduces database load for frequently accessed data
 */

// ============================================
// TYPES
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  staleWhileRevalidate?: boolean;
}

// ============================================
// MEMORY CACHE
// ============================================

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Run cleanup every minute
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }
  }

  /**
   * Get a cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set a cached value
   */
  set<T>(key: string, data: T, ttl: number = 60000): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  /**
   * Delete a cached value
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Delete all keys matching a pattern
   */
  deletePattern(pattern: string): number {
    let deleted = 0;
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Clear all cached values
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get or set with factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const { ttl = 60000 } = options;

    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await factory();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const cache = new MemoryCache();

// ============================================
// CACHE KEY GENERATORS
// ============================================

export const cacheKeys = {
  // Agency-level caches
  agencyCreators: (agencyId: string) => `agency:${agencyId}:creators`,
  agencyCreatorsCount: (agencyId: string) => `agency:${agencyId}:creators:count`,
  agencyRequests: (agencyId: string, filters?: string) =>
    `agency:${agencyId}:requests${filters ? `:${filters}` : ""}`,
  agencyRequestsCount: (agencyId: string) => `agency:${agencyId}:requests:count`,
  agencyStats: (agencyId: string) => `agency:${agencyId}:stats`,
  agencyTemplates: (agencyId: string) => `agency:${agencyId}:templates`,

  // Creator-level caches
  creatorUploads: (creatorId: string) => `creator:${creatorId}:uploads`,
  creatorRequests: (creatorId: string) => `creator:${creatorId}:requests`,
  creatorStats: (creatorId: string) => `creator:${creatorId}:stats`,

  // Request-level caches
  requestUploads: (requestId: string) => `request:${requestId}:uploads`,
  requestComments: (requestId: string) => `request:${requestId}:comments`,

  // User-level caches
  userNotifications: (userId: string) => `user:${userId}:notifications`,
  userPreferences: (userId: string) => `user:${userId}:preferences`,
};

// ============================================
// CACHE TTL CONSTANTS (in milliseconds)
// ============================================

export const cacheTTL = {
  // Short-lived (30 seconds) - frequently changing data
  SHORT: 30 * 1000,

  // Medium (2 minutes) - semi-static data
  MEDIUM: 2 * 60 * 1000,

  // Long (5 minutes) - rarely changing data
  LONG: 5 * 60 * 1000,

  // Very long (15 minutes) - static reference data
  VERY_LONG: 15 * 60 * 1000,

  // Dashboard stats
  DASHBOARD_STATS: 60 * 1000,

  // Creator list
  CREATOR_LIST: 30 * 1000,

  // Templates (rarely change)
  TEMPLATES: 5 * 60 * 1000,
};

// ============================================
// CACHE INVALIDATION HELPERS
// ============================================

export const invalidateCache = {
  /**
   * Invalidate all agency-related caches
   */
  agency: (agencyId: string) => {
    cache.deletePattern(`agency:${agencyId}:`);
  },

  /**
   * Invalidate creator-related caches
   */
  creator: (creatorId: string, agencyId?: string) => {
    cache.deletePattern(`creator:${creatorId}:`);
    if (agencyId) {
      cache.delete(cacheKeys.agencyCreators(agencyId));
      cache.delete(cacheKeys.agencyCreatorsCount(agencyId));
    }
  },

  /**
   * Invalidate request-related caches
   */
  request: (requestId: string, agencyId?: string) => {
    cache.deletePattern(`request:${requestId}:`);
    if (agencyId) {
      cache.deletePattern(`agency:${agencyId}:requests`);
    }
  },

  /**
   * Invalidate user-related caches
   */
  user: (userId: string) => {
    cache.deletePattern(`user:${userId}:`);
  },

  /**
   * Invalidate all caches (use sparingly)
   */
  all: () => {
    cache.clear();
  },
};

// ============================================
// REACT QUERY CACHE CONFIG
// ============================================

export const queryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
};

// ============================================
// QUERY KEYS FOR REACT QUERY
// ============================================

export const queryKeys = {
  creators: {
    all: ["creators"] as const,
    list: (filters?: Record<string, unknown>) => ["creators", "list", filters] as const,
    detail: (id: string) => ["creators", "detail", id] as const,
    stats: (id: string) => ["creators", "stats", id] as const,
  },
  requests: {
    all: ["requests"] as const,
    list: (filters?: Record<string, unknown>) => ["requests", "list", filters] as const,
    detail: (id: string) => ["requests", "detail", id] as const,
    uploads: (id: string) => ["requests", "uploads", id] as const,
  },
  uploads: {
    all: ["uploads"] as const,
    list: (filters?: Record<string, unknown>) => ["uploads", "list", filters] as const,
    detail: (id: string) => ["uploads", "detail", id] as const,
  },
  dashboard: {
    stats: ["dashboard", "stats"] as const,
    activity: ["dashboard", "activity"] as const,
    deadlines: ["dashboard", "deadlines"] as const,
    performance: ["dashboard", "performance"] as const,
  },
  templates: {
    all: ["templates"] as const,
    list: () => ["templates", "list"] as const,
    detail: (id: string) => ["templates", "detail", id] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    unreadCount: ["notifications", "unreadCount"] as const,
  },
};
