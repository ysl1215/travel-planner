#!/usr/bin/env node
/* eslint-disable */
'use strict';

const fs = require('fs');
const path = require('path');

const providers = ['openrouter', 'openai'];
const arg = process.argv[2];

if (!arg) {
  console.log('Usage: node scripts/choose-ai-provider.js <provider>');
  console.log('Available providers: ' + providers.join(', '));
  process.exit(1);
}

const provider = arg.toLowerCase();
if (!providers.includes(provider)) {
  console.error('Unknown provider:', provider);
  process.exit(1);
}

const envPath = path.resolve(process.cwd(), '.env.local');
let content = '';
if (fs.existsSync(envPath)) {
  content = fs.readFileSync(envPath, 'utf8');
}

const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
let found = false;
const newLines = lines.map(line => {
  if (line.startsWith('AI_PROVIDER=')) {
    found = true;
    return `AI_PROVIDER=${provider}`;
  }
  return line;
});

if (!found) newLines.push(`AI_PROVIDER=${provider}`);

fs.writeFileSync(envPath, newLines.join('\n') + '\n');
console.log(`Updated ${envPath}: AI_PROVIDER=${provider}`);
if (provider === 'openrouter') console.log('Make sure OPENROUTER_API_KEY is set in your environment or .env.local');
if (provider === 'openai') console.log('Make sure OPENAI_API_KEY is set in your environment or .env.local');
