import { describe, expect, it } from 'vitest';
import { buildLlmsFullTxt, buildLlmsTxt, type LlmsOptions } from './llms';

const opts = { origin: 'https://euro-passports.com', mainSite: 'https://www.lawoffice.org.il' } as const;

describe('llms.txt of the client portal', () => {
  it('is a short English document pointing at the firm site and the eligibility check, with a sign-in link', () => {
    const o: LlmsOptions = { ...opts, locale: 'en' };
    const t = buildLlmsTxt(o);
    expect(t.startsWith('# Decker Pex Levi — client sign-in')).toBe(true);
    expect(t).toContain('Key facts:\n- Firm: Decker Pex Levi Law Offices. Website: https://www.lawoffice.org.il\n');
    expect(t).toContain('- Start a free German/Austrian citizenship eligibility check: https://www.lawoffice.org.il/apply\n');
    expect(t).toContain('- Languages: English and Hebrew\n');
    expect(t).toContain('## Client portal\n\n- [Sign in](https://euro-passports.com/sign-in)\n');
    expect(t).not.toMatch(/undefined|\{\w+\}|\[object/);
    expect(t.endsWith('\n')).toBe(true);
  });

  it('is Hebrew on the Hebrew edition, with the /he sign-in link', () => {
    const o: LlmsOptions = { ...opts, locale: 'he' };
    const t = buildLlmsTxt(o);
    expect(t).toMatch(/^# דקר פקס לוי/);
    expect(t).toContain('](https://euro-passports.com/he/sign-in)');
    expect(t).not.toMatch(/undefined|\{\w+\}|\[object/);
    expect(t.endsWith('\n')).toBe(true);
  });

  it('llms-full.txt is identical to llms.txt: there is too little content here to need two sizes', () => {
    for (const locale of ['en', 'he'] as const) {
      const o: LlmsOptions = { ...opts, locale };
      expect(buildLlmsFullTxt(o)).toBe(buildLlmsTxt(o));
    }
  });
});
