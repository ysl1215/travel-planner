import { describe, it, expect, vi, afterEach } from "vitest";
import { createHealthCache } from "../healthCache";

describe("createHealthCache", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("is not blacklisted before any failure", () => {
    const h = createHealthCache({ label: "test" });
    expect(h.isBlacklisted("m1")).toBe(false);
  });

  it("blacklists after a failure and clears after the TTL", () => {
    vi.useFakeTimers();
    const h = createHealthCache({ label: "test" });
    h.markFailed("m1", 429); // 60s default
    expect(h.isBlacklisted("m1")).toBe(true);
    vi.advanceTimersByTime(61_000);
    expect(h.isBlacklisted("m1")).toBe(false);
  });

  it("uses status-specific TTLs (404 → 1h outlives 429 → 60s)", () => {
    vi.useFakeTimers();
    const h = createHealthCache({ label: "test" });
    h.markFailed("rate", 429);
    h.markFailed("missing", 404);
    vi.advanceTimersByTime(61_000); // past 429 TTL, well within 404 TTL
    expect(h.isBlacklisted("rate")).toBe(false);
    expect(h.isBlacklisted("missing")).toBe(true);
  });

  it("honors a custom ttlForStatus", () => {
    vi.useFakeTimers();
    const h = createHealthCache({ label: "test", ttlForStatus: () => 5_000 });
    h.markFailed("m1", 402);
    vi.advanceTimersByTime(4_000);
    expect(h.isBlacklisted("m1")).toBe(true);
    vi.advanceTimersByTime(2_000);
    expect(h.isBlacklisted("m1")).toBe(false);
  });

  it("prioritize() puts healthy keys first, blacklisted last, dropping none", () => {
    const h = createHealthCache({ label: "test" });
    h.markFailed("b", 429);
    const ordered = h.prioritize(["a", "b", "c"]);
    expect(ordered).toEqual(["a", "c", "b"]);
  });

  it("prioritize() returns the same array when all healthy", () => {
    const h = createHealthCache({ label: "test" });
    expect(h.prioritize(["a", "b"])).toEqual(["a", "b"]);
  });
});
