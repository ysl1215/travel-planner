/**
 * llmBudget.ts — runtime LLM token metering (shared core), TypeScript port.
 *
 * TS port of the canonical `llm_budget.py` (investment_dashboard / feynman /
 * news-agent). Same pricing + provider-usage parsing + never-throws contract, so
 * travel-planner's rows land in the SAME shared Supabase `token_usage` table with
 * identical columns and cost math. Keep the RATES table in sync with llm_budget.py.
 *
 * Pure logic — NO I/O, NO DB, safe to import anywhere. The per-app glue (a writer
 * that INSERTs, and the hook that grabs the provider response) lives in the app:
 * see travel-planner.glue.md.
 *
 * Design rule (from LLM_BUDGET_PLAN.md): metering MUST NEVER throw — a logging
 * failure can't break an LLM call that already succeeded (and may have cost money).
 */

/** DDL for the shared table. Run once at startup (idempotent). Columns must stay
 *  identical across apps — that identity is what makes the one-table,
 *  different-`project` cross-project cost view work. */
export const TOKEN_USAGE_DDL = `
CREATE TABLE IF NOT EXISTS token_usage (
    id SERIAL PRIMARY KEY,
    ts TIMESTAMPTZ DEFAULT NOW(),
    project TEXT NOT NULL,
    task_type TEXT,
    provider TEXT,
    model TEXT,
    prompt_tok INTEGER DEFAULT 0,
    completion_tok INTEGER DEFAULT 0,
    est_cost_usd NUMERIC(12,6) DEFAULT 0,
    cached BOOLEAN DEFAULT FALSE,
    run_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_token_usage_proj_ts ON token_usage(project, ts);
`;

/** model_id substring -> [input $ per 1k tokens, output $ per 1k tokens].
 *  ESTIMATES from public list prices — est_cost_usd is directional, not a billing
 *  record. ":free" suffixes, ollama/local, agnes, and unknown models -> 0 cost
 *  (tokens are still always recorded). Longest-substring wins so "gemini-2.5-flash"
 *  beats a bare "gemini" entry.
 *  Kept in sync with llm_budget.py RATES; agnes-2.0-flash = internal/$0 (2026-06-26). */
export const RATES: Record<string, [number, number]> = {
  // Google Gemini (direct + via OpenRouter)
  "gemini-2.5-flash": [0.0003, 0.0025],
  "gemini-2.0-flash-lite": [0.000075, 0.0003],
  "gemini-2.0-flash": [0.0001, 0.0004],
  // Anthropic (parity with the shared copy)
  "claude-3-5-haiku": [0.0008, 0.004],
  "claude-3-5-sonnet": [0.003, 0.015],
  // OpenAI-compatible paid examples
  "gpt-4o-mini": [0.00015, 0.0006],
  // Agnes — internal/free at point of use (travel-planner default). Explicit 0
  // so it reads as "known and free", not "unknown". (Same as omitting it; kept
  // for documentation.)
  "agnes-2.0-flash": [0.0, 0.0],
};

export interface Usage {
  prompt_tok: number;
  completion_tok: number;
  total_tok: number;
}

export interface TokenUsageRow {
  project: string;
  task_type: string | null;
  provider: string | null;
  model: string | null;
  prompt_tok: number;
  completion_tok: number;
  est_cost_usd: number;
  cached: boolean;
  run_id: string | null;
}

/** Longest matching substring in RATES wins; unknown/free/local -> [0, 0]. */
function rateFor(modelId: string | null | undefined): [number, number] {
  const mid = (modelId || "").toLowerCase();
  if (mid.includes(":free")) return [0, 0];
  let best: [string, [number, number]] | null = null;
  for (const key of Object.keys(RATES)) {
    if (mid.includes(key) && (best === null || key.length > best[0].length)) {
      best = [key, RATES[key]];
    }
  }
  return best ? best[1] : [0, 0];
}

function toInt(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Pull token counts out of a provider response (or a pre-extracted usage object)
 * into a uniform { prompt_tok, completion_tok, total_tok }. All zero if not
 * parseable (e.g. a streamed response with no usage chunk). Never throws.
 *
 * Accepts:
 *  - an OpenAI-compatible response: { usage: { prompt_tokens, completion_tokens } }
 *    (Agnes / OpenRouter / Gemini-via-openai-compat / local all use this here)
 *  - a bare usage object in any of the three key conventions:
 *    OpenAI {prompt_tokens,completion_tokens}, Gemini
 *    {promptTokenCount,candidatesTokenCount}, Anthropic {input_tokens,output_tokens},
 *    or this module's own {prompt_tok,completion_tok}.
 */
export function normalizeUsage(provider: string | null, resp: any): Usage {
  try {
    if (resp == null) return { prompt_tok: 0, completion_tok: 0, total_tok: 0 };
    // If it looks like a full response, descend into .usage; else treat as usage.
    const u =
      typeof resp === "object" && resp.usage != null ? resp.usage : resp;
    if (typeof u !== "object") {
      return { prompt_tok: 0, completion_tok: 0, total_tok: 0 };
    }
    const p = toInt(
      u.prompt_tokens ?? u.promptTokenCount ?? u.prompt_tok ?? u.input_tokens
    );
    const c = toInt(
      u.completion_tokens ??
        u.candidatesTokenCount ??
        u.completion_tok ??
        u.output_tokens
    );
    return { prompt_tok: p, completion_tok: c, total_tok: p + c };
  } catch {
    return { prompt_tok: 0, completion_tok: 0, total_tok: 0 };
  }
}

/** Directional USD estimate from the RATES table. Unknown model -> 0. */
export function estimateCost(
  modelId: string | null,
  promptTok: number,
  completionTok: number
): number {
  const [inRate, outRate] = rateFor(modelId);
  const cost =
    (promptTok / 1000) * inRate + (completionTok / 1000) * outRate;
  return Math.round(cost * 1e6) / 1e6;
}

export function buildRow(args: {
  project: string;
  taskType: string | null;
  provider: string | null;
  modelId: string | null;
  usage: Usage;
  cached?: boolean;
  runId?: string | null;
}): TokenUsageRow {
  const p = toInt(args.usage.prompt_tok);
  const c = toInt(args.usage.completion_tok);
  return {
    project: args.project,
    task_type: args.taskType,
    provider: args.provider,
    model: args.modelId,
    prompt_tok: p,
    completion_tok: c,
    est_cost_usd: estimateCost(args.modelId, p, c),
    cached: Boolean(args.cached),
    run_id: args.runId ?? null,
  };
}

export type TokenUsageWriter = (row: TokenUsageRow) => void | Promise<void>;

/**
 * normalize -> cost -> build row -> writer(row). NEVER throws (and never rejects).
 *
 * Pass EITHER a raw provider `resp` (gets normalized) OR a pre-extracted `usage`.
 * Returns the row written, or null on any failure. The writer may be async; this
 * awaits and swallows a rejected writer so metering can't surface to the caller.
 */
export async function logUsage(
  writer: TokenUsageWriter,
  args: {
    project: string;
    taskType?: string | null;
    provider?: string | null;
    modelId?: string | null;
    resp?: any;
    usage?: any;
    cached?: boolean;
    runId?: string | null;
  }
): Promise<TokenUsageRow | null> {
  try {
    const usage: Usage =
      args.usage != null
        ? normalizeUsage(args.provider ?? null, args.usage)
        : args.resp != null
          ? normalizeUsage(args.provider ?? null, args.resp)
          : { prompt_tok: 0, completion_tok: 0, total_tok: 0 };
    const row = buildRow({
      project: args.project,
      taskType: args.taskType ?? null,
      provider: args.provider ?? null,
      modelId: args.modelId ?? null,
      usage,
      cached: args.cached,
      runId: args.runId ?? null,
    });
    await writer(row);
    return row;
  } catch {
    // Best-effort. The LLM call already succeeded; a logging failure must not surface.
    return null;
  }
}
