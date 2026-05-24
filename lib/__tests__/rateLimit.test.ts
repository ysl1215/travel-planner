import { describe, it, expect, beforeEach, vi } from "vitest";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("allows requests within the limit", async () => {
    const { rateLimit } = await import("../rateLimit");
    expect(rateLimit("test-ip", 3, 60_000)).toBe(true);
    expect(rateLimit("test-ip", 3, 60_000)).toBe(true);
    expect(rateLimit("test-ip", 3, 60_000)).toBe(true);
  });

  it("blocks requests exceeding the limit", async () => {
    const { rateLimit } = await import("../rateLimit");
    rateLimit("block-ip", 2, 60_000);
    rateLimit("block-ip", 2, 60_000);
    expect(rateLimit("block-ip", 2, 60_000)).toBe(false);
  });

  it("uses separate counters per key", async () => {
    const { rateLimit } = await import("../rateLimit");
    rateLimit("ip-a", 1, 60_000);
    expect(rateLimit("ip-a", 1, 60_000)).toBe(false);
    expect(rateLimit("ip-b", 1, 60_000)).toBe(true);
  });

  it("allows requests again after the window expires", async () => {
    vi.useFakeTimers();
    const { rateLimit } = await import("../rateLimit");

    rateLimit("expire-ip", 1, 1_000);
    expect(rateLimit("expire-ip", 1, 1_000)).toBe(false);

    vi.advanceTimersByTime(1_100);
    expect(rateLimit("expire-ip", 1, 1_000)).toBe(true);

    vi.useRealTimers();
  });
});
