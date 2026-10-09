import { DEFAULT_LOCALE, type Locale } from '@dpl/core';
import * as en from './content/en';
import * as he from './content/he';
import type { Article, Office, Service, TeamMember, Testimonial } from './content/types';

export * from './content/types';

export interface ContentBundle {
  services: Service[];
  team: TeamMember[];
  articles: Article[];
  testimonials: Testimonial[];
  offices: Office[];
}

const BUNDLES: Record<Locale, ContentBundle> = { en, he };

export const getContent = (locale: Locale): ContentBundle => BUNDLES[locale] ?? BUNDLES[DEFAULT_LOCALE];

export const getService = (locale: Locale, slug: string) => getContent(locale).services.find((s) => s.slug === slug);
export const getArticle = (locale: Locale, slug: string) => getContent(locale).articles.find((a) => a.slug === slug);
export const getMember = (locale: Locale, slug: string) => getContent(locale).team.find((m) => m.slug === slug);

/** Slugs are identical in both languages, so static params and the sitemap read them from English. */
export const SERVICE_SLUGS = en.services.map((s) => s.slug);
export const ARTICLE_SLUGS = en.articles.map((a) => a.slug);
export const TEAM_SLUGS = en.team.map((m) => m.slug);

/**
 * The Hebrew `dept` strings are not consistent with each other ("גרמניה ואוסטריה" vs "מחלקת גרמניה ואוסטריה"), so
 * department filters key off the English `dept` of the member with the same slug.
 */
export const DEPARTMENTS: string[] = [...new Set(en.team.map((m) => m.dept))];
export const departmentOf = (slug: string): string => en.team.find((m) => m.slug === slug)?.dept ?? '';

export * from './urls';
