#!/usr/bin/env node
'use strict';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const OPENROUTER_DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
const GEMINI_DEFAULT_MODEL = 'gemini-1';
const LOCAL_DEFAULT_URLS = [
  process.env.LOCAL_MODEL_URL?.trim(),
  'http://127.0.0.1:11434/api/generate',
  'http://localhost:8000/generate',
].filter(Boolean);

function usage() {
  console.log('Usage: node scripts/provider-probe.js <openrouter|gemini|local|all> [prompt]');
  console.log('Example: node scripts/provider-probe.js local "Reply with OK."');
}

function parseText(response) {
  if (!response) return '';
  if (typeof response.text === 'string') return response.text;
  if (typeof response.output_text === 'string') return response.output_text;
  if (response.choices?.[0]?.message?.content) return response.choices[0].message.content;
  if (response.choices?.[0]?.text) return response.choices[0].text;
  if (response.result && typeof response.result === 'string') return response.result;
  if (typeof response.response === 'string') return response.response;
  return JSON.stringify(response);
}

async function probeOpenRouter(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required');

  const model = process.env.OPENROUTER_MODEL?.trim() || OPENROUTER_DEFAULT_MODEL;
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/ysl1215/travel-planner',
      'X-Title': 'Travel Planner AI',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a diagnostics assistant. Reply with a short OK.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 16,
      temperature: 0,
    }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${raw}`);
  const parsed = JSON.parse(raw);
  return { provider: 'openrouter', model, text: parseText(parsed) };
}

async function probeGemini(prompt) {
  const apiUrl = process.env.GEMINI_API_URL?.trim();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiUrl && !apiKey) throw new Error('GEMINI_API_KEY or GEMINI_API_URL is required');

  const model = process.env.GEMINI_MODEL?.trim() || GEMINI_DEFAULT_MODEL;
  const headers = { 'Content-Type': 'application/json' };
  let url;
  let body;

  if (apiUrl) {
    url = apiUrl;
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    body = {
      model,
      input: { text: prompt },
      temperature: 0,
      max_output_tokens: 16,
    };
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta2/models/${encodeURIComponent(model)}:generate?key=${apiKey}`;
    body = {
      input: { text: prompt },
      maxOutputTokens: 16,
      temperature: 0,
    };
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${raw}`);
  const parsed = JSON.parse(raw);
  return { provider: 'gemini', model, text: parseText(parsed) };
}

async function resolveLocalModel(baseUrl) {
  const explicit = process.env.LOCAL_MODEL?.trim();
  if (explicit) return explicit;
  if (!/\/api\/generate\/?$/.test(baseUrl)) return undefined;

  const tagsUrl = baseUrl.replace(/\/api\/generate\/?$/, '/api/tags');
  const res = await fetch(tagsUrl);
  if (!res.ok) throw new Error(`Could not list local models from ${tagsUrl}: ${res.status}`);

  const parsed = await res.json();
  const models = (parsed.models ?? [])
    .map((entry) => entry.name?.trim() || entry.model?.trim() || '')
    .filter(Boolean);

  const preferred = models.find((name) => /^qwen3(?::latest)?$/i.test(name)) || models[0];
  if (!preferred) throw new Error(`No local Ollama models found at ${tagsUrl}. Set LOCAL_MODEL or pull a model.`);
  return preferred;
}

async function probeLocal(prompt) {
  let lastError = null;
  for (const baseUrl of LOCAL_DEFAULT_URLS) {
    try {
      const model = await resolveLocalModel(baseUrl);
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(model ? { model } : {}),
          system: 'You are a diagnostics assistant. Reply with a short OK.',
          prompt,
          max_tokens: 16,
          options: { num_predict: 16 },
          temperature: 0,
          stream: false,
        }),
      });

      const raw = await res.text();
      if (!res.ok) throw new Error(`Local ${res.status} at ${baseUrl}: ${raw}`);
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      return { provider: 'local', model, baseUrl, text: parseText(parsed) || raw };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('No local model URLs configured');
}

async function main() {
  const target = (process.argv[2] || process.env.AI_PROVIDER || 'all').toLowerCase();
  const prompt = process.argv.slice(3).join(' ').trim() || 'Reply with OK.';

  const probes = target === 'all'
    ? ['openrouter', 'gemini', 'local']
    : [target];

  if (!probes.every((name) => ['openrouter', 'gemini', 'local'].includes(name))) {
    usage();
    process.exit(1);
  }

  for (const probe of probes) {
    try {
      let result;
      if (probe === 'openrouter') result = await probeOpenRouter(prompt);
      if (probe === 'gemini') result = await probeGemini(prompt);
      if (probe === 'local') result = await probeLocal(prompt);

      console.log(`[${probe}] OK`);
      if (result.model) console.log(`model: ${result.model}`);
      if (result.baseUrl) console.log(`baseUrl: ${result.baseUrl}`);
      console.log(`response: ${String(result.text).slice(0, 200)}`);
    } catch (err) {
      console.error(`[${probe}] FAILED:`, err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
