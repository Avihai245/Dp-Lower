import type { Locale } from '@dpl/core';
import enSeo from '../../messages/en/seo.json';
import heSeo from '../../messages/he/seo.json';

/**
 * llms.txt and llms-full.txt (identical here: there is too little content on this domain to need two sizes) for AI
 * answer engines. This app is the client sign-in and portal only now — the eligibility funnel and the rest of the
 * firm's content moved to the firm's own site, under /apply, and these files point there instead of describing it.
 * The wording is in messages/{en,he}/seo.json ("llms").
 */

const MESSAGES = { en: enSeo.llms, he: heSeo.llms } as const;

export interface LlmsOptions {
  locale: Locale;
  /** this site's origin without a trailing slash, e.g. https://euro-passports.com */
  origin: string;
  /** the firm's website origin */
  mainSite: string;
}

const fill = (template: string, vars: Record<string, string>): string => template.replace(/\{(\w+)\}/g, (_m, key: string) => vars[key] ?? '');

function body({ locale, origin, mainSite }: LlmsOptions): string {
  const t = MESSAGES[locale];
  const prefix = locale === 'he' ? '/he' : '';
  return `${[
    `# ${t.title}`,
    '',
    `> ${t.summary}`,
    '',
    `${t.keyFacts}:`,
    `- ${fill(t.facts.firm, { mainSite })}`,
    `- ${fill(t.facts.start, { apply: `${mainSite}/apply` })}`,
    `- ${t.facts.languages}`,
    '',
    `## ${t.portal}`,
    '',
    `- [${t.portalLinks.signIn}](${origin}${prefix}/sign-in)`,
    '',
  ].join('\n')}\n`;
}

export const buildLlmsTxt = body;
export const buildLlmsFullTxt = body;
