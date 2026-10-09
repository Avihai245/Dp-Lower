#!/usr/bin/env node
// node tools/visual/compare.mjs a.png b.png diff.png [--side side-by-side.png]
// Pads both images to the same size, writes a red-highlight diff and prints the mismatch ratio.
import fs from 'node:fs';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const [a, b, out, ...rest] = process.argv.slice(2);
if (!a || !b || !out) {
  console.error('usage: compare.mjs a.png b.png diff.png [--side side.png]');
  process.exit(2);
}
const sideOut = rest[0] === '--side' ? rest[1] : null;
const A = PNG.sync.read(fs.readFileSync(a));
const B = PNG.sync.read(fs.readFileSync(b));
const w = Math.max(A.width, B.width);
const h = Math.max(A.height, B.height);
const pad = (img) => {
  const p = new PNG({ width: w, height: h, fill: true });
  p.data.fill(255);
  PNG.bitblt(img, p, 0, 0, img.width, img.height, 0, 0);
  return p;
};
const PA = pad(A);
const PB = pad(B);
const diff = new PNG({ width: w, height: h });
const bad = pixelmatch(PA.data, PB.data, diff.data, w, h, { threshold: 0.12, includeAA: false });
fs.writeFileSync(out, PNG.sync.write(diff));
if (sideOut) {
  const s = new PNG({ width: w * 2 + 20, height: h, fill: true });
  s.data.fill(200);
  PNG.bitblt(PA, s, 0, 0, w, h, 0, 0);
  PNG.bitblt(PB, s, 0, 0, w, h, w + 20, 0);
  fs.writeFileSync(sideOut, PNG.sync.write(s));
}
const ratio = bad / (w * h);
console.log(JSON.stringify({ aSize: [A.width, A.height], bSize: [B.width, B.height], mismatchRatio: Number(ratio.toFixed(4)), mismatchPixels: bad }));
