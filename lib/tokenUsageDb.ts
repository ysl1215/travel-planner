/**
 * tokenUsageDb.ts — travel-planner's per-app glue: the Supabase writer.
 *
 * SERVER-ONLY. Never import this from client components — it opens a postgres
 * connection. travel-planner's LLM calls run in app/api/* routes (server), so
 * the metering hook there can import this safely.
 *
 * Writes to the SHARED Supabase `token_usage` table (the same one feynman /
 * dashboard / news-agent use), tagged project="travel-planner". Requires a
 * DATABASE_URL env var = the shared Supabase postgres connection string
 * (the pooled connection string from Supabase → Project Settings → Database).
 *
 * Dependency: `pg`  (npm i pg ; npm i -D @types/pg)
 */

import { Pool } from "pg";
import { TOKEN_USAGE_DDL, type TokenUsageRow } from "./llmBudget";

let _pool: Pool | null = null;
let _schemaReady = false;

function pool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null; // no-op when unconfigured (e.g. local dev without creds)
  if (_pool === null) {
    _pool = new Pool({
      connectionString: url,
      max: 2,
      // Supabase requires TLS; relax verification for the pooled endpoint.
      ssl: { rejectUnauthorized: false },
    });
  }
  return _pool;
}

/** Run the idempotent DDL once per process. Best-effort; never throws. */
export async function ensureTokenUsageSchema(): Promise<void> {
  if (_schemaReady) return;
  const p = pool();
  if (!p) return;
  try {
    await p.query(TOKEN_USAGE_DDL);
    _schemaReady = true;
  } catch {
    // leave _schemaReady false; the INSERT itself may still succeed if the
    // table already exists (created by another app's first deploy).
  }
}

/** Writer for llmBudget.logUsage. Best-effort — logUsage already swallows, but
 *  this also guards its own connection failure and no-ops when DATABASE_URL is
 *  unset, so local dev without creds simply records nothing. */
export async function writeTokenUsage(row: TokenUsageRow): Promise<void> {
  const p = pool();
  if (!p) return;
  try {
    await ensureTokenUsageSchema();
    await p.query(
      `INSERT INTO token_usage
         (project, task_type, provider, model, prompt_tok, completion_tok,
          est_cost_usd, cached, run_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        row.project,
        row.task_type,
        row.provider,
        row.model,
        row.prompt_tok,
        row.completion_tok,
        row.est_cost_usd,
        row.cached,
        row.run_id,
      ]
    );
  } catch {
    // best-effort; metering must never surface to the caller
  }
}
