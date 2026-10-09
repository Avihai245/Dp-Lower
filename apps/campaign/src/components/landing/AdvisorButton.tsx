'use client';
import { x } from '@dpl/ui';
import type { ReactNode } from 'react';
import { useLandingUi } from './ui-context';

/**
 * "Speak with an AI Advisor": opens the advisor modal (landing-B). A tiny client leaf so the sections that use it
 * (header, hero) can stay Server Components; the style strings are the prototype's, passed in by the caller.
 */
export function AdvisorButton({
  css,
  hover,
  hideSm,
  children,
}: {
  css: string;
  hover?: string;
  /** hide at <= 960px (prototype: data-hide-sm) */
  hideSm?: boolean;
  children: ReactNode;
}) {
  const { openAdvisor } = useLandingUi();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={openAdvisor}
      {...(hideSm ? { 'data-hide-sm': '' } : {})}
      {...x(css, { className: 'btn', hover })}
    >
      {children}
    </button>
  );
}
