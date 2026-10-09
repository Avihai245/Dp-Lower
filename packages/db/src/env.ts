/**
 * Environment access. `process.env.X` must be referenced statically for Next.js to inline NEXT_PUBLIC_* values
 * in browser bundles, so every variable is spelled out here.
 */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const supabaseUrl = (): string => required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
/** Publishable (sb_publishable_...) or legacy anon key. */
export const supabaseAnonKey = (): string =>
  required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
/** Secret (sb_secret_...) or legacy service_role key. Server only. */
export const supabaseServiceKey = (): string =>
  required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);

export const siteUrl = (): string => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';
export const mainSiteUrl = (): string => process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? 'http://localhost:3000';
export const campaignSiteUrl = (): string => process.env.NEXT_PUBLIC_CAMPAIGN_URL ?? 'http://localhost:3001';

export const isProd = (): boolean => process.env.NODE_ENV === 'production';

/**
 * Cookies get the Secure flag in production, except when the site is served from a local address (`next start` on
 * http://localhost for end-to-end tests), where browsers and clients would otherwise refuse to send them back.
 */
export const secureCookies = (): boolean => isProd() && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(process.env.NEXT_PUBLIC_SITE_URL ?? '');

/** Secret for the lead cookie and unsubscribe/booking tokens. Required in production. */
export function appSecret(): string {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 32) return s;
  if (isProd()) throw new Error('APP_SECRET must be set (32+ random characters) in production');
  return 'dev-only-secret-dev-only-secret-dev-only-secret';
}
