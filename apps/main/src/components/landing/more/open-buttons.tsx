'use client';
import { x } from '@dpl/ui';
import type { ReactNode } from 'react';
import { useLandingUi } from '../ui-context';

/** "Speak with an AI Advisor": opens the call-request modal. Styled by the server parent through the prototype's strings. */
export function AdvisorButton({ css, hover, children }: { css: string; hover?: string; children: ReactNode }) {
  const { openAdvisor } = useLandingUi();
  return (
    <button type="button" aria-haspopup="dialog" onClick={openAdvisor} {...x(css, { hover, className: 'btn lm-btn' })}>
      {children}
    </button>
  );
}
