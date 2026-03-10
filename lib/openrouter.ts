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

// Default model — any model slug from https://openrouter.ai/models works here.
// The :free suffix selects the free-tier version where available.
// Override via OPENROUTER_MODEL env var.
const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";

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

/**
 * Non-streaming completion — returns the full response text.
 */
export async function generateWithOpenRouter(
  systemPrompt: string,
  userPrompt: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: commonHeaders(),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return (data.choices?.[0]?.message?.content as string) ?? "";
}

/**
 * Streaming completion — returns a ReadableStream of text chunks.
 */
export async function streamWithOpenRouter(
  messages: Message[],
  model: string = DEFAULT_MODEL
): Promise<ReadableStream> {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: commonHeaders(),
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
  }

  const encoder = new TextEncoder();
  const body = response.body;
  if (!body) throw new Error("OpenRouter returned empty response body");

  // Parse the SSE stream and forward raw text chunks
  return new ReadableStream({
    async start(controller) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
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
              if (text) {
                controller.enqueue(encoder.encode(text));
              }
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
