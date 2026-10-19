import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** The CRM (apps/campaign) shows quiz answers with the funnel's wording: its copy of funnel.json must equal the original. */
describe('the campaign app keeps an exact copy of the funnel messages', () => {
  for (const locale of ['en', 'he']) {
    it(locale, () => {
      const read = (app: string) => readFileSync(new URL(`../../../${app}/messages/${locale}/funnel.json`, import.meta.url), 'utf8');
      expect(read('campaign')).toBe(read('main'));
    });
  }
});
