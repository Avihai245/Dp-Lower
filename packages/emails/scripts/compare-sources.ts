/**
 * Prints the structural differences between a template (English) and its design source.
 *   pnpm --filter @dpl/emails exec tsx scripts/compare-sources.ts welcome-3
 *   pnpm --filter @dpl/emails exec tsx scripts/compare-sources.ts welcome-15 germany
 * A clean run prints "identical". Set DESIGN_DIR when the sources live elsewhere.
 */
import { canonicalize, diffLines, hasDesignSources, readSource, sourceFile, sourceFixture } from '../src/fidelity';
import { renderEmail } from '../src/render';
import { ALL_TEMPLATES, type EmailTemplateId } from '../src/types';

const arg = process.argv[2];
const route = (process.argv[3] ?? 'both') as 'germany' | 'austria' | 'both';
if (!hasDesignSources()) {
  console.error('Design sources not found. Set DESIGN_DIR to the folder that contains "Lead Email.html".');
  process.exit(2);
}
const ids = (arg ? [arg] : ALL_TEMPLATES.filter((id) => sourceFile(id))) as EmailTemplateId[];
let bad = 0;
for (const id of ids) {
  const diff = diffLines(canonicalize(readSource(id)), canonicalize(renderEmail(id, sourceFixture(id, route)).html));
  if (diff.every((l) => l.startsWith('  '))) {
    console.log(`${id}: identical`);
  } else {
    bad++;
    console.log(`${id}: DIFFERENT\n${diff.join('\n')}\n`);
  }
}
process.exit(bad ? 1 : 0);
