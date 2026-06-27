/**
 * TTL-based failure blacklist, shared by the AI layer.
 *
 * The same Map + timestamp + status→TTL + evict-on-expiry pattern was hand-written three
 * times: per-provider in ai.ts and per-model in agnes.ts / openrouter.ts. One implementation
 * now. A "key" is a provider name (ai.ts) or a model id (the providers).
 *
 * Default TTLs match the originals: 429 (rate limit) → 60s, 402 (insufficient credits) →
 * 24h, 404 (missing model/endpoint) → 1h, anything else → defaultTtlMs (60s). Callers can
 * override via ttlForStatus to preserve their env-configurable knobs (e.g. *_402_TTL_MS).
 */
export interface HealthCache {
  /** True if this key failed recently and is still within its cooldown TTL. */
  isBlacklisted(key: string): boolean;
  /** Record a failure for this key; cooldown length derived from the HTTP status. */
  markFailed(key: string, status: number, error?: string): void;
  /** Stable reorder: healthy keys first, blacklisted ones last (never dropped). */
  prioritize(keys: string[]): string[];
}

interface HealthEntry { failedAt: number; ttl: number; error?: string }

export function createHealthCache(opts: {
  /** Human label for log lines, e.g. "provider", "Agnes model". */
  label: string;
  /** TTL (ms) for statuses not special-cased. Defaults to 60s. */
  defaultTtlMs?: number;
  /** Override the status→TTL mapping (defaults: 429→60s, 402→24h, 404→1h). */
  ttlForStatus?: (status: number) => number;
}): HealthCache {
  const defaultTtl = opts.defaultTtlMs ?? 60_000;
  const ttlForStatus =
    opts.ttlForStatus ??
    ((status: number) => {
      if (status === 429) return 60 * 1000;
      if (status === 402) return 24 * 60 * 60 * 1000;
      if (status === 404) return 60 * 60 * 1000;
      return defaultTtl;
    });

  const health = new Map<string, HealthEntry>();

  return {
    isBlacklisted(key: string): boolean {
      const entry = health.get(key);
      if (!entry) return false;
      if (Date.now() - entry.failedAt > entry.ttl) {
        health.delete(key);
        return false;
      }
      return true;
    },
    markFailed(key: string, status: number, error?: string): void {
      const ttl = ttlForStatus(status);
      health.set(key, { failedAt: Date.now(), ttl, error });
      console.warn(`Marked ${opts.label} ${key} unhealthy for ${ttl / 1000}s: ${error ?? ""}`);
    },
    prioritize(keys: string[]): string[] {
      const healthy = keys.filter((k) => !this.isBlacklisted(k));
      if (healthy.length === keys.length) return keys;
      const blacklisted = keys.filter((k) => this.isBlacklisted(k));
      return [...healthy, ...blacklisted];
    },
  };
}
