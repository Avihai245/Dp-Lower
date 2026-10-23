'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { MailLine } from './MailLine';
import type { DetailsValues } from './MyDetailsModal';
import { NotSubmittedView } from './NotSubmittedView';
import type { PortalState } from './model/types';
import { PortalShell } from './PortalShell';
import { SubmittedView } from './SubmittedView';
import { Tour } from './Tour';

/** Time between arriving on the dashboard and the tour starting by itself (the prototype's 700ms). */
const TOUR_AUTO_START_MS = 700;

/**
 * The portal home. Before submission it shows progress and the next step (and offers the guided tour: it starts by
 * itself once, on the first visit); after submission it shows the status of the case.
 */
export function Dashboard({ initial }: { initial: PortalState }) {
  const [state, setState] = useState(initial);
  const [tourOn, setTourOn] = useState(false);
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

  return (
    <PortalShell active="overview" lead={lead} onTour={submitted ? undefined : () => setTourOn(true)} onDetailsSaved={saved}>
      <div className="ui-stack">
        <MailLine email={lead.email} passwordSet={lead.passwordSet} submitted={submitted} />
        {submitted ? <SubmittedView state={state} /> : <NotSubmittedView state={state} />}
      </div>
      {tourOn && !submitted && <Tour onClose={closeTour} />}
    </PortalShell>
  );
}
