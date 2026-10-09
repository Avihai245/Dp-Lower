/**
 * Writes every template x locale to packages/emails/.preview/ (git-ignored) so the emails can be opened in a browser,
 * screenshotted and sent to a test inbox:
 *
 *   pnpm --filter @dpl/emails preview                 -> <id>.<locale>.html, <id>.<locale>.txt and index.html
 *   pnpm --filter @dpl/emails preview --latin-name    -> Hebrew emails addressed to a Latin first name (bidi check)
 *   pnpm --filter @dpl/emails preview --route austria -> the route that email 15 (and the file plate) show
 *
 * The images are copied next to the HTML, so the files render from file:// and from any static server.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sampleContext } from '../src/fixtures';
import { renderEmail } from '../src/render';
import { ALL_TEMPLATES } from '../src/types';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', '.preview');
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => args[args.indexOf(`--${name}`) + 1];
const route = (option('route') ?? 'germany') as 'germany' | 'austria' | 'both' | 'unsure';

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const publicEmail = path.join(here, '..', '..', '..', 'apps', 'campaign', 'public', 'email');
for (const f of ['dpl-logo.png', 'dpl-team.jpg']) fs.copyFileSync(path.join(publicEmail, f), path.join(out, f));

const rows: string[] = [];
for (const id of ALL_TEMPLATES) {
  for (const locale of ['en', 'he'] as const) {
    const name = locale === 'he' && flag('latin-name') ? 'David Cohen' : undefined;
    const ctx = sampleContext(id, locale, { name, route, images: { logo: 'dpl-logo.png', teamPhoto: 'dpl-team.jpg' } });
    const r = renderEmail(id, ctx);
    fs.writeFileSync(path.join(out, `${id}.${locale}.html`), r.html);
    fs.writeFileSync(path.join(out, `${id}.${locale}.txt`), r.text);
    rows.push(
      `<tr><td>${id}</td><td>${locale}</td><td>${r.subject.replace(/</g, '&lt;')}</td><td><a href="${id}.${locale}.html">html</a> · <a href="${id}.${locale}.txt">text</a></td></tr>`,
    );
  }
}
fs.writeFileSync(
  path.join(out, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Email previews</title><style>body{font:14px Arial;margin:24px}td,th{padding:4px 12px;text-align:left}</style><table><tr><th>template</th><th>locale</th><th>subject</th><th>open</th></tr>${rows.join('')}</table>`,
);
console.log(`wrote ${ALL_TEMPLATES.length * 2} emails to ${path.relative(process.cwd(), out) || out}`);
