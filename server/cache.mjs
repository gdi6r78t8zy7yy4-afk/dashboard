/**
 * Minimal in-memory TTL cache shared by data adapters.
 *
 * Northwatch runs as a single Node process, so an in-memory cache is sufficient
 * for production: it protects upstream APIs (ENTSO-E, RIPEstat, IODA,
 * Open-Meteo, ...) from being hit on every dashboard request, while stale
 * entries can keep being served when a refresh fails.
 */
export function createTtlCache(ttlMs = 5 * 60 * 1000, { maxEntries = 1000 } = {}) {
  const entries = new Map()

  function isFresh(key) {
    const entry = entries.get(key)
    return Boolean(entry && entry.expiresAt > Date.now())
  }

  /** Returns the cached value, or null when absent or expired. */
  function get(key) {
    const entry = entries.get(key)
    if (!entry) return null
    if (entry.expiresAt <= Date.now()) {
      entries.delete(key)
      return null
    }
    // LRU-ish: move the most recently used entry to the end.
    entries.delete(key)
    entries.set(key, entry)
    return entry.data
  }

  /** Returns the cached value even when expired (for stale fallbacks). */
  function peek(key) {
    return entries.get(key)?.data ?? null
  }

  function set(key, data, ttl = ttlMs) {
    if (entries.size >= maxEntries) {
      const oldest = entries.keys().next().value
      entries.delete(oldest)
    }
    entries.set(key, { data, expiresAt: Date.now() + ttl })
  }

  function clear() {
    entries.clear()
  }

  return { get, set, peek, isFresh, clear, size: () => entries.size }
}
