// Shared helpers for rendering the original design prototypes and the new apps the same way.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

export const DESIGN_DIR = process.env.DESIGN_DIR ?? '/tmp/claude-0/-home-user-Dp-Lower/da03b263-f960-5b12-8d27-94b18ce889b9/scratchpad/design/form-design-blockers/project';
// react@18.3.1, react-dom@18.3.1 and @babel/standalone@7.29.0: the prototypes load these from unpkg, which is blocked here.
export const LIBS_DIR = process.env.PROTO_LIBS ?? '/tmp/claude-0/-home-user-Dp-Lower/da03b263-f960-5b12-8d27-94b18ce889b9/scratchpad/proto-libs/node_modules';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

/** Serves the design bundle over http (the prototypes use ES module imports, which need http, not file://). */
export function startProtoServer() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const file = path.join(DESIGN_DIR, rel);
    if (!file.startsWith(DESIGN_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })),
  );
}

// The prototypes load Newsreader and Manrope from Google Fonts. Fetching them is unreliable in sandboxes and the
// fallback fonts have different metrics, so both sides of a comparison use the very same files: the @fontsource
// packages the apps bundle.
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FONT_DIR = path.join(REPO, 'apps/campaign/node_modules/@fontsource-variable');
const FONT_FILES = {
  'manrope.woff2': 'manrope/files/manrope-latin-wght-normal.woff2',
  'newsreader.woff2': 'newsreader/files/newsreader-latin-opsz-normal.woff2',
  'newsreader-italic.woff2': 'newsreader/files/newsreader-latin-opsz-italic.woff2',
};
const FONT_CSS = `
@font-face { font-family: 'Newsreader'; font-style: normal; font-weight: 200 800; font-display: block; src: url(https://fonts.gstatic.com/local/newsreader.woff2) format('woff2'); }
@font-face { font-family: 'Newsreader'; font-style: italic; font-weight: 200 800; font-display: block; src: url(https://fonts.gstatic.com/local/newsreader-italic.woff2) format('woff2'); }
@font-face { font-family: 'Manrope'; font-style: normal; font-weight: 200 800; font-display: block; src: url(https://fonts.gstatic.com/local/manrope.woff2) format('woff2'); }
`;

const UNPKG = {
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': 'react/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': 'react-dom/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js': '@babel/standalone/babel.min.js',
};
// Third parties that would make screenshots non-deterministic (video, analytics). Blocked for BOTH prototype and app.
const BLOCKED = /youtube\.com|youtube-nocookie\.com|ytimg\.com|googletagmanager|google-analytics|connect\.facebook|doubleclick|cloudflare\.com\/turnstile/;

export async function prepareContext(context) {
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (/^https:\/\/fonts\.googleapis\.com\//.test(url)) {
      return route.fulfill({ status: 200, contentType: 'text/css', headers: { 'access-control-allow-origin': '*' }, body: FONT_CSS });
    }
    if (url.startsWith('https://fonts.gstatic.com/local/')) {
      const file = FONT_FILES[url.split('/').pop()];
      if (!file || !fs.existsSync(path.join(FONT_DIR, file))) return route.abort();
      return route.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(path.join(FONT_DIR, file)) });
    }
    if (UNPKG[url]) return route.fulfill({ path: path.join(LIBS_DIR, UNPKG[url]), contentType: 'text/javascript' });
    if (BLOCKED.test(url)) return route.abort();
    return route.continue();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Scrolls through the whole page so IntersectionObserver reveals and lazy images fire, then returns to the top. */
export async function scrollThrough(page, step = 450, delay = 140) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += step) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await sleep(delay);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(700);
}

export async function waitForFonts(page) {
  await page.evaluate(() => document.fonts.ready);
}
