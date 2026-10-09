import { describe, expect, it } from 'vitest';
import enMore from '../../messages/en/landingMore.json';
import heMore from '../../messages/he/landingMore.json';
import { buildLlmsFullTxt, buildLlmsTxt } from './llms';

const opts = { origin: 'https://euro-passports.com', mainSite: 'https://www.lawoffice.org.il' } as const;

describe('llms.txt of the campaign', () => {
  it('is a short index in English with absolute links on this site and the firm site', () => {
    const t = buildLlmsTxt({ ...opts, locale: 'en' });
    expect(t.startsWith('# Decker Pex Levi: German and Austrian citizenship by descent')).toBe(true);
    expect(t).toContain('](https://euro-passports.com/eligibility)');
    expect(t).toContain('](https://euro-passports.com/privacy)');
    expect(t).toContain('](https://euro-passports.com/he)');
    expect(t).toContain('https://www.lawoffice.org.il');
    expect(t).not.toMatch(/undefined|\{\w+\}/);
    // every question is listed, none of the answers is
    for (const f of enMore.faq.items) expect(t).toContain(f.q);
    expect(t).not.toContain(enMore.faq.items[0]!.a);
  });

  it('is Hebrew on the Hebrew edition, with the Hebrew paths', () => {
    const t = buildLlmsTxt({ ...opts, locale: 'he' });
    expect(t).toMatch(/^# דקר פקס לוי/);
    expect(t).toContain('](https://euro-passports.com/he/eligibility)');
    expect(t).toContain('](https://euro-passports.com/he/privacy)');
    expect(t).toContain('](https://euro-passports.com/)');
    expect(t).not.toMatch(/undefined|\{\w+\}/);
  });

  it('the full text carries every answer, both routes and the fee principles', () => {
    for (const [locale, more] of [['en', enMore], ['he', heMore]] as const) {
      const t = buildLlmsFullTxt({ ...opts, locale });
      for (const f of more.faq.items) {
        expect(t).toContain(`### ${f.q}`);
        expect(t).toContain(f.a);
      }
      for (const item of more.fees.items) expect(t).toContain(item.body);
      expect(t).toContain(more.fees.note);
      expect(t).toMatch(/116\(2\)/);
      expect(t).toMatch(/58c/);
      expect(t).not.toMatch(/undefined|\{\w+\}/);
    }
  });
});
