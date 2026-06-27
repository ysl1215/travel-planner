#!/usr/bin/env node
/* eslint-disable */
'use strict';

const fs = require('fs');
const path = require('path');

const providers = ['agnes', 'nova', 'openrouter', 'gemini', 'local'];
const arg = process.argv[2];

if (!arg) {
  console.log('Usage: node scripts/choose-ai-provider.js <provider>');
  console.log('Available providers: ' + providers.join(', '));
  process.exit(1);
}

const provider = arg.toLowerCase();
if (!providers.includes(provider)) {
  console.error('Unknown provider:', provider);
  console.error('Available: ' + providers.join(', '));
  process.exit(1);
}

const envPath = path.resolve(process.cwd(), '.env.local');
let content = '';
if (fs.existsSync(envPath)) {
  content = fs.readFileSync(envPath, 'utf8');
}

// Preserve blank lines and comments — only rewrite the AI_PROVIDER line.
const hadTrailingNewline = content === '' || content.endsWith('\n');
const lines = content.replace(/\n$/, '').split(/\r?\n/);
// Match an AI_PROVIDER assignment with optional leading whitespace/`export`.
const providerRe = /^\s*(?:export\s+)?AI_PROVIDER\s*=/;
let found = false;
const newLines = lines.map(line => {
  if (providerRe.test(line)) {
    found = true;
    return `AI_PROVIDER=${provider}`;
  }
  return line;
});

if (!found) {
  // Drop a leading empty element from an empty file so we don't write a blank first line.
  if (newLines.length === 1 && newLines[0] === '') newLines.length = 0;
  newLines.push(`AI_PROVIDER=${provider}`);
}

fs.writeFileSync(envPath, newLines.join('\n') + (hadTrailingNewline ? '\n' : ''));
console.log(`Updated ${envPath}: AI_PROVIDER=${provider}`);

const keyHints = {
  agnes: 'AGNES_API_KEY',
  nova: 'NOVA_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  gemini: 'GEMINI_API_KEY',
  local: 'LOCAL_MODEL_URL (default: http://localhost:8000/generate)',
};
const hint = keyHints[provider];
if (hint) {
  const envKey = hint.split(' ')[0];
  if (!process.env[envKey] && !content.includes(envKey)) {
    console.warn(`⚠ Warning: ${hint} not found in environment or .env.local`);
  } else {
    console.log(`Make sure ${hint} is set in your environment or .env.local`);
  }
}
