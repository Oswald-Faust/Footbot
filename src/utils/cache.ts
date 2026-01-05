import NodeCache from 'node-cache';
import { logger } from './logger.js';

// Default TTL: 30 minutes
const DEFAULT_TTL = 60 * 30;

export const cache = new NodeCache({
  stdTTL: DEFAULT_TTL,
  checkperiod: 120,
  useClones: false,
});

/**
 * Get cached value or fetch and cache it
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds?: number
): Promise<T> {
  const cached = cache.get<T>(key);
  
  if (cached !== undefined) {
    logger.debug(`Cache hit for key: ${key}`);
    return cached;
  }
  
  logger.debug(`Cache miss for key: ${key}`);
  const data = await fetchFn();
  cache.set(key, data, ttlSeconds ?? DEFAULT_TTL);
  
  return data;
}

/**
 * Invalidate cache for a specific key
 */
export function invalidateCache(key: string): void {
  cache.del(key);
  logger.debug(`Cache invalidated for key: ${key}`);
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  cache.flushAll();
  logger.info('All cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return cache.getStats();
}
