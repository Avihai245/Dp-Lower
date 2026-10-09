import { describe, expect, it } from 'vitest';
import * as en from './content/en';
import * as he from './content/he';
import { ARTICLE_SLUGS, SERVICE_SLUGS, TEAM_SLUGS } from './slugs';

describe('slug lists', () => {
  it.each([
    ['services', SERVICE_SLUGS, en.services, he.services],
    ['articles', ARTICLE_SLUGS, en.articles, he.articles],
    ['team', TEAM_SLUGS, en.team, he.team],
  ] as const)(
    '%s: the spelled-out list is the content, in both languages',
    (_name, slugs, english, hebrew) => {
      expect(slugs).toEqual(english.map((x) => x.slug));
      expect(hebrew.map((x) => x.slug)).toEqual(english.map((x) => x.slug));
      expect(new Set(slugs).size).toBe(slugs.length);
    },
  );
});
