import type { Locale } from '@dpl/core';
import { absoluteUrl, getContent, type Service, type ServiceGroup } from '@dpl/i18n';

/**
 * llms.txt (summary and link index) and llms-full.txt (the same index followed by the full text of every service,
 * article and the team) for AI answer engines. Both are generated from the typed content, with the same structure as
 * the design handoff's files but with the clean URLs. The wording lives in messages/{en,he}/seo.json ("llms").
 */

export interface LlmsStrings {
  title: string;
  summary: string;
  keyFacts: string;
  facts: { firm: string; website: string; contact: string; languages: string };
  office: string;
  groups: Record<ServiceGroup, string>;
  guides: string;
  firm: string;
  links: { about: string; team: string; testimonials: string; contact: string };
  optional: string;
  fullText: string;
  url: string;
  department: string;
  legalBasis: string;
  published: string;
  who: string;
  eligibility: string;
  documents: string;
  process: string;
  questions: string;
  q: string;
  a: string;
  team: string;
}

export interface LlmsOptions {
  locale: Locale;
  /** site origin without a trailing slash, e.g. https://www.lawoffice.org.il */
  origin: string;
  /** campaign app origin, for the eligibility check */
  campaignUrl: string;
  strings: LlmsStrings;
}

const GROUP_ORDER: ServiceGroup[] = ['passports', 'israel', 'other'];
const SEPARATOR = '\n\n---\n\n';

const fill = (template: string, vars: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_m, key: string) => String(vars[key] ?? ''));

/** The summary and the link index, shared by both files. */
function indexLines({ locale, origin, campaignUrl, strings: t }: LlmsOptions): string[] {
  const c = getContent(locale);
  const link = (path: string) => absoluteUrl(origin, locale, path);
  const lines: string[] = [
    `# ${t.title}`,
    '',
    `> ${t.summary}`,
    '',
    t.keyFacts,
    `- ${t.facts.firm}`,
    `- ${fill(t.facts.website, { site: origin, campaign: campaignUrl })}`,
    `- ${t.facts.contact}`,
    `- ${t.facts.languages}`,
    ...c.offices.map((o) => `- ${fill(t.office, { city: o.city, address: o.address, tel: o.tel })}`),
  ];

  for (const group of GROUP_ORDER) {
    lines.push('', `## ${t.groups[group]}`, '');
    for (const s of c.services.filter((x) => x.group === group)) {
      lines.push(`- [${s.name}](${link(`/services/${s.slug}`)}): ${s.headline}`);
    }
  }

  lines.push('', `## ${t.guides}`, '');
  for (const a of c.articles) lines.push(`- [${a.title}](${link(`/insights/${a.slug}`)}): ${a.excerpt}`);

  lines.push(
    '',
    `## ${t.firm}`,
    '',
    `- [${t.links.about}](${link('/about')})`,
    `- [${fill(t.links.team, { count: c.team.length })}](${link('/team')})`,
    `- [${t.links.testimonials}](${link('/testimonials')})`,
    `- [${t.links.contact}](${link('/contact')})`,
  );
  return lines;
}

/** llms.txt */
export function buildLlmsTxt(options: LlmsOptions): string {
  const { locale, origin, strings: t } = options;
  const lines = [
    ...indexLines(options),
    '',
    `## ${t.optional}`,
    '',
    `- [${t.fullText}](${absoluteUrl(origin, locale, '/llms-full.txt')})`,
  ];
  return `${lines.join('\n')}\n`;
}

function serviceBlock(s: Service, url: string, t: LlmsStrings): string {
  const lines = [
    `# ${s.name}`,
    `${t.url}: ${url}`,
    `${t.department}: ${s.dept}`,
    `${t.legalBasis}: ${s.note}`,
    '',
    s.headline,
    '',
    ...s.overview,
    '',
    `## ${t.who}`,
    ...s.who,
    '',
    `## ${t.eligibility}`,
    ...s.eligibility,
    '',
    `## ${t.documents}`,
    ...s.documents,
    '',
    `## ${t.process}`,
    ...s.process,
  ];
  if (s.faq.length) {
    lines.push('', `## ${t.questions}`);
    s.faq.forEach((f, i) => {
      if (i > 0) lines.push('');
      lines.push(`${t.q}: ${f.q}`, `${t.a}: ${f.a}`);
    });
  }
  return lines.join('\n');
}

/** llms-full.txt */
export function buildLlmsFullTxt(options: LlmsOptions): string {
  const { locale, origin, strings: t } = options;
  const c = getContent(locale);
  const link = (path: string) => absoluteUrl(origin, locale, path);

  const services = c.services.map((s) => serviceBlock(s, link(`/services/${s.slug}`), t));
  const articles = c.articles.map((a) =>
    [
      `# ${a.title}`,
      `${t.url}: ${link(`/insights/${a.slug}`)}`,
      `${t.published}: ${a.date} · ${a.author}`,
      '',
      ...a.body,
    ].join('\n'),
  );
  const team = [`# ${t.team}`, ...c.team.map((m) => `- ${m.name}, ${m.role} (${m.dept})`)].join('\n');

  return `${[indexLines(options).join('\n'), ...services, ...articles, team].join(SEPARATOR)}\n`;
}
