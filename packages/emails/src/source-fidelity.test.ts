import { describe, expect, it } from 'vitest';
import { canonicalize, diffLines, hasDesignSources, readSource, sourceFile, sourceFixture } from './fidelity';
import { renderEmail } from './render';
import { ALL_TEMPLATES } from './types';

/**
 * The English emails must be the design, not an approximation: for every source ("Lead Email.html", "Welcome 1-15.html")
 * the rendered markup (tags, attributes, inline styles, copy) is compared node by node with the source file.
 * Skipped when the design bundle is not on this machine (set DESIGN_DIR to point at it).
 */
describe.skipIf(!hasDesignSources())('English emails match the design sources', () => {
  for (const id of ALL_TEMPLATES.filter((t) => sourceFile(t))) {
    it(`${id} is identical to ${sourceFile(id)}`, () => {
      const diff = diffLines(canonicalize(readSource(id)), canonicalize(renderEmail(id, sourceFixture(id)).html));
      expect(diff.filter((l) => !l.startsWith('  '))).toEqual([]);
    });
  }

  it('the <title> and the hidden preheader are the source’s subject and preview text', () => {
    for (const id of ALL_TEMPLATES.filter((t) => sourceFile(t))) {
      const src = readSource(id);
      const mine = renderEmail(id, sourceFixture(id));
      if (id !== 'welcome-15') {
        expect(src).toContain(`<title>${mine.subject.replace(/&/g, '&amp;')}</title>`);
      }
      const preview = /<span[^>]*display:none[^>]*>([^<]*)<\/span>/.exec(src)![1]!;
      expect(mine.preheader).toBe(preview);
    }
  });
});
