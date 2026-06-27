/**
 * Local model client.
 *
 * Posts to LOCAL_MODEL_URL (default http://localhost:8000/generate) and supports a couple
 * of common local-server shapes. Intentionally permissive — local servers vary, so it tries
 * to extract a best-effort text field from the response.
 *
 * The model-loop now runs through the shared runWithDescentAndHealth engine, bringing it to
 * parity with agnes/openrouter: per-model health blacklist + 429 backoff (it previously threw
 * immediately on 429/404 with no cache).
 */
import {
  runWithDescentAndHealth,
  backoff429,
  GenerateOpts,
} from "@/lib/openaiCompatProvider";
import { createHealthCache } from "@/lib/healthCache";

const LOCAL_MODEL_KEY = "__local__"; // single logical "model" — the loop still gives it health tracking
const health = createHealthCache({ label: "Local model" });

function baseUrl(): string {
  return process.env.LOCAL_MODEL_URL?.trim() || 'http://localhost:8000/generate';
}

function extractText(parsed: any, raw: string): string {
  if (parsed) {
    if (typeof parsed.text === 'string') return parsed.text;
    if (typeof parsed.output_text === 'string') return parsed.output_text;
    if (parsed?.choices?.[0]?.message?.content) return parsed.choices[0].message.content;
    if (parsed?.choices?.[0]?.text) return parsed.choices[0].text;
    if (parsed?.result && typeof parsed.result === 'string') return parsed.result;
    return JSON.stringify(parsed);
  }
  return raw;
}

export function generateWithLocalModel(
  systemPrompt: string,
  userPrompt: string,
  model?: string,
  opts?: GenerateOpts
): Promise<string> {
  const base = opts?.tokenCandidates ?? [2048, 1024, 512, 256, 128, 64, 32, 16, 8, 1];
  const tokenCandidates = opts?.preferShortFirst ? [...base].reverse() : base;

  return runWithDescentAndHealth<string>({
    models: [model ?? LOCAL_MODEL_KEY],
    tokenCandidates,
    health,
    allFailedMessage: "All local model attempts failed.",
    attempt: async (m, maxTokens) => {
      const body = {
        model: m === LOCAL_MODEL_KEY ? undefined : m,
        system: systemPrompt,
        prompt: userPrompt,
        max_tokens: maxTokens,
        temperature: 0.7,
      };
      const res = await fetch(baseUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let parsed: any = null;
      try { parsed = JSON.parse(raw); } catch { /* ignore */ }

      if (res.ok) return { ok: true, value: extractText(parsed, raw) };
      if (res.status === 402) return { retryLowerTokens: true, status: 402, text: raw };
      return { skipModel: true, status: res.status, text: raw };
    },
  });
}

export async function streamWithLocalModel(messages: { role: string; content: string }[], model?: string): Promise<ReadableStream> {
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const userText = messages.filter((m) => m.role !== 'system').map((m) => `${m.role}: ${m.content}`).join('\n\n');
  const combined = `${system}\n\n${userText}`;
  const tokenCandidates = [2048, 1024, 512, 256, 128, 64, 32, 16, 8, 1];
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return runWithDescentAndHealth<ReadableStream>({
    models: [model ?? LOCAL_MODEL_KEY],
    tokenCandidates,
    health,
    allFailedMessage: "All local streaming attempts failed.",
    attempt: async (m, maxTokens) => {
      const body = {
        model: m === LOCAL_MODEL_KEY ? undefined : m,
        system,
        prompt: combined,
        max_tokens: maxTokens,
        temperature: 0.7,
        stream: true,
      };
      const doFetch = () => fetch(baseUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      let res = await doFetch();
      if (!res.ok) {
        const raw = await res.text();
        if (res.status === 402) return { retryLowerTokens: true, status: 402, text: raw };
        if (res.status === 429) res = await backoff429(doFetch);
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
                    const textChunk = parsed?.choices?.[0]?.delta?.content ?? parsed?.delta?.content ?? parsed?.output?.[0]?.content?.[0]?.text ?? parsed?.text ?? parsed?.candidates?.[0]?.content ?? null;
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
