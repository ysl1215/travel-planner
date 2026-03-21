/**
 * Local model client.
 *
 * Posts to LOCAL_MODEL_URL (default http://localhost:8000/generate) and supports
 * a couple common local server shapes. This is intentionally permissive — local
 * model servers vary in API shape, so the client tries to extract a best-effort
 * text field from the response.
 */

type LocalOpts = { preferShortFirst?: boolean; tokenCandidates?: number[] };

export async function generateWithLocalModel(
  systemPrompt: string,
  userPrompt: string,
  model?: string,
  opts?: LocalOpts
): Promise<string> {
  const baseUrl = process.env.LOCAL_MODEL_URL?.trim() || 'http://localhost:8000/generate';

  const defaultTokenCandidates = opts?.tokenCandidates ?? [2048, 1024, 512, 256, 128, 64, 32, 16, 8, 1];
  const tokenCandidates = opts?.preferShortFirst ? [...defaultTokenCandidates].reverse() : defaultTokenCandidates;
  let lastError: string | null = null;

  for (const maxTokens of tokenCandidates) {
    try {
      const body = {
        model: model ?? undefined,
        system: systemPrompt,
        prompt: userPrompt,
        max_tokens: maxTokens,
        temperature: 0.7,
      };

      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const raw = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
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

  throw new Error(`All local model attempts failed. Last error: ${lastError ?? 'unknown'}`);
}
