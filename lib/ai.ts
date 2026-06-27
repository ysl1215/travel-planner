/**
 * AI abstraction layer with multi-provider fallback (Agnes, OpenRouter, Gemini, Local).
 *
 * The generate(...) helper will attempt the configured primary provider and
 * automatically fall back to other providers on transient failures (rate limits,
 * insufficient credits, missing endpoints). Provider order can be configured via
 * AI_PROVIDER_ORDER (comma-separated). Set AI_PROVIDER to prefer a primary
 * (defaults to "agnes").
 */

import { generateWithAgnes, streamWithAgnes } from "@/lib/agnes";
import { generateWithNova, streamWithNova } from "@/lib/nova";
import { generateWithOpenRouter, streamWithOpenRouter } from "@/lib/openrouter";
import { generateWithGemini, streamWithGemini } from "@/lib/gemini";
import { generateWithLocalModel, streamWithLocalModel } from "@/lib/localModel";
import { createHealthCache } from "@/lib/healthCache";

const DEFAULT_PRIMARY = "agnes";
const DEFAULT_ORDER = ["agnes", "nova", "openrouter", "gemini", "local"];

/**
 * Resolve the ordered, de-duplicated provider list from env.
 * AI_PROVIDER sets the primary; AI_PROVIDER_ORDER sets the fallback chain. Both tolerate
 * a comma-separated value (so AI_PROVIDER="agnes,openrouter" is treated as a list, not one
 * bogus provider name).
 */
function resolveProviders(): string[] {
  const split = (v?: string) =>
    (v ? v.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : []);
  const primary = split(process.env.AI_PROVIDER);
  const order = split(process.env.AI_PROVIDER_ORDER);
  const chain = [
    ...(primary.length ? primary : [DEFAULT_PRIMARY]),
    ...(order.length ? order : DEFAULT_ORDER),
  ];
  return Array.from(new Set(chain));
}

type GenerateOpts = { preferShortFirst?: boolean; tokenCandidates?: number[]; temperature?: number; taskType?: string };

// Provider-level health cache (distinct from each provider's per-MODEL cache): avoids
// retrying a whole provider that recently failed, for a status-derived TTL.
const providerHealth = createHealthCache({
  label: "provider",
  ttlForStatus(status) {
    if (status === 429) return 60 * 1000; // 1 minute
    if (status === 402) return Number(process.env.AI_PROVIDER_402_TTL_MS ?? String(24 * 60 * 60 * 1000)); // 24h
    if (status === 404) return 60 * 60 * 1000; // 1h
    return Number(process.env.AI_PROVIDER_HEALTH_TTL_MS ?? "60000");
  },
});

export async function generate(
  systemPrompt: string,
  userPrompt: string,
  model?: string,
  opts?: GenerateOpts
): Promise<string> {
  const providers = resolveProviders();

  let lastError: string | null = null;

  for (const provider of providers) {
    if (providerHealth.isBlacklisted(provider)) {
      console.debug(`Skipping blacklisted provider ${provider}`);
      continue;
    }

    try {
      switch (provider) {
        case "agnes":
          return await generateWithAgnes(systemPrompt, userPrompt, model, opts as any);
        case "nova":
          return await generateWithNova(systemPrompt, userPrompt, model, opts as any);
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
        providerHealth.markFailed(provider, status, message);
      } else {
        // For unknown errors, mark provider with a short TTL to avoid hot-looping
        providerHealth.markFailed(provider, 500, message);
      }

      // Continue to next provider
      continue;
    }
  }

  throw new Error(`All providers failed. Last error: ${lastError ?? "unknown"}`);
}

export async function stream(messages: any[], model?: string): Promise<ReadableStream> {
  const providers = resolveProviders();
  let lastError: string | null = null;

  for (const provider of providers) {
    if (providerHealth.isBlacklisted(provider)) {
      console.debug(`Skipping blacklisted provider ${provider}`);
      continue;
    }

    try {
      switch (provider) {
        case "agnes":
          return await streamWithAgnes(messages as any, model);
        case "nova":
          return await streamWithNova(messages as any, model);
        case "openrouter":
          return await streamWithOpenRouter(messages as any, model);
        case "gemini":
          return await streamWithGemini(messages as any, model);
        case "local":
          return await streamWithLocalModel(messages as any, model);
        default:
          throw new Error(`Unknown AI provider: ${provider}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = `${provider}: ${message}`;

      let status: number | undefined = undefined;
      const m = message.match(/\b(402|429|404)\b/);
      if (m) status = Number(m[1]);

      if (status) {
        providerHealth.markFailed(provider, status, message);
      } else {
        providerHealth.markFailed(provider, 500, message);
      }

      continue;
    }
  }

  throw new Error(`All providers failed for streaming. Last error: ${lastError ?? "unknown"}`);
}
