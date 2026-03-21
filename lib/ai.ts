/**
 * AI abstraction layer with multi-provider fallback (OpenRouter, Gemini, Local).
 *
 * The generate(...) helper will attempt the configured primary provider and
 * automatically fall back to other providers on transient failures (rate limits,
 * insufficient credits, missing endpoints). Provider order can be configured via
 * AI_PROVIDER_ORDER (comma-separated). Set AI_PROVIDER to prefer a primary.
 */

import { generateWithOpenRouter } from "@/lib/openrouter";
import { generateWithGemini } from "@/lib/gemini";
import { generateWithLocalModel } from "@/lib/localModel";

type GenerateOpts = { preferShortFirst?: boolean; tokenCandidates?: number[] };

// Provider health cache to avoid retrying known-bad providers for a TTL
const DEFAULT_PROVIDER_HEALTH_TTL_MS = Number(process.env.AI_PROVIDER_HEALTH_TTL_MS ?? "60000");

type ProviderHealthEntry = { failedAt: number; ttl: number; error?: string };
const providerHealth = new Map<string, ProviderHealthEntry>();

function getProviderFailTTLForStatus(status: number) {
  if (status === 429) return 60 * 1000; // 1 minute
  const ttl402 = Number(process.env.AI_PROVIDER_402_TTL_MS ?? String(24 * 60 * 60 * 1000)); // 24h default
  if (status === 402) return ttl402;
  if (status === 404) return 60 * 60 * 1000; // 1h
  return DEFAULT_PROVIDER_HEALTH_TTL_MS;
}

function markProviderFailed(provider: string, status: number, error?: string) {
  const ttl = getProviderFailTTLForStatus(status);
  providerHealth.set(provider, { failedAt: Date.now(), ttl, error });
  console.warn(`Marked provider ${provider} unhealthy for ${ttl / 1000}s: ${error ?? ""}`);
}

function isProviderBlacklisted(provider: string) {
  const entry = providerHealth.get(provider);
  if (!entry) return false;
  if (Date.now() - entry.failedAt > entry.ttl) {
    providerHealth.delete(provider);
    return false;
  }
  return true;
}

export async function generate(
  systemPrompt: string,
  userPrompt: string,
  model?: string,
  opts?: GenerateOpts
): Promise<string> {
  const primary = (process.env.AI_PROVIDER || "openrouter").toLowerCase();
  const orderEnv = process.env.AI_PROVIDER_ORDER; // e.g. "openrouter,gemini,local"
  const fallbackOrder = (orderEnv ? orderEnv.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : ["openrouter", "gemini", "local"]);

  // Build a unique provider list with primary first
  const providers = Array.from(new Set([primary, ...fallbackOrder]));

  let lastError: string | null = null;

  for (const provider of providers) {
    if (isProviderBlacklisted(provider)) {
      console.debug(`Skipping blacklisted provider ${provider}`);
      continue;
    }

    try {
      switch (provider) {
        case "openrouter":
          return await generateWithOpenRouter(systemPrompt, userPrompt, model, opts as any);
        case "gemini":
          return await generateWithGemini(systemPrompt, userPrompt, model, opts as any);
        case "local":
          return await generateWithLocalModel(systemPrompt, userPrompt, model, opts as any);
        default:
          throw new Error(`Unknown AI provider: ${provider}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = `${provider}: ${message}`;

      // Try to extract a numeric status code hint from the message
      let status: number | undefined = undefined;
      const m = message.match(/\b(402|429|404)\b/);
      if (m) status = Number(m[1]);

      if (status) {
        markProviderFailed(provider, status, message);
      } else {
        // For unknown errors, mark provider with a short TTL to avoid hot-looping
        markProviderFailed(provider, 500, message);
      }

      // Continue to next provider
      continue;
    }
  }

  throw new Error(`All providers failed. Last error: ${lastError ?? "unknown"}`);
}
