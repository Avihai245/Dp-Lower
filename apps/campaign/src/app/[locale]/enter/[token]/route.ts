import type { NextRequest } from 'next/server';
import { createAdminSupabase } from '@dpl/db/admin';
import { readEnterToken } from '@dpl/db/links';
import { claimOnce } from '@dpl/db/single-use';
import { AccountEmailInUse, openPortalSession } from '@dpl/db/portal-session';
import { localizePath } from '@/components/auth/logic/paths';
import { localeOf, redirectTo } from '@/server/auth';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ locale: string; token: string }> };

/**
 * /enter/[token] and /he/enter/[token]: where "Go to my portal" lands. The eligibility funnel now lives on the
 * firm's own site, so that button cannot sign the browser in directly (its request would carry no cookie here) —
 * instead it mints a short-lived (2-minute), purpose-scoped token there and sends the browser across to us with it.
 *
 * Unlike the emailed /go link, this token is never mailed anywhere, so it proves nothing about the mailbox: we open
 * the session WITHOUT markEmailVerified / mailboxProven, exactly like the old same-site /api/portal/enter did. An
 * address that already has a different sign-in account is still never taken over this way (see portal-session.ts);
 * that visitor is sent to sign in with its password or a reset link instead.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { locale, token } = await params;
  const lang = localeOf(locale);
  const toSignIn = (error: string) => redirectTo(req, localizePath(`/sign-in?error=${error}&source=main-site`, lang));

  const link = await readEnterToken(token);
  if (!link) return toSignIn('link');

  try {
    const db = createAdminSupabase();
    // one use: the address of this redirect may end up in a log or a history, and must not work a second time
    if (!(await claimOnce(db, token))) return toSignIn('link');
    const { data: lead } = await db.from('leads').select('*').eq('id', link.leadId).maybeSingle();
    if (!lead || lead.session_epoch !== link.epoch) return toSignIn('link');

    await openPortalSession(db, lead);
    return redirectTo(req, localizePath('/portal', lang));
  } catch (e) {
    if (e instanceof AccountEmailInUse) return toSignIn('accountExists');
    console.error('[enter] could not open the portal', e);
    return toSignIn('generic');
  }
}

/** Link checkers and prefetchers probe with HEAD or GET-without-navigation; a bare HEAD must never sign anybody in. */
export function HEAD() {
  return new Response(null, { status: 200 });
}
