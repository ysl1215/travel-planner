/**
 * AI abstraction layer.
 *
 * Exports a generate(...) helper used across server API routes. Currently delegates
 * to the OpenRouter implementation in lib/openrouter.ts. In the future this file
 * can be extended to select between multiple providers (OpenRouter, OpenAI, etc.)
 * based on environment variables.
 */

import { generateWithOpenRouter } from "@/lib/openrouter";

export async function generate(
  systemPrompt: string,
  userPrompt: string,
  model?: string,
  opts?: { preferShortFirst?: boolean; tokenCandidates?: number[] }
): Promise<string> {
  const provider = (process.env.AI_PROVIDER || "openrouter").toLowerCase();

  switch (provider) {
    case "openrouter":
    default:
      return generateWithOpenRouter(systemPrompt, userPrompt, model, opts);
  }
}
