import type { Locale } from '@dpl/core';
import enLanding from '../../messages/en/landing.json';
import enMore from '../../messages/en/landingMore.json';
import enSeo from '../../messages/en/seo.json';
import heLanding from '../../messages/he/landing.json';
import heMore from '../../messages/he/landingMore.json';
import heSeo from '../../messages/he/seo.json';

/**
 * llms.txt (summary and link index) and llms-full.txt (the same, followed by the process, both routes, the team, the fee
 * principles and all ten answers in full) for AI answer engines. Generated from the landing page's own messages, so
 * the files can never say something the page does not. The wording of the headings is in messages/{en,he}/seo.json.
 */
/** The length of the free call as the design states it (the booking itself reads it from the settings table). */
const CALL_MINUTES = 20;

const MESSAGES = {
  en: { landing: enLanding, more: enMore, seo: enSeo.llms },
  he: { landing: heLanding, more: heMore, seo: heSeo.llms },
} as const;

export interface LlmsOptions {
  locale: Locale;
  /** this site's origin without a trailing slash, e.g. https://euro-passports.com */
  origin: string;
  /** the firm's website origin */
  mainSite: string;
}

const fill = (template: string, vars: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_m, key: string) => String(vars[key] ?? ''));

function head({ locale, origin, mainSite }: LlmsOptions): string[] {
  const { landing, more, seo } = MESSAGES[locale];
  const prefix = locale === 'he' ? '/he' : '';
  const otherPrefix = locale === 'he' ? '' : '/he';
  return [
    `# ${seo.title}`,
    '',
    `> ${landing.meta.description}`,
    '',
    `${seo.keyFacts}:`,
    `- ${fill(seo.facts.firm, { url: mainSite })}`,
    `- ${fill(seo.facts.offer, { minutes: CALL_MINUTES })}`,
    `- ${seo.facts.routes}`,
    `- ${seo.facts.languages}`,
    '',
    `## ${seo.pages}`,
    '',
    `- [${landing.meta.serviceName}](${origin}${prefix || '/'}): ${seo.pageLinks.landing}`,
    `- [${landing.header.cta}](${origin}${prefix}/eligibility): ${seo.pageLinks.eligibility}`,
    `- [${more.footer.privacy}](${origin}${prefix}/privacy): ${seo.pageLinks.privacy}`,
    `- [${seo.pageLinks.other}](${origin}${otherPrefix || '/'})`,
  ];
}

export function buildLlmsTxt(o: LlmsOptions): string {
  const { more, seo } = MESSAGES[o.locale];
  return [
    ...head(o),
    '',
    `## ${seo.process}`,
    '',
    ...more.process.steps.map((s, i) => `${i + 1}. ${s.title}`),
    '',
    `## ${seo.questions}`,
    '',
    ...more.faq.items.map((f) => `- ${f.q}`),
    '',
    `> ${seo.caveat}`,
    '',
  ].join('\n');
}

export function buildLlmsFullTxt(o: LlmsOptions): string {
  const { landing, more, seo } = MESSAGES[o.locale];
  return [
    ...head(o),
    '',
    `## ${seo.process}`,
    '',
    more.process.lede,
    '',
    ...more.process.steps.flatMap((s, i) => [`${i + 1}. **${s.title}**: ${s.body}`]),
    '',
    `## ${seo.routesTitle}`,
    '',
    landing.routes.title,
    '',
    ...landing.routes.items.map((r) => `- **${r.title}** (${r.country}): ${r.body}`),
    '',
    `## ${seo.team}`,
    '',
    landing.attorneys.intro,
    '',
    ...landing.attorneys.people.map((p) => `- **${p.name}**, ${p.role}: ${p.bio}`),
    '',
    `## ${seo.fees}`,
    '',
    more.fees.lede,
    '',
    ...more.fees.items.map((f) => `- **${f.title}**: ${f.body}`),
    `- ${more.fees.note}`,
    '',
    `## ${seo.questions}`,
    '',
    more.faq.lede,
    '',
    ...more.faq.items.flatMap((f) => [`### ${f.q}`, '', f.a, '']),
    `> ${seo.caveat}`,
    '',
  ].join('\n');
}
