'use client';

import { useEffect } from 'react';
import { rememberFirstTouch } from '@/lib/shell/attribution';

/** Remembers the campaign parameters and referrer of the first page view, for the enquiry forms (see lib/shell/attribution.ts). */
export function AttributionCapture() {
  useEffect(() => {
    try {
      rememberFirstTouch(
        window.location.search,
        document.referrer,
        window.location.host,
        window.sessionStorage,
      );
    } catch {
      // storage unavailable
    }
  }, []);
  return null;
}
