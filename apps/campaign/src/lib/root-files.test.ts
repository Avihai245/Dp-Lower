import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isRootFile, looksLikeRootFile, ROOT_FILES } from './root-files';

describe('files at the root', () => {
  it('ROOT_FILES is exactly the files of public/ plus the text and metadata routes of the app directory', () => {
    const publicDir = path.join(import.meta.dirname, '../../public');
    const appDir = path.join(import.meta.dirname, '../app');
    const files = readdirSync(publicDir)
      .filter((n) => statSync(path.join(publicDir, n)).isFile())
      .map((n) => `/${n}`);
    const routes = readdirSync(appDir).flatMap((n) => {
      if (statSync(path.join(appDir, n)).isDirectory()) return n.includes('.') ? [`/${n}`] : [];
      return n === 'robots.ts' ? ['/robots.txt'] : n === 'sitemap.ts' ? ['/sitemap.xml'] : [];
    });
    expect([...ROOT_FILES].sort()).toEqual([...files, ...routes].sort());
  });

  it('a single segment with a dot looks like a root file, nothing else does', () => {
    for (const p of ['/favicon.ico', '/wp-login.php', '/.env', '/index.html', '/robots.txt']) expect(looksLikeRootFile(p), p).toBe(true);
    for (const p of ['/', '/privacy', '/he', '/images/logo.webp', '/he/favicon.ico', '/go/abc.def']) expect(looksLikeRootFile(p), p).toBe(false);
    expect(ROOT_FILES.every((f) => isRootFile(f))).toBe(true);
    expect(isRootFile('/favicon.ico.bak')).toBe(false);
  });
});
