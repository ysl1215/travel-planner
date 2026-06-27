/**
 * Agnes AI client.
 *
 * Agnes exposes an OpenAI-compatible REST API at https://apihub.agnes-ai.com/v1, so this is
 * a thin config wrapper over the shared OpenAI-compatible engine (lib/openaiCompatProvider).
 *
 * Get a key and see models at https://agnes-ai.com/doc/overview
 * Default chat model: agnes-2.0-flash
 */
import {
  makeOpenAICompatProvider,
  Message,
  GenerateOpts,
} from "@/lib/openaiCompatProvider";

const provider = makeOpenAICompatProvider({
  name: "Agnes",
  baseUrl: process.env.AGNES_BASE_URL?.trim() || "https://apihub.agnes-ai.com/v1",
  defaultModel: "agnes-2.0-flash",
  modelsEnv: process.env.AGNES_MODELS,
  modelEnv: process.env.AGNES_MODEL,
  getApiKey() {
    const key = process.env.AGNES_API_KEY;
    if (!key) {
      throw new Error("AGNES_API_KEY environment variable is not set. Get a key at https://agnes-ai.com/doc/overview");
    }
    return key;
  },
  ttlForStatus(status) {
    if (status === 429) return 60 * 1000;
    if (status === 402) return Number(process.env.AGNES_402_TTL_MS ?? String(24 * 60 * 60 * 1000));
    if (status === 404) return 60 * 60 * 1000;
    return Number(process.env.AGNES_MODEL_HEALTH_TTL_MS ?? "60000");
  },
  // Agnes uses plain status-code skip (no rich error-body inspection).
  shouldSkipModel: (status) => status === 429 || status === 402 || status === 404,
});

export function generateWithAgnes(
  systemPrompt: string,
  userPrompt: string,
  model?: string,
  opts?: GenerateOpts
): Promise<string> {
  return provider.generate(systemPrompt, userPrompt, model, opts);
}

export function streamWithAgnes(messages: Message[], model?: string): Promise<ReadableStream> {
  return provider.stream(messages, model);
}
