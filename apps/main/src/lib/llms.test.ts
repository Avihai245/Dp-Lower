import { ARTICLE_SLUGS, getContent, SERVICE_SLUGS, TEAM_SLUGS } from '@dpl/i18n';
import { describe, expect, it } from 'vitest';
import enSeo from '../../messages/en/seo.json';
import heSeo from '../../messages/he/seo.json';
import { buildLlmsFullTxt, buildLlmsTxt, type LlmsOptions } from './llms';

const ORIGIN = 'https://www.lawoffice.org.il';
const CAMPAIGN = 'https://euro-passports.com';
const en: LlmsOptions = { locale: 'en', origin: ORIGIN, campaignUrl: CAMPAIGN, strings: enSeo.llms };
const he: LlmsOptions = { locale: 'he', origin: ORIGIN, campaignUrl: CAMPAIGN, strings: heSeo.llms };

const count = (haystack: string, needle: string | RegExp) =>
  typeof needle === 'string' ? haystack.split(needle).length - 1 : (haystack.match(needle) ?? []).length;

describe('llms.txt', () => {
  const txt = buildLlmsTxt(en);

  it('opens with the firm summary and key facts, as the design handoff file does', () => {
    expect(
      txt.startsWith(
        '# Decker Pex Levi Law Offices\n\n> Israeli law firm (offices in Tel Aviv / Ramat Gan and Jerusalem)',
      ),
    ).toBe(true);
    expect(txt).toContain(
      '\nKey facts:\n- Firm: Decker Pex Levi Law Offices (founding partners Joshua Pex and Michael Decker; managing partner Anat Levi)\n',
    );
    expect(txt).toContain(`- Website: ${ORIGIN}  ·  German/Austrian eligibility check: ${CAMPAIGN}\n`);
    expect(txt).toContain('- Contact: office@lawoffice.org.il · +972-3-372-4722\n');
    expect(txt).toContain('- Tel Aviv: 11 Menachem Begin Road, Ramat Gan.');
    expect(txt).toContain('- Jerusalem: 10 Yad Harutzim Street');
  });

  it('links every service and article with clean URLs, grouped as the design groups them', () => {
    for (const slug of SERVICE_SLUGS) expect(txt).toContain(`](${ORIGIN}/services/${slug}):`);
    for (const slug of ARTICLE_SLUGS) expect(txt).toContain(`](${ORIGIN}/insights/${slug}):`);
    for (const path of ['/about', '/team', '/testimonials', '/contact'])
      expect(txt).toContain(`](${ORIGIN}${path})`);
    for (const heading of [
      'European and foreign citizenship',
      'Immigration to Israel',
      'Other practice areas',
      'Guides',
      'Firm',
      'Optional',
    ]) {
      expect(txt).toContain(`\n## ${heading}\n`);
    }
    expect(txt).toContain('- [Team (37 people)]');
    expect(txt).toContain(`- [Full text for AI systems](${ORIGIN}/llms-full.txt)`);
    expect(count(txt, /^- \[/gm)).toBe(SERVICE_SLUGS.length + ARTICLE_SLUGS.length + 4 + 1);
  });

  it('has no prototype-style ?p= URLs, no unfilled placeholders and ends with a newline', () => {
    expect(txt).not.toContain('?p=');
    expect(txt).not.toMatch(/\{\w+\}|undefined|\[object/);
    expect(txt.endsWith('\n')).toBe(true);
  });

  it('keeps the services of one group together, in content order', () => {
    const passports = txt.slice(txt.indexOf('## European'), txt.indexOf('## Immigration to Israel'));
    expect(passports.indexOf('german-citizenship')).toBeLessThan(passports.indexOf('austrian-citizenship'));
    expect(passports).toContain('canada-immigration');
    expect(passports).not.toContain('/services/aliyah');
  });
});

describe('llms-full.txt', () => {
  const txt = buildLlmsFullTxt(en);
  const c = getContent('en');

  it('starts with the same index as llms.txt (minus the optional link)', () => {
    const index = buildLlmsTxt(en).split('\n## Optional')[0]!;
    expect(txt.startsWith(index)).toBe(true);
    expect(txt).not.toContain('## Optional');
  });

  it('has the full text of all 22 services in the design handoff structure', () => {
    for (const s of c.services) {
      expect(txt).toContain(
        `# ${s.name}\nURL: ${ORIGIN}/services/${s.slug}\nDepartment: ${s.dept}\nLegal basis: ${s.note}\n\n${s.headline}\n\n${s.overview.join('\n')}\n\n## Who it is for\n${s.who.join('\n')}\n\n## Eligibility\n`,
      );
      for (const line of [...s.who, ...s.eligibility, ...s.documents, ...s.process])
        expect(txt).toContain(`\n${line}\n`);
    }
    expect(count(txt, '\n## Who it is for\n')).toBe(22);
    expect(count(txt, '\n## Eligibility\n')).toBe(22);
    expect(count(txt, '\n## Documents\n')).toBe(22);
    expect(count(txt, '\n## Process\n')).toBe(22);
  });

  it('prints the Questions block only for services that have questions, with every Q and A', () => {
    const withFaq = c.services.filter((s) => s.faq.length > 0);
    const total = withFaq.reduce((n, s) => n + s.faq.length, 0);
    expect(withFaq.length).toBeGreaterThan(0);
    expect(withFaq.length).toBeLessThan(22);
    expect(count(txt, '\n## Questions\n')).toBe(withFaq.length);
    expect(count(txt, /^Q: /gm)).toBe(total);
    expect(count(txt, /^A: /gm)).toBe(total);
    for (const s of withFaq) for (const f of s.faq) expect(txt).toContain(`Q: ${f.q}\nA: ${f.a}`);
  });

  it('has the 8 articles with date, department and every paragraph', () => {
    for (const a of c.articles) {
      expect(txt).toContain(
        `# ${a.title}\nURL: ${ORIGIN}/insights/${a.slug}\nPublished: ${a.date} · ${a.author}\n\n${a.body.join('\n')}`,
      );
    }
  });

  it('lists the whole team at the end', () => {
    const team = txt.slice(txt.lastIndexOf('\n# Team\n'));
    expect(count(team, /^- /gm)).toBe(c.team.length);
    expect(c.team).toHaveLength(TEAM_SLUGS.length);
    expect(team).toContain('- Joshua Pex, Attorney · Founding Partner (Partners)');
  });

  it('has no ?p= URLs, no unfilled placeholders and is a sensible size', () => {
    expect(txt).not.toContain('?p=');
    expect(txt).not.toMatch(/\{\w+\}|undefined|\[object/);
    expect(txt.length).toBeGreaterThan(40_000);
    expect(txt.endsWith('\n')).toBe(true);
  });
});

describe('Hebrew llms files', () => {
  const index = buildLlmsTxt(he);
  const full = buildLlmsFullTxt(he);

  it('use /he URLs and Hebrew headings', () => {
    expect(index.startsWith(`# ${heSeo.llms.title}\n\n> משרד עורכי דין ישראלי`)).toBe(true);
    for (const slug of SERVICE_SLUGS) expect(index).toContain(`](${ORIGIN}/he/services/${slug}):`);
    for (const slug of ARTICLE_SLUGS) expect(index).toContain(`](${ORIGIN}/he/insights/${slug}):`);
    expect(index).toContain(`](${ORIGIN}/he/llms-full.txt)`);
    expect(index).toContain('## הגירה לישראל');
    expect(full).toContain('\n## למי זה מיועד\n');
    expect(count(full, '\n## למי זה מיועד\n')).toBe(22);
    expect(full).toContain('\nש: ');
    expect(full).toContain('\nת: ');
  });

  it('have no unfilled placeholders and no ?p= URLs', () => {
    for (const txt of [index, full]) {
      expect(txt).not.toMatch(/\{\w+\}|undefined|\[object/);
      expect(txt).not.toContain('?p=');
    }
  });
});
