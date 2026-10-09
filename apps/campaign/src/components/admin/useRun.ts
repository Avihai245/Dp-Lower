'use client';

import { useCallback, useTransition } from 'react';
import { useAdmin } from './AdminProvider';
import { settle } from './settle';
import type { ActionResult } from './types';

/**
 * Runs a Server Action inside a transition: `pending` is true while it is on its way, a failure becomes a toast, and
 * the page behind it re-renders with the new data when the action revalidates.
 */
export function useRun() {
  const { fail } = useAdmin();
  const [pending, start] = useTransition();
  const run = useCallback(
    <T,>(work: () => Promise<ActionResult<T>>, onOk?: (data: T) => void) => {
      start(async () => {
        const res = await settle(work);
        if (res.ok) onOk?.(res.data);
        else fail(res.error);
      });
    },
    [fail],
  );
  return { pending, run };
}
