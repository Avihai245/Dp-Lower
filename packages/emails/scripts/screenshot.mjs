#!/usr/bin/env node
// Screenshots rendered previews (run `pnpm --filter @dpl/emails preview` first).
//
//   node packages/emails/scripts/screenshot.mjs <out-dir> [--width 700] [--scale 1] <name>...
//   node packages/emails/scripts/screenshot.mjs /tmp/shots welcome-1.en welcome-1.he file-open.he
//   node packages/emails/scripts/screenshot.mjs /tmp/shots all
//
// <name> is "<template>.<locale>" (the file name in .preview without the extension). Full-page PNGs, one browser launch.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const preview = path.join(here, '..', '.preview');
const args = process.argv.slice(2);
const out = args.shift();
if (!out) {
  console.error('usage: screenshot.mjs <out-dir> [--width N] [--scale N] <name>... | all');
  process.exit(2);
}
let width = 700;
let scale = 1;
const names = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--width') width = Number(args[++i]);
  else if (args[i] === '--scale') scale = Number(args[++i]);
  else names.push(args[i]);
}
const list = names.includes('all')
  ? fs
      .readdirSync(preview)
      .filter((f) => f.endsWith('.html') && f !== 'index.html')
      .map((f) => f.replace(/\.html$/, ''))
  : names;

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: scale, locale: 'en-US', reducedMotion: 'no-preference' });
const page = await context.newPage();
for (const name of list) {
  await page.goto(`file://${path.join(preview, `${name}.html`)}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  const file = path.join(out, `${name}${width !== 700 ? `-${width}` : ''}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`saved ${file}`);
}
await browser.close();
