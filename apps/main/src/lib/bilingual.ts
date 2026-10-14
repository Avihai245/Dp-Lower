import { campaignIsBilingual } from '@dpl/i18n';

/**
 * Are the campaign's public pages published in Hebrew too? See @dpl/i18n campaign-locales. The variable is spelled out
 * so that Next.js inlines it into the browser bundle; tests change it with vi.stubEnv before calling.
 */
export const isBilingual = (): boolean => campaignIsBilingual(process.env.NEXT_PUBLIC_CAMPAIGN_LOCALES);
