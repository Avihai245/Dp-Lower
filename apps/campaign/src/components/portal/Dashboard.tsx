'use client';
import { s } from '@dpl/ui';
import { createBrowserSupabase } from '@dpl/db/browser';
import { useLocale } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { DashboardHeader } from './DashboardHeader';
import { MailLine } from './MailLine';
import { MyDetailsModal, type DetailsValues } from './MyDetailsModal';
import { NotSubmittedView } from './NotSubmittedView';
import type { PortalState } from './model/types';
import { SubmittedView } from './SubmittedView';
import { Timeline } from './Timeline';
import { Tour } from './Tour';

/** Time between arriving on the dashboard and the tour starting by itself (the prototype's 700ms). */
const TOUR_AUTO_START_MS = 700;

/**
 * The portal home. Before submission it shows progress and the next step (and offers the guided tour: it starts by
 * itself once, on the first visit); after submission it shows the status of the case.
 */
export function Dashboard({ initial }: { initial: PortalState }) {
  const locale = useLocale();
  const [state, setState] = useState(initial);
  const [tourOn, setTourOn] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const tourSeen = useRef(initial.lead.tourDone);
  const { lead } = state;
  const submitted = !!lead.submittedAt;

  // the tour starts once, a moment after the first arrival, and only while the application is still open
  useEffect(() => {
    if (submitted || tourSeen.current) return;
    const id = setTimeout(() => setTourOn(true), TOUR_AUTO_START_MS);
    return () => clearTimeout(id);
  }, [submitted]);

  const closeTour = useCallback(() => {
    setTourOn(false);
    if (!tourSeen.current) {
      tourSeen.current = true;
      void api('/api/portal/tour-done', { method: 'POST' });
    }
  }, []);

  const saved = useCallback((values: DetailsValues) => {
    setState((prev) => ({ ...prev, lead: { ...prev.lead, fullName: values.fullName, phone: values.phone } }));
  }, []);

  const signOut = async () => {
    try {
      // this browser only: signing out here must not end the applicant's sessions on their other devices
      await createBrowserSupabase().auth.signOut({ scope: 'local' });
    } catch {
      /* the server call below closes the session too */
    }
    // also clears the httpOnly lead cookie, which could otherwise open the portal again without a password
    await api('/api/portal/sign-out', { method: 'POST' });
    window.location.assign(locale === 'he' ? '/he' : '/');
  };

  return (
    <div style={s('min-height: 100vh; animation: fadeIn 300ms ease both')}>
      <DashboardHeader
        email={lead.email}
        showTour={!submitted}
        onTour={() => setTourOn(true)}
        onDetails={() => setDetailsOpen(true)}
        onSignOut={signOut}
      />
      <MailLine email={lead.email} passwordSet={lead.passwordSet} submitted={submitted} />
      <Timeline timeline={state.timeline} />
      {submitted ? <SubmittedView state={state} /> : <NotSubmittedView state={state} />}
      {tourOn && !submitted && <Tour onClose={closeTour} />}
      {detailsOpen && <MyDetailsModal lead={lead} onClose={() => setDetailsOpen(false)} onSaved={saved} />}
    </div>
  );
}
