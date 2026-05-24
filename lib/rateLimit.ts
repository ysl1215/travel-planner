/**
 * Simple in-memory sliding-window rate limiter.
 * Keyed by IP. Not suitable for multi-instance deployments (use Redis there).
 */

const windows = new Map<string, number[]>();

/**
 * Returns true if the request should be allowed.
 * @param key      Identifier (e.g. IP address)
 * @param limit    Max requests per window
 * @param windowMs Window size in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = (windows.get(key) ?? []).filter((t) => t > cutoff);
  if (timestamps.length >= limit) return false;
  timestamps.push(now);
  windows.set(key, timestamps);
  return true;
}
