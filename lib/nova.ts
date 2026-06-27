/**
 * Amazon Nova client.
 *
 * Nova exposes an OpenAI-compatible REST API at https://api.nova.amazon.com/v1, so this is
 * a thin config wrapper over the shared OpenAI-compatible engine (lib/openaiCompatProvider),
 * identical in shape to lib/agnes.ts.
 *
 * Auth is a Bearer token (NOVA_API_KEY). Default chat model: nova-pro-v1.
 * Note: the shared gateway key can invoke nova-premier-v1 / nova-pro-v1 / nova-lite-v1 /
 * nova-micro-v1 / nova-2-lite-v1; nova-2-pro-v1, nova-2-omni-v1 and the bare "novapremier"
 * alias return 404 (no access) — use nova-premier-v1 instead.
 */
import {
  makeOpenAICompatProvider,
  Message,
  GenerateOpts,
} from "@/lib/openaiCompatProvider";

const provider = makeOpenAICompatProvider({
  name: "Nova",
  baseUrl: process.env.NOVA_BASE_URL?.trim() || "https://api.nova.amazon.com/v1",
  defaultModel: "nova-pro-v1",
  modelsEnv: process.env.NOVA_MODELS,
  modelEnv: process.env.NOVA_MODEL,
  getApiKey() {
    const key = process.env.NOVA_API_KEY;
    if (!key) {
      throw new Error("NOVA_API_KEY environment variable is not set.");
    }
    return key;
  },
  ttlForStatus(status) {
    if (status === 429) return 60 * 1000;
    if (status === 402) return Number(process.env.NOVA_402_TTL_MS ?? String(24 * 60 * 60 * 1000));
    if (status === 404) return 60 * 60 * 1000;
    return Number(process.env.NOVA_MODEL_HEALTH_TTL_MS ?? "60000");
  },
  // Nova uses plain status-code skip (no rich error-body inspection).
  shouldSkipModel: (status) => status === 429 || status === 402 || status === 404,
});

export function generateWithNova(
  systemPrompt: string,
  userPrompt: string,
  model?: string,
  opts?: GenerateOpts
): Promise<string> {
  return provider.generate(systemPrompt, userPrompt, model, opts);
}

export function streamWithNova(messages: Message[], model?: string): Promise<ReadableStream> {
  return provider.stream(messages, model);
}
