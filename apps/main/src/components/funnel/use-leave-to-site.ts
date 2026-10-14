'use client';
import { useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { FROM_COOKIE } from '@dpl/core';

/** Where the current visit came from, as the middleware stored it from the latest deep link (`dpl_from`), read in the browser. */
export function readFromCookie(): string | null {
  try {
    const m = new RegExp(`(?:^|; )${FROM_COOKIE}=([^;]*)`).exec(document.cookie);
    return m ? decodeURIComponent(m[1]!) : null;
  } catch {
    return null;
  }
}

/**
 * "Back to the site" / "Back to site": exits return visitors to the page they came from. Somebody whose latest visit
 * arrived from the firm's own website (source "main-site") goes back to its homepage; everybody else to this
 * funnel's own landing page (/apply). This is the latest deep link, not the first touch (dpl_src), which only the
 * lead's attribution keeps. Both destinations are on this same site now, so both are plain internal navigations.
 */
export function useLeaveToSite(): () => void {
  const router = useRouter();
  return useCallback(() => {
    router.push(readFromCookie() === 'main-site' ? '/' : '/apply');
  }, [router]);
}
