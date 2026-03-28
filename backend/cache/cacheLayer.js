/**
 * Cache Layer
 *
 * In-memory cache with configurable TTL.
 * Wraps node-cache for simplicity. In production, swap for Redis.
 *
 * Cache keys:
 *   score:{ticker}         → free CompanyIQ score
 *   report:{ticker}:{type} → full report object
 *   agent:{ticker}:{agent} → raw agent extraction data
 */

import NodeCache from "node-cache";
import config from "../config/env.js";

const ttlSeconds = config.cache.ttlHours * 3600;

const cache = new NodeCache({
  stdTTL: ttlSeconds,
  checkperiod: ttlSeconds * 0.2, // Cleanup interval: 20% of TTL
  useClones: false, // Performance: don't deep clone on get
});

// Single-flight map: avoids duplicate expensive recomputation for the same key.
// Each entry stores { promise, startedAt } so we can expire stale entries.
const inFlight = new Map();
const IN_FLIGHT_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes max in-flight time

/**
 * Get a cached value, or compute it fresh and store it.
 *
 * @param {string} key       - Cache key
 * @param {function} freshFn - Async function to compute fresh value if cache miss
 * @returns {any} The cached or freshly computed value (raw, no wrapper)
 */
export async function getCachedOrFresh(key, freshFn) {
  // 1. Check cache
  const cached = cache.get(key);
  if (cached !== undefined) {
    console.log(`[Cache] HIT: ${key}`);
    return cached;
  }

  // 1b. Reuse in-flight computation if one is already running for this key,
  // but only if it hasn't grown stale (prevents stuck browser tabs from blocking new requests).
  const existing = inFlight.get(key);
  if (existing) {
    const ageMs = Date.now() - existing.startedAt;
    if (ageMs < IN_FLIGHT_MAX_AGE_MS) {
      console.log(`[Cache] IN-FLIGHT: ${key} — awaiting existing computation (${Math.round(ageMs / 1000)}s old)...`);
      return existing.promise;
    }
    console.warn(`[Cache] IN-FLIGHT EXPIRED: ${key} — stale after ${Math.round(ageMs / 1000)}s, starting fresh.`);
    inFlight.delete(key);
  }

  console.log(`[Cache] MISS: ${key} — computing fresh...`);

  // 2. Compute fresh
  const promise = (async () => {
    try {
      const fresh = await freshFn();
      cache.set(key, fresh);
      return fresh;
    } catch (error) {
      // 3. Fallback: try stale/expired value (node-cache may still have it in memory)
      // Note: node-cache deletes expired keys, so this is a safety net only
      console.error(`[Cache] Fresh computation failed for ${key}:`, error.message);
      throw error;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, { promise, startedAt: Date.now() });
  return promise;
}

/**
 * Manually set a cache entry.
 */
export function setCache(key, value, customTtlSeconds = undefined) {
  if (customTtlSeconds !== undefined) {
    cache.set(key, value, customTtlSeconds);
  } else {
    cache.set(key, value);
  }
}

/**
 * Manually get a cache entry.
 */
export function getCache(key) {
  return cache.get(key);
}

/**
 * Delete a cache entry.
 */
export function deleteCache(key) {
  return cache.del(key);
}

/**
 * Remove an in-flight singleton entry so a force-refresh can start a fresh computation.
 */
export function clearInFlight(key) {
  return inFlight.delete(key);
}

/**
 * Get cache statistics.
 */
export function getCacheStats() {
  return {
    ...cache.getStats(),
    inFlight: inFlight.size,
  };
}

export default { getCachedOrFresh, setCache, getCache, deleteCache, clearInFlight, getCacheStats };
