import { describe, expect, it } from 'vitest';
import { legacyHashTarget, legacyPath } from './legacy-urls';

describe('legacyPath', () => {
  it('maps the prototype page kinds to the clean paths', () => {
    expect(legacyPath('service', 'german-citizenship')).toBe('/services/german-citizenship');
    expect(legacyPath('article', 'notary-jerusalem')).toBe('/insights/notary-jerusalem');
    expect(legacyPath('attorney', 'michael-decker')).toBe('/team/michael-decker');
    for (const kind of ['about', 'services', 'team', 'testimonials', 'insights', 'media', 'contact', 'privacy', 'terms', 'accessibility']) {
      expect(legacyPath(kind, undefined)).toBe(`/${kind}`);
    }
  });
  it('knows nothing else', () => {
    expect(legacyPath(undefined, undefined)).toBeNull();
    expect(legacyPath('home', undefined)).toBeNull();
    expect(legacyPath('admin', undefined)).toBeNull();
    expect(legacyPath('about', 'x')).toBeNull();
    expect(legacyPath('widget', 'x')).toBeNull();
  });
});

describe('legacyHashTarget', () => {
  it('turns an old #/ address into the clean page, in the visitor language', () => {
    expect(legacyHashTarget('#/service/german-citizenship', 'en')).toBe('/services/german-citizenship');
    expect(legacyHashTarget('#/service/german-citizenship', 'he')).toBe('/he/services/german-citizenship');
    expect(legacyHashTarget('#/about', 'en')).toBe('/about');
    expect(legacyHashTarget('#/attorney/michael-decker', 'he')).toBe('/he/team/michael-decker');
  });
  it('leaves everything else where it is', () => {
    for (const hash of ['', '#', '#top', '#/', '#/nonsense', '#/service/no-such-service', '#/service/%E0%A4%A', '#/contact/extra', '#leadform']) {
      expect(legacyHashTarget(hash, 'en'), hash).toBeNull();
    }
  });
});
