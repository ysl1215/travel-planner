/**
 * Local model client.
 *
 * Posts to LOCAL_MODEL_URL. If unset, the client tries the Ollama default
 * endpoint first (`http://127.0.0.1:11434/api/generate`), then the older
 * `http://localhost:8000/generate` fallback. The parser accepts the most common
 * local server response shapes, including Ollama's `response` field.
 */

type LocalOpts = { preferShortFirst?: boolean; tokenCandidates?: number[]; temperature?: number };
type LocalResponse = {
  text?: string;
  output_text?: string;
  choices?: Array<{
    message?: { content?: string };
    text?: string;
    delta?: { content?: string };
  }>;
  result?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
  delta?: { content?: string };
  candidates?: Array<{ content?: string }>;
  response?: string;
};

type LocalTagsResponse = {
  models?: Array<{
    name?: string;
    model?: string;
  }>;
};

const DEFAULT_LOCAL_URLS = [
  process.env.LOCAL_MODEL_URL?.trim(),
  "http://127.0.0.1:11434/api/generate",
  "http://localhost:8000/generate",
].filter(Boolean) as string[];

const LOCAL_MODEL_NAME = process.env.LOCAL_MODEL?.trim();
const modelDiscoveryCache = new Map<string, string>();

function isOllamaGenerateUrl(url: string) {
  return /\/api\/generate\/?$/.test(url);
}

function toOllamaTagsUrl(url: string) {
  return url.replace(/\/api\/generate\/?$/, "/api/tags");
}

async function resolveLocalModel(baseUrl: string, explicitModel?: string) {
  if (explicitModel?.trim()) return explicitModel.trim();
  if (LOCAL_MODEL_NAME) return LOCAL_MODEL_NAME;
  if (!isOllamaGenerateUrl(baseUrl)) return undefined;

  const cached = modelDiscoveryCache.get(baseUrl);
  if (cached) return cached;

  const tagsUrl = toOllamaTagsUrl(baseUrl);
  const res = await fetch(tagsUrl);
  if (!res.ok) {
    throw new Error(`Could not list local models from ${tagsUrl}: ${res.status} ${await res.text()}`);
  }

  const parsed = (await res.json()) as LocalTagsResponse;
  const models = (parsed.models ?? [])
    .map((entry) => entry.name?.trim() || entry.model?.trim() || "")
    .filter(Boolean);

  const preferred = models.find((name) => /^qwen3(?::latest)?$/i.test(name)) ?? models[0];
  if (!preferred) {
    throw new Error(`No local Ollama models found at ${tagsUrl}. Run \`ollama pull <model>\` or set LOCAL_MODEL.`);
  }

  modelDiscoveryCache.set(baseUrl, preferred);
  return preferred;
}

export async function generateWithLocalModel(
  systemPrompt: string,
  userPrompt: string,
  model?: string,
  opts?: LocalOpts
): Promise<string> {
  const resolvedBaseUrls = DEFAULT_LOCAL_URLS;

  const defaultTokenCandidates = opts?.tokenCandidates ?? [2048, 1024, 512, 256, 128, 64, 32, 16, 8, 1];
  const tokenCandidates = opts?.preferShortFirst ? [...defaultTokenCandidates].reverse() : defaultTokenCandidates;
  let lastError: string | null = null;

  for (const baseUrl of resolvedBaseUrls) {
    let resolvedModel: string | undefined;
    try {
      resolvedModel = await resolveLocalModel(baseUrl, model);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      continue;
    }

    for (const maxTokens of tokenCandidates) {
      try {
        const body = {
          model: resolvedModel ?? undefined,
          system: systemPrompt,
          prompt: userPrompt,
          max_tokens: maxTokens,
          options: { num_predict: maxTokens },
          temperature: opts?.temperature ?? 0.7,
          stream: false,
        };

        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const raw = await res.text();
        let parsed: LocalResponse | null = null;
        try {
          parsed = JSON.parse(raw) as LocalResponse;
        } catch {
          // ignore
        }

        if (res.ok) {
          // Common response shapes
          if (parsed) {
            if (typeof parsed.text === 'string') return parsed.text;
            if (typeof parsed.output_text === 'string') return parsed.output_text;
            if (parsed?.choices?.[0]?.message?.content) return parsed.choices[0].message.content;
            if (parsed?.choices?.[0]?.text) return parsed.choices[0].text;
            if (parsed?.result && typeof parsed.result === 'string') return parsed.result;
            if (typeof parsed.response === 'string') return parsed.response;
            // fallback to stringifying structured responses
            return JSON.stringify(parsed);
          }

          return raw;
        }

        if (res.status === 402) {
          lastError = `Local model 402: ${raw}`;
          continue; // try lower budgets
        }

        if (res.status === 429 || res.status === 404) {
          lastError = `Local model ${res.status}: ${raw}`;
          throw new Error(lastError);
        }

        throw new Error(`Local model error ${res.status}: ${raw}`);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        continue;
      }
    }
  }

  throw new Error(`All local model attempts failed. Last error: ${lastError ?? 'unknown'}`);
}

export async function streamWithLocalModel(messages: { role: string; content: string }[], model?: string): Promise<ReadableStream> {
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const userText = messages.filter((m) => m.role !== 'system').map((m) => `${m.role}: ${m.content}`).join('\n\n');
  const combined = `${system}\n\n${userText}`;

  const tokenCandidates = [2048, 1024, 512, 256, 128, 64, 32, 16, 8, 1];
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let lastError: string | null = null;

  for (const baseUrl of DEFAULT_LOCAL_URLS) {
    let resolvedModel: string | undefined;
    try {
      resolvedModel = await resolveLocalModel(baseUrl, model);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      continue;
    }

    for (const maxTokens of tokenCandidates) {
      try {
        const body = {
          model: resolvedModel ?? undefined,
          system,
          prompt: combined,
          max_tokens: maxTokens,
          options: { num_predict: maxTokens },
          temperature: 0.7,
          stream: true,
        };

        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const raw = await res.text();
          if (res.status === 402) {
            continue; // try lower budgets
          }
          if (res.status === 429 || res.status === 404) {
            throw new Error(`Local model ${res.status}: ${raw}`);
          }
          throw new Error(`Local model error ${res.status}: ${raw}`);
        }

        const bodyStream = res.body;
        if (!bodyStream) {
          const text = await res.text();
          return new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(text));
              controller.close();
            },
          });
        }

        return new ReadableStream({
          async start(controller) {
            const reader = bodyStream.getReader();
            let buffer = '';
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                  const trimmed = line.trim();
                  let jsonStr: string | null = null;
                  if (trimmed.startsWith('data:')) {
                    jsonStr = trimmed.slice(5).trim();
                    if (jsonStr === '[DONE]') continue;
                  } else {
                    jsonStr = trimmed;
                  }

                  if (!jsonStr) continue;

                  try {
                    const parsed = JSON.parse(jsonStr) as LocalResponse;
                    const textChunk = parsed?.choices?.[0]?.delta?.content ?? parsed?.delta?.content ?? parsed?.response ?? parsed?.output?.[0]?.content?.[0]?.text ?? parsed?.text ?? parsed?.candidates?.[0]?.content ?? null;
                    if (textChunk) controller.enqueue(encoder.encode(String(textChunk)));
                  } catch {
                    // ignore non-json chunks
                  }
                }
              }
            } finally {
              reader.releaseLock();
              controller.close();
            }
          },
        });
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        continue;
      }
    }
  }

  throw new Error(`All local streaming attempts failed. Last error: ${lastError ?? 'unknown'}`);
}
