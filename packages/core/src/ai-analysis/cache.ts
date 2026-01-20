import { createHash } from 'crypto';

/**
 * Cached analysis result with metadata
 */
export interface CachedAnalysis {
  /** The cached analysis data */
  data: any;
  /** When the cache entry was created */
  createdAt: number;
  /** When the cache entry expires (timestamp in ms) */
  expiresAt: number;
  /** Hash of the context that was analyzed */
  contextHash: string;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

/**
 * In-memory analysis result cache with TTL support.
 *
 * Caches analysis results by context hash to avoid redundant API calls
 * for identical analysis requests. Default TTL is 1 hour (configurable
 * via ANALYSIS_CACHE_TTL_MS environment variable).
 *
 * @example
 * ```typescript
 * const cache = new AnalysisCache();
 *
 * // Try to get from cache
 * const cached = cache.get("Should we add Redis?");
 * if (cached) {
 *   return cached;
 * }
 *
 * // Cache miss - run analysis
 * const result = await runAnalysis(context);
 * cache.set("Should we add Redis?", result);
 * ```
 */
export class AnalysisCache {
  /** Internal cache storage (Map for in-memory, could be Redis for production) */
  private cache: Map<string, CachedAnalysis>;

  /** Cache TTL in milliseconds (default: 1 hour) */
  private ttlMs: number;

  /** Cache statistics */
  private stats = {
    hits: 0,
    misses: 0,
  };

  /**
   * Creates a new AnalysisCache instance
   *
   * @param ttlMs - Time-to-live in milliseconds (default: from ANALYSIS_CACHE_TTL_MS or 1 hour)
   */
  constructor(ttlMs?: number) {
    this.cache = new Map();

    // Read TTL from env var or use provided value or default to 1 hour
    const envTtl = process.env.ANALYSIS_CACHE_TTL_MS;
    this.ttlMs = ttlMs ?? (envTtl ? parseInt(envTtl, 10) : 3600000);
  }

  /**
   * Generates a hash from context string for cache key
   *
   * @param context - The analysis context string
   * @returns SHA-256 hash of the context
   */
  private hashContext(context: string): string {
    return createHash('sha256').update(context).digest('hex');
  }

  /**
   * Gets a cached analysis result if available and not expired
   *
   * @param context - The analysis context to look up
   * @returns Cached analysis data or null if not found or expired
   */
  get(context: string): any | null {
    const hash = this.hashContext(context);
    const cached = this.cache.get(hash);

    if (!cached) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now > cached.expiresAt) {
      // Expired - remove from cache
      this.cache.delete(hash);
      this.stats.misses++;
      return null;
    }

    // Cache hit
    this.stats.hits++;
    return cached.data;
  }

  /**
   * Stores an analysis result in the cache
   *
   * @param context - The analysis context (cache key)
   * @param data - The analysis result to cache
   */
  set(context: string, data: any): void {
    const hash = this.hashContext(context);
    const now = Date.now();

    const cached: CachedAnalysis = {
      data,
      createdAt: now,
      expiresAt: now + this.ttlMs,
      contextHash: hash,
    };

    this.cache.set(hash, cached);
  }

  /**
   * Manually clears a specific cache entry
   *
   * @param context - The analysis context to clear
   * @returns true if entry was deleted, false if not found
   */
  delete(context: string): boolean {
    const hash = this.hashContext(context);
    return this.cache.delete(hash);
  }

  /**
   * Clears all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Gets cache statistics for monitoring
   *
   * @returns Cache statistics including hits, misses, size, hit rate
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate,
    };
  }

  /**
   * Removes all expired entries from the cache (garbage collection)
   *
   * @returns Number of entries removed
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [hash, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(hash);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Gets the current size of the cache
   *
   * @returns Number of entries in the cache
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * Global singleton cache instance for analysis results
 *
 * Use this shared instance across the application to ensure
 * cache hits across multiple analysis requests.
 */
export const globalAnalysisCache = new AnalysisCache();
