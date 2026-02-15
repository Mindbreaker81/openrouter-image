#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchOpenRouterImageModels, formatModelsAsMarkdown } from '../src/core.js';

async function run() {
  const outDir = path.resolve(process.env.OUTPUT_DIR || './output');
  await fs.mkdir(outDir, { recursive: true });

  const models = await fetchOpenRouterImageModels();
  const md = formatModelsAsMarkdown(models);

  const lines = md.split(/\r?\n/);
  // keep header block until the table header separator, then filter data rows
  const headerLines = [];
  const rows = [];
  let inTable = false;
  for (const l of lines) {
    if (!inTable) {
      headerLines.push(l);
      if (l.startsWith('|---')) inTable = true;
      continue;
    }
    // data rows
    if (!l.startsWith('|')) continue;
    const cols = l.split('|').map((c) => c.trim());
    // cols: ['', id, name, provider, imageOutput, costUsd, notes, '']
    const cost = cols[5] ?? '';
    if (cost !== '—' && cost !== '') {
      rows.push(l);
    }
  }

  const out = `${headerLines.join('\n')}\n${rows.join('\n')}\n`;
  const outPath = path.join(outDir, 'models-clean.md');
  await fs.writeFile(outPath, out, 'utf8');
  console.log('Wrote', outPath);
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
