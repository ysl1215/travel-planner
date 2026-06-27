/**
 * OpenRouter AI client.
 *
 * OpenRouter exposes an OpenAI-compatible REST API at https://openrouter.ai/api/v1, so this
 * is a thin config wrapper over the shared engine (lib/openaiCompatProvider). The only
 * OpenRouter-specific behavior is its extra attribution headers and a richer shouldSkipModel
 * that inspects the JSON error body (rate-limit phrasing, "no endpoints", credit messages).
 *
 * Get a free key at https://openrouter.ai/keys
 * Recommended free model: meta-llama/llama-3.3-70b-instruct:free
 */
import {
  makeOpenAICompatProvider,
  Message,
  GenerateOpts,
} from "@/lib/openaiCompatProvider";

/** Rate limits, "no endpoints", and credit-exhaustion are all retryable → next model. */
function shouldSkipModel(status: number, parsedBody?: any): boolean {
  if (status === 429) return true;

  if (status === 402) {
    const m = (parsedBody?.error?.message || "").toString().toLowerCase();
    if (m.includes("requires more credits") || m.includes("fewer max_tokens") || m.includes("can only afford") || m.includes("requested up to")) return true;
  }

  const msg = (parsedBody?.error?.message || "").toString().toLowerCase();
  if (msg.includes("rate-lim") || msg.includes("rate-limited") || msg.includes("temporarily rate-limited")) return true;
  if (status === 404 && (msg.includes("no endpoints") || msg.includes("no endpoints found"))) return true;
  const raw = (parsedBody?.error?.metadata?.raw || "").toString().toLowerCase();
  if (raw.includes("rate-limited") || raw.includes("no endpoints") || raw.includes("requires more credits") || raw.includes("fewer max_tokens")) return true;
  if (parsedBody?.error?.code === 429 || parsedBody?.error?.code === 402) return true;
  return false;
}

const provider = makeOpenAICompatProvider({
  name: "OpenRouter",
  baseUrl: "https://openrouter.ai/api/v1",
  defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
  modelsEnv: process.env.OPENROUTER_MODELS,
  modelEnv: process.env.OPENROUTER_MODEL,
  extraHeaders: {
    "HTTP-Referer": "https://github.com/ysl1215/travel-planner",
    "X-Title": "Travel Planner AI",
  },
  getApiKey() {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
      throw new Error("OPENROUTER_API_KEY environment variable is not set. Get a free key at https://openrouter.ai/keys");
    }
    return key;
  },
  ttlForStatus(status) {
    if (status === 429) return 60 * 1000;
    if (status === 402) return Number(process.env.OPENROUTER_402_TTL_MS ?? String(24 * 60 * 60 * 1000));
    if (status === 404) return 60 * 60 * 1000;
    return Number(process.env.OPENROUTER_MODEL_HEALTH_TTL_MS ?? "60000");
  },
  shouldSkipModel,
});

export function generateWithOpenRouter(
  systemPrompt: string,
  userPrompt: string,
  model?: string,
  opts?: GenerateOpts
): Promise<string> {
  return provider.generate(systemPrompt, userPrompt, model, opts);
}

export function streamWithOpenRouter(messages: Message[], model?: string): Promise<ReadableStream> {
  return provider.stream(messages, model);
}
