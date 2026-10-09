'use client';

import { s } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { useAdmin } from './AdminProvider';
import { formatRel, isolate } from './format';
import type { LeadRow } from './model';

/** Label helpers shared by the table, the board and the lead page. */

export const sub = (pct: number): string => `color-mix(in srgb, var(--color-text) ${pct}%, transparent)`;

/** "Marriage cert." / "5 documents" / "Account" / "Nothing": what the lead is waiting on. */
export function useWaitingLabel() {
  const t = useTranslations('admin');
  return useCallback(
    (r: Pick<LeadRow, 'waiting' | 'missingDocs' | 'missingDocTypes'>): string => {
      switch (r.waiting) {
        case 'nothing':
          return t('waiting.nothing');
        case 'portal':
          return t('waiting.portal');
        case 'application':
          return t('waiting.application');
        case 'applicant':
          return t('waiting.applicant');
        case 'documents':
          return r.missingDocs === 1 && r.missingDocTypes[0]
            ? t(`docs.short.${r.missingDocTypes[0]}`)
            : t('waiting.documents', { count: r.missingDocs });
      }
    },
    [t],
  );
}

/** Relative time against the shared clock: `ago(iso)` and `ago(iso, { long: true })`. */
export function useAgo() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const { now } = useAdmin();
  return useCallback(
    (iso: string, opts?: { long?: boolean }): string => formatRel((k, v) => t(k, v), locale, iso, now, opts),
    [t, locale, now],
  );
}

/** Wraps a Latin or numeric value for a Hebrew sentence (bidi isolates); a plain string in English. */
export function useIsolate() {
  const locale = useLocale();
  return useCallback((v: string | number): string => (locale === 'he' ? isolate(v) : String(v)), [locale]);
}

/** Notes badge in the table: a small gold pill with the count. */
export function NotesBadge({ count, label }: { count: number; label: string }) {
  if (!count) return null;
  return (
    <span
      title={label}
      aria-label={label}
      style={s(
        'display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;margin-left:8px;border-radius:999px;background:#f6f0e4;color:#7a5c2c;font-size:11px;font-weight:700;vertical-align:1px',
      )}
    >
      {count}
    </span>
  );
}
