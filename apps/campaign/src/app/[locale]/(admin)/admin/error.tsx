'use client';

import { x } from '@dpl/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useTransition } from 'react';
import { PageFrame } from '@/components/admin/ui';

/**
 * A page of the CRM failed to load (database unreachable, a query error): say so inside the usual frame, with a retry,
 * instead of Next's bare error page. The details only go to the server log; the browser gets the digest in the console.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [pending, start] = useTransition();

  useEffect(() => {
    console.error('[admin] page failed', error.digest ?? '');
  }, [error]);

  // a Server Component error is only cleared by asking the server again, then re-rendering the segment
  const retry = () =>
    start(() => {
      router.refresh();
      reset();
    });

  return (
    <PageFrame title={t('error.title')} lead={t('error.text')}>
      <button
        type="button"
        data-admin-retry
        disabled={pending}
        onClick={retry}
        {...x(
          "background:#14202b;color:#f8f5f0;border:1px solid #14202b;border-radius:999px;padding:11px 20px;font-family:'Manrope',system-ui,sans-serif;font-size:13.5px;font-weight:600;cursor:pointer",
          { hover: 'background:#1e2f3f' },
        )}
      >
        {t('error.retry')}
      </button>
    </PageFrame>
  );
}
