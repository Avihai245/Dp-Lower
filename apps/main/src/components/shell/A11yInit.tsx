import { A11Y_INIT_SCRIPT } from '@/lib/shell/a11y';

/**
 * Applies the stored accessibility preferences (zoom, filters, ...) to <html> while the document is still being parsed,
 * before anything is painted, so a returning visitor never sees the page change. Rendered first in the site layout.
 */
export function A11yInit() {
  return <script dangerouslySetInnerHTML={{ __html: A11Y_INIT_SCRIPT }} />;
}
