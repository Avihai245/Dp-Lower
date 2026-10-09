import 'server-only';
import { DEFAULT_LOCALE, type Locale } from '@dpl/core';
import { notFound } from 'next/navigation';
import { redirect } from '@/i18n/navigation';
import { resolveStaff, toSession, type StaffSession } from './staff';

/**
 * For pages and layouts: anonymous visitors go to the sign-in page (the middleware normally gets there first, this is
 * the backstop for a session the server no longer accepts), signed-in people who are not staff get the 404 page, so
 * /admin does not advertise itself. `adminOnly` pages answer 404 to staff who are not admins.
 */
export async function requireStaffPage(locale: Locale, next = '/admin', opts: { adminOnly?: boolean } = {}): Promise<StaffSession> {
  const a = await resolveStaff();
  if (a.kind === 'anonymous') {
    // `next` is the address as the visitor typed it, so a Hebrew visitor comes back to the Hebrew page
    const target = locale === DEFAULT_LOCALE ? next : `/${locale}${next}`;
    redirect({ href: `/sign-in?next=${encodeURIComponent(target)}`, locale });
  }
  if (a.kind !== 'staff') notFound();
  if (opts.adminOnly && a.staff.role !== 'admin') notFound();
  return toSession(a);
}
