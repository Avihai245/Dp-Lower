import frankHebrew from '@fontsource-variable/frank-ruhl-libre/files/frank-ruhl-libre-hebrew-wght-normal.woff2';
import frankLatin from '@fontsource-variable/frank-ruhl-libre/files/frank-ruhl-libre-latin-wght-normal.woff2';
import assistantHebrew from '@fontsource-variable/assistant/files/assistant-hebrew-wght-normal.woff2';
import assistantLatin from '@fontsource-variable/assistant/files/assistant-latin-wght-normal.woff2';
import { preload } from 'react-dom';

/**
 * Hebrew pages are drawn with these four files (Hebrew and Latin letters of the two families; the English design fonts
 * are not used there). Without a hint the browser asks for them only after the first layout, and when they arrive the
 * text is narrower than the fallback, lines re-wrap and the page jumps (layout shift 0.2 on a 412 px phone). Asked for
 * with the page they are usually there at the first paint. The files are the ones the CSS of the same packages names,
 * so the preload is the very request the CSS would make.
 */
export function preloadHebrewFonts(): void {
  for (const href of [assistantHebrew, assistantLatin, frankHebrew, frankLatin]) {
    preload(href, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  }
}
