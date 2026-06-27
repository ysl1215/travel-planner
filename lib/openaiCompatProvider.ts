/**
 * Shared engine for OpenAI-compatible chat providers (Agnes, OpenRouter).
 *
 * agnes.ts and openrouter.ts were ~300 lines of near-identical code: same model-list
 * parsing, same per-model health blacklist, same token-candidate descent, same 402-continue
 * / 429-exponential-backoff loop, same OpenAI SSE parse. This module holds that once;
 * each provider supplies only its config (base URL, env prefixes, default model, headers,
 * and an optional richer shouldSkipModel).
 *
 * The model loop itself (runWithDescentAndHealth) is request-shape-agnostic so the native
 * providers (gemini.ts, localModel.ts) can route through it too and gain the per-model
 * health cache + 429 backoff they previously lacked.
 */
import { createHealthCache, HealthCache } from "@/lib/healthCache";
import { logUsage } from "./llmBudget";
import { writeTokenUsage } from "./tokenUsageDb";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Message = { role: "system" | "user" | "assistant"; content: string };
export type GenerateOpts = { preferShortFirst?: boolean; tokenCandidates?: number[]; temperature?: number; taskType?: string };

/**
 * Build an env-driven, deduped model preference list.
 * preferred (explicit arg) → MODELS env list → MODEL env single → default.
 */
export function parseEnvModels(opts: {
  preferred?: string;
  modelsEnv?: string; // e.g. process.env.AGNES_MODELS
  modelEnv?: string;  // e.g. process.env.AGNES_MODEL
  defaultModel: string;
}): string[] {
  const envList = opts.modelsEnv?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const envModel = opts.modelEnv?.trim();

  const candidates: string[] = [];
  if (opts.preferred) candidates.push(opts.preferred);
  if (envList.length) candidates.push(...envList);
  else if (envModel) candidates.push(envModel);
  else candidates.push(opts.defaultModel);

  const seen = new Set<string>();
  return candidates.filter((m) => (seen.has(m) ? false : (seen.add(m), true)));
}

/**
 * Outcome of a single attempt at one (model, maxTokens). The attempt callback does the
 * provider-specific HTTP work and maps the response to one of these:
 *  - { ok: true, value }            → success, returned to caller
 *  - { retryLowerTokens: true }     → 402-style; try the next (smaller) token budget
 *  - { skipModel: true, status }    → give up on this model, try the next
 *  - throws                         → unhandled error, surfaced to caller
 */
export type AttemptResult<T> =
  | { ok: true; value: T }
  | { retryLowerTokens: true; status: number; text?: string }
  | { skipModel: true; status: number; text?: string };

/**
 * Generic model-loop with token descent + per-model health blacklist. The attempt callback
 * owns the request shape; this owns the iteration, 402-descent, skip-and-mark, and "all
 * failed" semantics. 429 backoff lives inside the attempt callback (it needs to re-issue
 * the same request), so providers that want it call backoff429 from there.
 */
export async function runWithDescentAndHealth<T>(args: {
  models: string[];
  tokenCandidates: number[];
  health: HealthCache;
  attempt: (model: string, maxTokens: number) => Promise<AttemptResult<T>>;
  allFailedMessage: string;
}): Promise<T> {
  const models = args.health.prioritize(args.models);
  let lastError: string | null = null;

  for (const model of models) {
    let candidateError: { status: number; text?: string } | null = null;

    for (const maxTokens of args.tokenCandidates) {
      const result = await args.attempt(model, maxTokens);
      if ("ok" in result) return result.value;
      if ("retryLowerTokens" in result) {
        candidateError = { status: result.status, text: result.text };
        continue; // smaller budget, same model
      }
      // skipModel
      candidateError = { status: result.status, text: result.text };
      break; // next model
    }

    if (candidateError) {
      args.health.markFailed(model, candidateError.status, candidateError.text);
      lastError = `Model ${model} failed: status ${candidateError.status}`;
    }
  }

  throw new Error(`${args.allFailedMessage} Last error: ${lastError ?? "unknown"}`);
}

/** Exponential backoff retry loop for 429s. Returns the first ok Response, or the last. */
export async function backoff429(doFetch: () => Promise<Response>, attempts = 3): Promise<Response> {
  let res = await doFetch();
  for (let attempt = 0; attempt < attempts && res.status === 429; attempt++) {
    await sleep(1000 * 2 ** attempt);
    res = await doFetch();
  }
  return res;
}

/** Parse an OpenAI-style SSE stream into a ReadableStream of raw text chunks. */
export function parseOpenAISSE(body: ReadableStream<Uint8Array>): ReadableStream {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return new ReadableStream({
    async start(controller) {
      const reader = body.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const text: string = parsed.choices?.[0]?.delta?.content ?? "";
              if (text) controller.enqueue(encoder.encode(text));
            } catch {
              // ignore malformed SSE lines
            }
          }
        }
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });
}

export interface OpenAICompatConfig {
  /** Display name for logs + error messages, e.g. "Agnes", "OpenRouter". */
  name: string;
  /** Chat completions base, e.g. "https://apihub.agnes-ai.com/v1". */
  baseUrl: string;
  /** Throws with a helpful message if the key isn't configured. */
  getApiKey: () => string;
  /** Extra headers beyond Content-Type + Authorization (e.g. OpenRouter's HTTP-Referer). */
  extraHeaders?: Record<string, string>;
  defaultModel: string;
  modelsEnv?: string;
  modelEnv?: string;
  /** TTL (ms) override hook for the health cache (preserves *_402_TTL_MS knobs). */
  ttlForStatus?: (status: number) => number;
  /**
   * Whether a non-ok status means "skip to next model" (vs surface the error). Receives the
   * parsed JSON body so a provider can inspect error messages (OpenRouter does). 402 is
   * handled separately as token-descent, so this only needs to cover 429/404/etc.
   */
  shouldSkipModel: (status: number, parsedBody?: any) => boolean;
}

export interface OpenAICompatProvider {
  generate: (systemPrompt: string, userPrompt: string, model?: string, opts?: GenerateOpts) => Promise<string>;
  stream: (messages: Message[], model?: string) => Promise<ReadableStream>;
}

export function makeOpenAICompatProvider(cfg: OpenAICompatConfig): OpenAICompatProvider {
  const health = createHealthCache({ label: `${cfg.name} model`, ttlForStatus: cfg.ttlForStatus });

  const headers = (): Record<string, string> => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.getApiKey()}`,
    ...(cfg.extraHeaders ?? {}),
  });

  const models = (preferred?: string) =>
    parseEnvModels({ preferred, modelsEnv: cfg.modelsEnv, modelEnv: cfg.modelEnv, defaultModel: cfg.defaultModel });

  const post = (model: string, maxTokens: number, messages: Message[], stream: boolean, temperature: number) =>
    fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, ...(stream ? { stream: true } : {}) }),
    });

  async function generate(
    systemPrompt: string,
    userPrompt: string,
    model?: string,
    opts?: GenerateOpts
  ): Promise<string> {
    const base = opts?.tokenCandidates ?? [4096, 1024, 256];
    const tokenCandidates = opts?.preferShortFirst ? [...base].reverse() : base;
    const temperature = opts?.temperature ?? 0.7;
    const taskType = opts?.taskType;
    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // Fire-and-forget meter on a successful (non-streamed) response. logUsage never
    // throws/rejects; void the promise so metering can't block or break the call path.
    const meter = (candidate: string, data: any) =>
      void logUsage(writeTokenUsage, {
        project: "travel-planner",
        taskType,
        provider: cfg.name,
        modelId: candidate,
        resp: data, // raw OpenAI-compat response; logUsage extracts .usage
      });

    return runWithDescentAndHealth<string>({
      models: models(model),
      tokenCandidates,
      health,
      allFailedMessage: `All ${cfg.name} models failed.`,
      attempt: async (candidate, maxTokens) => {
        const response = await post(candidate, maxTokens, messages, false, temperature);
        if (response.ok) {
          const data = await response.json();
          meter(candidate, data);
          return { ok: true, value: (data.choices?.[0]?.message?.content as string) ?? "" };
        }
        const text = await response.text();
        let parsed: any;
        try { parsed = JSON.parse(text); } catch { /* ignore */ }

        if (response.status === 402) return { retryLowerTokens: true, status: 402, text };

        if (cfg.shouldSkipModel(response.status, parsed)) {
          if (response.status === 429) {
            const retry = await backoff429(() => post(candidate, maxTokens, messages, false, temperature));
            if (retry.ok) {
              const data = await retry.json();
              meter(candidate, data);
              return { ok: true, value: (data.choices?.[0]?.message?.content as string) ?? "" };
            }
          }
          return { skipModel: true, status: response.status, text };
        }
        throw new Error(`${cfg.name} API error ${response.status}: ${text}`);
      },
    });
  }

  async function stream(messages: Message[], model?: string): Promise<ReadableStream> {
    // NOTE (token metering, v1): streamed responses are deliberately NOT metered.
    // OpenAI-compat SSE omits `usage` unless the request sets
    // stream_options:{include_usage:true} and it only arrives in the terminal chunk.
    // v1 meters the non-streamed generate() path (suggest/itinerary/re-prompt) only;
    // the chat stream under-counts (never mis-counts). See travel-planner.glue.md.
    const tokenCandidates = [2048, 512, 128];
    return runWithDescentAndHealth<ReadableStream>({
      models: models(model),
      tokenCandidates,
      health,
      allFailedMessage: `All ${cfg.name} models failed for streaming.`,
      attempt: async (candidate, maxTokens) => {
        let response = await post(candidate, maxTokens, messages, true, 0.7);
        if (!response.ok) {
          const text = await response.text();
          let parsed: any;
          try { parsed = JSON.parse(text); } catch { /* ignore */ }

          if (response.status === 402) return { retryLowerTokens: true, status: 402, text };

          if (cfg.shouldSkipModel(response.status, parsed)) {
            if (response.status === 429) {
              const retry = await backoff429(() => post(candidate, maxTokens, messages, true, 0.7));
              if (retry.ok && retry.body) response = retry;
            }
            if (!response.ok) return { skipModel: true, status: response.status, text };
          } else {
            throw new Error(`${cfg.name} API error ${response.status}: ${text}`);
          }
        }
        const body = response.body;
        if (!body) throw new Error(`${cfg.name} returned empty response body`);
        return { ok: true, value: parseOpenAISSE(body) };
      },
    });
  }

  return { generate, stream };
}
