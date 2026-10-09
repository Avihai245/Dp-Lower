'use client';
import { useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { FROM_COOKIE } from './logic/first-touch';

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
 * "Back to the site" / "Back to site": exits return visitors to the site they came from. Somebody whose latest visit
 * arrived from the firm's own website (source "main-site") goes back there, everybody else to this campaign's landing
 * page. This is the latest deep link, not the first touch (dpl_src), which only the lead's attribution keeps.
 */
export function useLeaveToSite(): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (readFromCookie() === 'main-site') {
      window.location.href = process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? 'http://localhost:3000';
    } else {
      router.push('/');
    }
  }, [router]);
}
