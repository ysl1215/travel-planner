import { describe, it, expect } from "vitest";
import { parseEnvModels, runWithDescentAndHealth } from "../openaiCompatProvider";
import { createHealthCache } from "../healthCache";

describe("parseEnvModels", () => {
  it("prefers the explicit arg, then dedupes", () => {
    expect(parseEnvModels({ preferred: "x", modelsEnv: "x,y,z", defaultModel: "d" })).toEqual(["x", "y", "z"]);
  });
  it("falls back to the MODELS env list", () => {
    expect(parseEnvModels({ modelsEnv: "a, b , c", defaultModel: "d" })).toEqual(["a", "b", "c"]);
  });
  it("uses single MODEL env when no list", () => {
    expect(parseEnvModels({ modelEnv: "solo", defaultModel: "d" })).toEqual(["solo"]);
  });
  it("uses the default when nothing is set", () => {
    expect(parseEnvModels({ defaultModel: "d" })).toEqual(["d"]);
  });
});

describe("runWithDescentAndHealth", () => {
  const newHealth = () => createHealthCache({ label: "test" });

  it("returns the first ok result", async () => {
    const out = await runWithDescentAndHealth<string>({
      models: ["m1"],
      tokenCandidates: [100],
      health: newHealth(),
      allFailedMessage: "fail.",
      attempt: async () => ({ ok: true, value: "hello" }),
    });
    expect(out).toBe("hello");
  });

  it("descends token budgets on retryLowerTokens, then succeeds", async () => {
    const seen: number[] = [];
    const out = await runWithDescentAndHealth<string>({
      models: ["m1"],
      tokenCandidates: [100, 50, 10],
      health: newHealth(),
      allFailedMessage: "fail.",
      attempt: async (_m, maxTokens) => {
        seen.push(maxTokens);
        if (maxTokens > 10) return { retryLowerTokens: true, status: 402 };
        return { ok: true, value: `ok@${maxTokens}` };
      },
    });
    expect(seen).toEqual([100, 50, 10]);
    expect(out).toBe("ok@10");
  });

  it("skips to the next model on skipModel", async () => {
    const triedModels: string[] = [];
    const out = await runWithDescentAndHealth<string>({
      models: ["bad", "good"],
      tokenCandidates: [100],
      health: newHealth(),
      allFailedMessage: "fail.",
      attempt: async (m) => {
        triedModels.push(m);
        if (m === "bad") return { skipModel: true, status: 429 };
        return { ok: true, value: "from-good" };
      },
    });
    expect(triedModels).toEqual(["bad", "good"]);
    expect(out).toBe("from-good");
  });

  it("throws allFailedMessage when every model fails", async () => {
    await expect(
      runWithDescentAndHealth<string>({
        models: ["m1", "m2"],
        tokenCandidates: [100],
        health: newHealth(),
        allFailedMessage: "everything failed.",
        attempt: async () => ({ skipModel: true, status: 404 }),
      })
    ).rejects.toThrow("everything failed.");
  });

  it("marks a failed model so a later run deprioritizes it", async () => {
    const health = newHealth();
    // First run: m1 fails (skip), m2 succeeds.
    await runWithDescentAndHealth<string>({
      models: ["m1", "m2"],
      tokenCandidates: [100],
      health,
      allFailedMessage: "fail.",
      attempt: async (m) => (m === "m1" ? { skipModel: true, status: 429 } : { ok: true, value: "ok" }),
    });
    expect(health.isBlacklisted("m1")).toBe(true);
  });
});
