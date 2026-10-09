import { describe, expect, it } from 'vitest';
import { campaignIsBilingual, campaignLocales } from './campaign-locales';

describe('campaign languages setting', () => {
  it('is English only unless Hebrew is asked for', () => {
    for (const raw of [undefined, null, '', 'en', ' EN ', 'fr', 'en,fr']) {
      expect(campaignLocales(raw), String(raw)).toEqual(['en']);
      expect(campaignIsBilingual(raw), String(raw)).toBe(false);
    }
  });

  it('is bilingual when both are listed, in any order or case', () => {
    for (const raw of ['en,he', 'he,en', ' en , HE ', 'en,he,fr']) {
      expect(campaignLocales(raw), raw).toEqual(['en', 'he']);
      expect(campaignIsBilingual(raw), raw).toBe(true);
    }
  });

  it('never drops English, even if only Hebrew is listed', () => {
    expect(campaignLocales('he')).toEqual(['en', 'he']);
  });
});
