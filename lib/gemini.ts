/**
 * Gemini AI client wrapper.
 *
 * Supports either a generic GEMINI_API_URL (user-supplied endpoint) with
 * Authorization: Bearer GEMINI_API_KEY, or the Google Generative Language API using
 * GEMINI_API_KEY as an API key (v1beta2 models/{model}:generate).
 *
 * Gemini's request/response shapes are NOT OpenAI-compatible, so this keeps its own native
 * fetch + extractText, but routes the model-loop through the shared runWithDescentAndHealth
 * engine. That brings it to parity with agnes/openrouter: a per-model health blacklist and
 * 429 exponential backoff (previously it threw immediately on 429/404 with no cache).
 */
import {
  runWithDescentAndHealth,
  backoff429,
  GenerateOpts,
} from "@/lib/openaiCompatProvider";
import { createHealthCache } from "@/lib/healthCache";

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-1";

const health = createHealthCache({ label: "Gemini model" });

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

/** Build the native Gemini request (generic endpoint vs Google GenLang API). */
function buildRequest(modelToUse: string, combined: string, maxTokens: number, stream: boolean) {
  const apiUrl = process.env.GEMINI_API_URL?.trim();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiUrl && !apiKey) {
    throw new Error('GEMINI_API_KEY or GEMINI_API_URL must be set to use Gemini provider');
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let url: string;
  let body: any;
  if (apiUrl) {
    url = apiUrl;
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    body = { model: modelToUse, input: { text: combined }, temperature: 0.7, max_output_tokens: maxTokens, ...(stream ? { stream: true } : {}) };
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta2/models/${encodeURIComponent(modelToUse)}:generate?key=${apiKey}`;
    body = { input: { text: combined }, maxOutputTokens: maxTokens, temperature: 0.7, ...(stream ? { stream: true } : {}) };
  }
  return { url, headers, body };
}

export function generateWithGemini(
  systemPrompt: string,
  userPrompt: string,
  model?: string,
  opts?: GenerateOpts
): Promise<string> {
  const modelToUse = model ?? DEFAULT_MODEL;
  const combined = `${systemPrompt}\n\n${userPrompt}`;
  const base = opts?.tokenCandidates ?? [4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 1];
  const tokenCandidates = opts?.preferShortFirst ? [...base].reverse() : base;

  return runWithDescentAndHealth<string>({
    models: [modelToUse],
    tokenCandidates,
    health,
    allFailedMessage: "All Gemini attempts failed.",
    attempt: async (m, maxTokens) => {
      const { url, headers, body } = buildRequest(m, combined, maxTokens, false);
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const raw = await res.text();
      let parsed: any = null;
      try { parsed = JSON.parse(raw); } catch { /* ignore */ }

      if (res.ok) {
        const out = extractText(parsed, raw);
        return { ok: true, value: out ?? (parsed ? JSON.stringify(parsed) : raw) };
      }
      if (res.status === 402) return { retryLowerTokens: true, status: 402, text: raw };
      return { skipModel: true, status: res.status, text: raw };
    },
  });
}

export async function streamWithGemini(messages: { role: string; content: string }[], model?: string): Promise<ReadableStream> {
  const modelToUse = model ?? DEFAULT_MODEL;
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const userText = messages.filter((m) => m.role !== 'system').map((m) => `${m.role}: ${m.content}`).join('\n\n');
  const combined = `${system}\n\n${userText}`;
  const tokenCandidates = [2048, 1024, 512, 256, 128, 64, 32, 16, 8, 1];
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return runWithDescentAndHealth<ReadableStream>({
    models: [modelToUse],
    tokenCandidates,
    health,
    allFailedMessage: "All Gemini streaming attempts failed.",
    attempt: async (m, maxTokens) => {
      const { url, headers, body } = buildRequest(m, combined, maxTokens, true);
      let res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const raw = await res.text();
        if (res.status === 402) return { retryLowerTokens: true, status: 402, text: raw };
        if (res.status === 429) {
          res = await backoff429(() => fetch(url, { method: 'POST', headers, body: JSON.stringify(body) }));
        }
        if (!res.ok) return { skipModel: true, status: res.status, text: raw };
      }

      const bodyStream = res.body;
      if (!bodyStream) {
        const text = await res.text();
        return { ok: true, value: new ReadableStream({ start(c) { c.enqueue(encoder.encode(text)); c.close(); } }) };
      }
      return {
        ok: true,
        value: new ReadableStream({
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
                  const jsonStr: string = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
                  if (jsonStr === '[DONE]' || !jsonStr) continue;
                  try {
                    const parsed = JSON.parse(jsonStr);
                    const textChunk = parsed?.choices?.[0]?.delta?.content ?? parsed?.delta?.content ?? parsed?.output?.[0]?.content?.[0]?.text ?? parsed?.candidates?.[0]?.content ?? parsed?.text ?? null;
                    if (textChunk) controller.enqueue(encoder.encode(String(textChunk)));
                  } catch { /* ignore non-json chunks */ }
                }
              }
            } finally {
              reader.releaseLock();
              controller.close();
            }
          },
        }),
      };
    },
  });
}
