/**
 * OpenRouter AI client.
 *
 * OpenRouter exposes an OpenAI-compatible REST API at
 * https://openrouter.ai/api/v1, so we use plain fetch rather than
 * any SDK to keep dependencies minimal.
 *
 * Get a free key at https://openrouter.ai/keys
 * Recommended free model: meta-llama/llama-3.3-70b-instruct:free
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

// Default model — fallback if no env var provided
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set. Get a free key at https://openrouter.ai/keys");
  }
  return key;
}

function commonHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getApiKey()}`,
    "HTTP-Referer": "https://github.com/ysl1215/travel-planner",
    "X-Title": "Travel Planner AI",
  };
}

function parseModels(preferred?: string): string[] {
  // OPENROUTER_MODELS should be a comma-separated list of model slugs in preference order.
  const envList = process.env.OPENROUTER_MODELS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const envModel = process.env.OPENROUTER_MODEL?.trim();

  const candidates: string[] = [];
  if (preferred) candidates.push(preferred);
  if (envList.length) candidates.push(...envList);
  else if (envModel) candidates.push(envModel);
  else candidates.push(DEFAULT_MODEL);

  // dedupe while preserving order
  const seen = new Set<string>();
  return candidates.filter((m) => {
    if (seen.has(m)) return false;
    seen.add(m);
    return true;
  });
}

// In-memory model health cache to avoid repeatedly trying models that recently failed.
// TTLs can be tuned via OPENROUTER_MODEL_HEALTH_TTL_MS or learned from status codes.
const DEFAULT_HEALTH_TTL_MS = Number(process.env.OPENROUTER_MODEL_HEALTH_TTL_MS ?? "60000"); // 60s default

type ModelHealthEntry = { failedAt: number; ttl: number; error?: string };
const modelHealth = new Map<string, ModelHealthEntry>();

function getFailTTLForStatus(status: number) {
  if (status === 429) return 60 * 1000; // 1 minute for rate limits
  // 402 (insufficient credits) -> blacklist for 24 hours by default; configurable via OPENROUTER_402_TTL_MS (ms)
  const ttl402 = Number(process.env.OPENROUTER_402_TTL_MS ?? String(24 * 60 * 60 * 1000));
  if (status === 402) return ttl402;
  if (status === 404) return 60 * 60 * 1000; // 1 hour for missing endpoints
  return DEFAULT_HEALTH_TTL_MS;
}

function markModelFailed(model: string, status: number, error?: string) {
  const ttl = getFailTTLForStatus(status);
  modelHealth.set(model, { failedAt: Date.now(), ttl, error });
  console.warn(`Marked model ${model} unhealthy for ${ttl / 1000}s: ${error ?? ""}`);
}

function isModelBlacklisted(model: string) {
  const entry = modelHealth.get(model);
  if (!entry) return false;
  if (Date.now() - entry.failedAt > entry.ttl) {
    modelHealth.delete(model);
    return false;
  }
  return true;
}

function prioritizeModels(models: string[]) {
  const healthy = models.filter((m) => !isModelBlacklisted(m));
  if (healthy.length === models.length) return models;
  const blacklisted = models.filter((m) => isModelBlacklisted(m));
  return [...healthy, ...blacklisted];
}

function shouldSkipModel(status: number, parsedBody?: any) {
  // Treat rate limits, explicit 'no endpoints' (model not available),
  // and insufficient credits (402) as retryable so we can fall back to other models.
  if (status === 429) return true;

  // OpenRouter returns 402 when the request exceeds available credits or token quota.
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

/**
 * Non-streaming completion — tries models in order until one succeeds.
 */
export async function generateWithOpenRouter(
  systemPrompt: string,
  userPrompt: string,
  model?: string,
  opts?: { preferShortFirst?: boolean; tokenCandidates?: number[] }
): Promise<string> {
  const rawModels = parseModels(model);
  const models = prioritizeModels(rawModels);
  let lastError: string | null = null;
  // Try progressively smaller token budgets for each model to handle 402 (insufficient credits).
  const defaultTokenCandidates = opts?.tokenCandidates ?? [4096, 1024, 256];
  const tokenCandidates = opts?.preferShortFirst ? [...defaultTokenCandidates].reverse() : defaultTokenCandidates;

  for (const candidate of models) {
    let candidateError: { status: number; text: string } | null = null;

    for (const maxTokens of tokenCandidates) {
      const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: "POST",
        headers: commonHeaders(),
        body: JSON.stringify({
          model: candidate,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: maxTokens,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return (data.choices?.[0]?.message?.content as string) ?? "";
      }

      const text = await response.text();
      let parsed: any = undefined;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        // ignore
      }

      // If OpenRouter reports insufficient credits (402), try again with a lower max_tokens
      if (response.status === 402) {
        candidateError = { status: 402, text };
        // try next lower token budget for same candidate
        continue;
      }

      // If the model is unavailable or rate-limited (404/429/etc), skip to next candidate
      if (shouldSkipModel(response.status, parsed)) {
        // Exponential backoff for 429 before giving up on this model
        if (response.status === 429) {
          for (let attempt = 0; attempt < 3; attempt++) {
            await sleep(1000 * 2 ** attempt);
            const retry = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
              method: "POST",
              headers: commonHeaders(),
              body: JSON.stringify({
                model: candidate,
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userPrompt },
                ],
                temperature: 0.7,
                max_tokens: maxTokens,
              }),
            });
            if (retry.ok) {
              const data = await retry.json();
              return (data.choices?.[0]?.message?.content as string) ?? "";
            }
            if (retry.status !== 429) break;
          }
        }
        candidateError = { status: response.status, text };
        break; // try next model
      }

      // Non-handler failure — surface to caller
      throw new Error(`OpenRouter API error ${response.status}: ${text}`);
    }

    // Mark the candidate as failed if we recorded an error (so it's deprioritized for a TTL)
    if (candidateError) {
      markModelFailed(candidate, candidateError.status, candidateError.text);
      lastError = `Model ${candidate} failed: status ${candidateError.status}`;
    }

    // exhausted token candidates for this model — move to next model
    continue;
  }

  throw new Error(`All models failed. Last error: ${lastError ?? "unknown"}`);
}

/**
 * Streaming completion — tries models in order until one returns a streaming response.
 */
export async function streamWithOpenRouter(
  messages: Message[],
  model?: string
): Promise<ReadableStream> {
  const rawModels = parseModels(model);
  const models = prioritizeModels(rawModels);
  let lastError: string | null = null;
  const tokenCandidates = [2048, 512, 128];

  for (const candidate of models) {
    let candidateError: { status: number; text: string } | null = null;

    for (const maxTokens of tokenCandidates) {
      let response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: "POST",
        headers: commonHeaders(),
        body: JSON.stringify({
          model: candidate,
          messages,
          temperature: 0.7,
          max_tokens: maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        let parsed: any = undefined;
        try { parsed = JSON.parse(text); } catch (e) { /* ignore */ }

        // 402: try lower max_tokens
        if (response.status === 402) {
          candidateError = { status: 402, text };
          continue;
        }

        if (shouldSkipModel(response.status, parsed)) {
          // Exponential backoff for 429 before moving to next model
          if (response.status === 429) {
            for (let attempt = 0; attempt < 3; attempt++) {
              await sleep(1000 * 2 ** attempt);
              const retry = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
                method: "POST",
                headers: commonHeaders(),
                body: JSON.stringify({ model: candidate, messages, temperature: 0.7, max_tokens: maxTokens, stream: true }),
              });
              if (retry.ok && retry.body) { response = retry as any; break; }
              if (retry.status !== 429) break;
            }
          }
          if (!response.ok) {
            candidateError = { status: response.status, text };
            break;
          }
          // response is now ok — fall through to stream handling
        } else {
          throw new Error(`OpenRouter API error ${response.status}: ${text}`);
        }
      }

      const body = response.body;
      if (!body) throw new Error("OpenRouter returned empty response body");

      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      // Parse the SSE stream and forward raw text chunks
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
                } catch (e) {
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

    // Mark model as failed and deprioritize for a TTL
    if (candidateError) {
      markModelFailed(candidate, candidateError.status, candidateError.text);
      lastError = `Model ${candidate} failed: status ${candidateError.status}`;
    }

    // try next model
  }

  throw new Error(`All models failed for streaming. Last error: ${lastError ?? "unknown"}`);
}
