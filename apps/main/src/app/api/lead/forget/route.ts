import { campaignSiteUrl } from '@dpl/db/env';
import { clearLeadCookie } from '@dpl/db/lead-session';
import { campaignIsBilingual } from '@dpl/i18n';
import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/lead/forget: the second half of "Sign out" in the portal. The lead cookie that "Go to my portal" starts from
 * belongs to this site, so the portal (another domain) cannot clear it; it sends the browser here, the cookie is
 * cleared, and the browser goes on to the portal's sign-in page. Without this a shared computer would keep a way into
 * the previous person's portal after they signed out. The destination is fixed, and clearing a cookie is harmless
 * if someone else triggers it.
 */
export async function GET(req: NextRequest) {
  await clearLeadCookie();
  // `?l=he`: the person was reading Hebrew, so the sign-in page they land on is the Hebrew one (when it exists)
  const hebrew = req.nextUrl.searchParams.get('l') === 'he' && campaignIsBilingual(process.env.NEXT_PUBLIC_CAMPAIGN_LOCALES);
  const res = NextResponse.redirect(`${campaignSiteUrl().replace(/\/$/, '')}${hebrew ? '/he' : ''}/sign-in`, 303);
  res.headers.set('cache-control', 'no-store');
  return res;
}
