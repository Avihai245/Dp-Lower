'use client';
import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { cookiesToWrite } from '@/lib/attribution';

/**
 * Records first-touch attribution (`dpl_src`, `dpl_utm`, see lib/attribution.ts) from the URL of the visit. For a
 * platform deep link (`?entry=...`) the landing page renders only this component with `redirectTo`: the cookies are
 * written first and then the visitor is sent on, so the origin of a lead that arrives through a deep link is not lost
 * (a server redirect could not set cookies). Renders nothing.
 */
export function SourceCapture({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();

  useEffect(() => {
    try {
      for (const c of cookiesToWrite(
        window.location.search,
        document.cookie,
        window.location.protocol === 'https:',
      )) {
        document.cookie = c;
      }
    } catch {
      /* cookies blocked: attribution is best effort */
    }
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  return null;
}
