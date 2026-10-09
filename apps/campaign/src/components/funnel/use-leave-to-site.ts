'use client';
import { useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { SRC_COOKIE } from './logic/first-touch';

/** First-touch source the landing page stored in the `dpl_src` cookie, read in the browser. */
export function readSourceCookie(): string | null {
  try {
    const m = new RegExp(`(?:^|; )${SRC_COOKIE}=([^;]*)`).exec(document.cookie);
    return m ? decodeURIComponent(m[1]!) : null;
  } catch {
    return null;
  }
}

/**
 * "Back to the site" / "Back to site": exits return visitors to the site they came from. Somebody who arrived from
 * the firm's own website (source "main-site") goes back there, everybody else to this campaign's landing page.
 */
export function useLeaveToSite(): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (readSourceCookie() === 'main-site') {
      window.location.href = process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? 'http://localhost:3000';
    } else {
      router.push('/');
    }
  }, [router]);
}
