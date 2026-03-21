/**
 * Gemini AI client wrapper.
 *
 * Supports either a generic GEMINI_API_URL (user-supplied endpoint) with
 * Authorization: Bearer GEMINI_API_KEY, or the Google Generative Language API
 * using GEMINI_API_KEY as an API key (v1beta2 models/{model}:generate).
 *
 * The client attempts progressively smaller token budgets to handle 402
 * (insufficient credits) responses, similar to the OpenRouter client.
 */

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-1";

type GeminiOpts = { preferShortFirst?: boolean; tokenCandidates?: number[] };

function extractText(parsed: any, rawText: string): string | null {
  if (!parsed) return rawText || null;
  // Common response shapes
  if (typeof parsed.output_text === 'string') return parsed.output_text;
  if (typeof parsed.text === 'string') return parsed.text;
  if (parsed?.candidates?.[0]?.content) {
    const c = parsed.candidates[0].content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.map((p: any) => (typeof p === 'string' ? p : p.text ?? '')).join('');
  }
  if (parsed?.output?.[0]?.content?.[0]?.text) return parsed.output[0].content[0].text;
  if (parsed?.choices?.[0]?.message?.content) return parsed.choices[0].message.content;
  if (parsed?.choices?.[0]?.text) return parsed.choices[0].text;
  if (parsed?.result && typeof parsed.result === 'string') return parsed.result;
  return null;
}

export async function generateWithGemini(
  systemPrompt: string,
  userPrompt: string,
  model?: string,
  opts?: GeminiOpts
): Promise<string> {
  const modelToUse = model ?? DEFAULT_MODEL;
  const apiUrl = process.env.GEMINI_API_URL?.trim();
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiUrl && !apiKey) {
    throw new Error('GEMINI_API_KEY or GEMINI_API_URL must be set to use Gemini provider');
  }

  const defaultTokenCandidates = opts?.tokenCandidates ?? [4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 1];
  const tokenCandidates = opts?.preferShortFirst ? [...defaultTokenCandidates].reverse() : defaultTokenCandidates;
  let lastError: string | null = null;

  for (const maxTokens of tokenCandidates) {
    try {
      let url: string;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let body: any;

      if (apiUrl) {
        // Generic user-supplied Gemini-compatible endpoint
        url = apiUrl;
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
        body = {
          model: modelToUse,
          input: { text: `${systemPrompt}\n\n${userPrompt}` },
          temperature: 0.7,
          max_output_tokens: maxTokens,
        };
      } else {
        // Google Generative Language API v1beta2
        url = `https://generativelanguage.googleapis.com/v1beta2/models/${encodeURIComponent(
          modelToUse
        )}:generate?key=${apiKey}`;
        body = {
          input: { text: `${systemPrompt}\n\n${userPrompt}` },
          maxOutputTokens: maxTokens,
          temperature: 0.7,
        };
      }

      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const raw = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        // ignore
      }

      if (res.ok) {
        const out = extractText(parsed, raw);
        return out ?? (parsed ? JSON.stringify(parsed) : raw);
      }

      // Handle common provider-level statuses
      if (res.status === 402) {
        // try lower token budgets
        lastError = `Gemini API 402: ${raw}`;
        continue;
      }

      if (res.status === 429 || res.status === 404) {
        // Treat as provider failure — surface to caller to allow fallback
        lastError = `Gemini API ${res.status}: ${raw}`;
        throw new Error(lastError);
      }

      throw new Error(`Gemini API error ${res.status}: ${raw}`);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // try next token budget
      continue;
    }
  }

  throw new Error(`All Gemini attempts failed. Last error: ${lastError ?? 'unknown'}`);
}

export async function streamWithGemini(messages: { role: string; content: string }[], model?: string): Promise<ReadableStream> {
  const modelToUse = model ?? DEFAULT_MODEL;
  const apiUrl = process.env.GEMINI_API_URL?.trim();
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiUrl && !apiKey) {
    throw new Error('GEMINI_API_KEY or GEMINI_API_URL must be set to use Gemini provider');
  }

  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const userText = messages.filter((m) => m.role !== 'system').map((m) => `${m.role}: ${m.content}`).join('\n\n');
  const combined = `${system}\n\n${userText}`;

  const tokenCandidates = [2048, 1024, 512, 256, 128, 64, 32, 16, 8, 1];
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  for (const maxTokens of tokenCandidates) {
    try {
      let url: string;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let body: any;

      if (apiUrl) {
        url = apiUrl;
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
        body = {
          model: modelToUse,
          input: { text: combined },
          temperature: 0.7,
          max_output_tokens: maxTokens,
          stream: true,
        };
      } else {
        url = `https://generativelanguage.googleapis.com/v1beta2/models/${encodeURIComponent(
          modelToUse
        )}:generate?key=${apiKey}`;
        body = {
          input: { text: combined },
          maxOutputTokens: maxTokens,
          temperature: 0.7,
          stream: true,
        };
      }

      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

      if (!res.ok) {
        const raw = await res.text();
        if (res.status === 402) {
          // try lower budgets
          continue;
        }
        if (res.status === 429 || res.status === 404) {
          throw new Error(`Gemini API ${res.status}: ${raw}`);
        }
        throw new Error(`Gemini API error ${res.status}: ${raw}`);
      }

      // If the provider returned a streaming body, parse it. Otherwise return a stream that emits the full response body.
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
                  const parsed = JSON.parse(jsonStr);
                  // try multiple locations for incremental content
                  const textChunk = parsed?.choices?.[0]?.delta?.content ?? parsed?.delta?.content ?? parsed?.output?.[0]?.content?.[0]?.text ?? parsed?.candidates?.[0]?.content ?? parsed?.text ?? null;
                  if (textChunk) controller.enqueue(encoder.encode(String(textChunk)));
                } catch (e) {
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
      // try next token budget
      continue;
    }
  }

  throw new Error('All Gemini streaming attempts failed.');
}
