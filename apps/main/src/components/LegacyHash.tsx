'use client';

import { useLocale } from 'next-intl';
import { useEffect } from 'react';
import { legacyHashTarget } from '@/lib/legacy-urls';

/**
 * Old shared links like /#/service/german-citizenship put the page in the part of the URL that never reaches the server,
 * so the home page forwards them to the clean address (keeping the query string, which may carry campaign tracking).
 */
export function LegacyHash() {
  const locale = useLocale();
  useEffect(() => {
    const target = legacyHashTarget(window.location.hash, locale);
    if (target) window.location.replace(target + window.location.search);
  }, [locale]);
  return null;
}
