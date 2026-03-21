/**
 * OpenRouter AI client — drop-in replacement for the Groq client.
 *
 * OpenRouter exposes an OpenAI-compatible REST API at
 * https://openrouter.ai/api/v1, so we use plain fetch rather than
 * any SDK to keep dependencies minimal.
 *
 * Get a free key at https://openrouter.ai/keys
 * Recommended free model: meta-llama/llama-3.3-70b-instruct:free
 */

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
  model?: string
): Promise<string> {
  const models = parseModels(model);
  let lastError: string | null = null;

  for (const candidate of models) {
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
        max_tokens: 4096,
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

    if (shouldSkipModel(response.status, parsed)) {
      lastError = `Model ${candidate} unavailable or rate-limited (status ${response.status})`;
      // try next candidate
      continue;
    }

    // Non-rate-limit failure — surface to caller
    throw new Error(`OpenRouter API error ${response.status}: ${text}`);
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
  const models = parseModels(model);
  let lastError: string | null = null;

  for (const candidate of models) {
    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: commonHeaders(),
      body: JSON.stringify({
        model: candidate,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
        stream: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      let parsed: any = undefined;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        // ignore
      }

      if (shouldSkipModel(response.status, parsed)) {
        lastError = `Model ${candidate} unavailable or rate-limited (status ${response.status})`;
        continue; // try next model
      }

      throw new Error(`OpenRouter API error ${response.status}: ${text}`);
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

  throw new Error(`All models failed for streaming. Last error: ${lastError ?? "unknown"}`);
}
