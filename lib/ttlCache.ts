/**
 * Minimal in-memory TTL cache with a bounded size (evicts the oldest entry when full).
 *
 * Extracted because the suggest/prices/trains/hotels/itinerary routes each rolled the
 * same Map + timestamp + TTL-expiry + evict-oldest pattern by hand (and three of them
 * forgot the size bound — an unbounded Map is a slow memory leak). One implementation,
 * five call sites.
 *
 * Note: this is per-process (module-scoped Map). On a multi-instance / serverless deploy
 * each instance has its own cache; the durable cross-instance cache is SQLite (geocode).
 */
export interface TtlCache<T> {
  get(key: string): T | null;
  set(key: string, value: T): void;
}

export function createTtlCache<T>(opts: { ttlMs: number; max: number }): TtlCache<T> {
  const { ttlMs, max } = opts;
  const store = new Map<string, { value: T; timestamp: number }>();

  return {
    get(key: string): T | null {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() - entry.timestamp > ttlMs) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    set(key: string, value: T): void {
      if (store.size >= max && !store.has(key)) {
        // Evict the oldest entry (Map preserves insertion order).
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, { value, timestamp: Date.now() });
    },
  };
}
