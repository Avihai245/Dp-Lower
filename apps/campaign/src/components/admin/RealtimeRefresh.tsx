'use client';

import { createBrowserSupabase } from '@dpl/db/browser';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';

/** Tables whose changes matter to what the CRM shows (all are in the supabase_realtime publication). */
const TABLES = ['leads', 'documents', 'lead_notes', 'activity_log', 'callback_requests', 'contact_submissions', 'bookings'] as const;

/** Changes that arrive within this window are answered by one refresh. */
const COALESCE_MS = 800;
/** A tab that was in the background this long refreshes when it comes back (the socket may have dropped meanwhile). */
const STALE_AFTER_MS = 30_000;

/**
 * Live updates: any change in the tables above (made by an applicant, another staff member or a Server Action) makes
 * the server components re-run (`router.refresh()`, which keeps client state such as drafts and open dialogs).
 *  - A burst of changes is coalesced into one refresh (the first change starts the timer; later ones join it, so a busy
 *    database can never postpone the refresh forever).
 *  - A tab in the background does not refresh; it catches up once when it is shown again. This also covers a dropped
 *    socket and the one table Realtime does not carry (applications).
 *
 * Renders an invisible marker whose `data-realtime` is the channel state (the end-to-end tests wait for 'subscribed').
 */
export function RealtimeRefresh() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hiddenAt = useRef<number | null>(null);
  const missed = useRef(false);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    const fire = () => {
      timer.current = undefined;
      if (document.visibilityState === 'hidden') missed.current = true;
      else router.refresh();
    };
    const schedule = () => {
      if (!timer.current) timer.current = setTimeout(fire, COALESCE_MS);
    };

    const supabase = createBrowserSupabase();
    const channel = supabase.channel('admin-live');
    for (const table of TABLES) channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule);
    channel.subscribe((s) => setStatus(s === 'SUBSCRIBED' ? 'subscribed' : s.toLowerCase()));

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        return;
      }
      const away = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
      hiddenAt.current = null;
      if (missed.current || away > STALE_AFTER_MS) {
        missed.current = false;
        schedule();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(timer.current);
      timer.current = undefined;
      document.removeEventListener('visibilitychange', onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return <span hidden data-realtime={status} />;
}
