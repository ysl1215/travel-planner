import { describe, it, expect, vi, afterEach } from "vitest";
import { createTtlCache } from "../ttlCache";

describe("createTtlCache", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("returns null for a missing key and stores/retrieves a value", () => {
    const c = createTtlCache<number>({ ttlMs: 1000, max: 10 });
    expect(c.get("a")).toBeNull();
    c.set("a", 42);
    expect(c.get("a")).toBe(42);
  });

  it("expires entries after the TTL", () => {
    vi.useFakeTimers();
    const c = createTtlCache<string>({ ttlMs: 1000, max: 10 });
    c.set("k", "v");
    expect(c.get("k")).toBe("v");
    vi.advanceTimersByTime(1001);
    expect(c.get("k")).toBeNull();
  });

  it("evicts the oldest entry when over the size bound", () => {
    const c = createTtlCache<number>({ ttlMs: 60_000, max: 2 });
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3); // should evict "a" (oldest)
    expect(c.get("a")).toBeNull();
    expect(c.get("b")).toBe(2);
    expect(c.get("c")).toBe(3);
  });

  it("updating an existing key does not trigger eviction", () => {
    const c = createTtlCache<number>({ ttlMs: 60_000, max: 2 });
    c.set("a", 1);
    c.set("b", 2);
    c.set("a", 11); // key exists — no eviction, just overwrite
    expect(c.get("a")).toBe(11);
    expect(c.get("b")).toBe(2);
  });
});
