#!/usr/bin/env node
// Screenshot a URL (the new app) or a prototype file, with the same blocking/settling rules.
//
//   node tools/visual/shot.mjs app   http://localhost:3101/he   out.png [--width 1440] [--height 900] [--full] [--click "text=Check"]
//   node tools/visual/shot.mjs proto "DP Lower - Lending Page.dc.html" out.png [--query "?entry=signin"] [--lang he] [--full]
//
// --full captures the whole page (after scrolling through it). --wait <ms> extra settle time. --click <selector> clicks first
// (repeatable). --eval <js> runs JavaScript in the page before the shot (repeatable). --scale 1|2 device scale factor.
import { chromium } from '@playwright/test';
import { prepareContext, scrollThrough, startProtoServer, waitForFonts } from './lib.mjs';

const [mode, target, out, ...rest] = process.argv.slice(2);
if (!mode || !target || !out) {
  console.error('usage: shot.mjs <app|proto> <url|file> <out.png> [--width N] [--height N] [--full] [--query ?x] [--click sel] [--eval js] [--wait ms]');
  process.exit(2);
}
const opt = { click: [], eval: [] };
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a === '--full') opt.full = true;
  else if (a === '--click') opt.click.push(rest[++i]);
  else if (a === '--eval') opt.eval.push(rest[++i]);
  else if (a.startsWith('--')) opt[a.slice(2)] = rest[++i];
}
const width = Number(opt.width ?? 1440);
const height = Number(opt.height ?? 900);

const server = mode === 'proto' ? await startProtoServer() : null;
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: Number(opt.scale ?? 1),
  reducedMotion: 'no-preference',
  locale: opt.lang === 'he' ? 'he-IL' : 'en-US',
});
await prepareContext(context);
const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && console.error('[console.error]', m.text().slice(0, 300)));
page.on('pageerror', (e) => console.error('[pageerror]', e.message.slice(0, 300)));

const url = mode === 'proto' ? `${server.url}/${encodeURIComponent(target)}${opt.query ?? ''}${opt.lang === 'he' ? (opt.query ? '&' : '?') + 'lang=he' : ''}` : target;
await page.goto(url, { waitUntil: 'load' });
await waitForFonts(page);
await page.waitForTimeout(Number(opt.wait ?? 1800));
for (const sel of opt.click) {
  await page.locator(sel).first().click();
  await page.waitForTimeout(500);
}
for (const js of opt.eval) {
  await page.evaluate(js);
  await page.waitForTimeout(400);
}
if (opt.full) await scrollThrough(page);
await page.screenshot({ path: out, fullPage: !!opt.full });
console.log(`saved ${out} (${mode}, ${width}x${height}${opt.full ? ', full page' : ''})`);
await browser.close();
server?.close();
