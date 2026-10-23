import type { ReactNode } from 'react';
import { IconCheck } from './icons';

export type StepperState = 'done' | 'current' | 'next';
export interface StepperItem {
  key: string;
  state: StepperState;
  label: ReactNode;
  meta?: ReactNode;
}

function Dot({ state, n }: { state: StepperState; n: number }) {
  return (
    <span className="ui-step-dot" aria-hidden="true">
      {state === 'done' ? <IconCheck size={16} strokeWidth={2.4} /> : state === 'current' ? <span className="ui-step-pulse" /> : n}
    </span>
  );
}

/**
 * A row of stages joined by a line (done in green, the current one ringed in gold). Below 1001px the same stages are a
 * vertical list instead; only one of the two is displayed (and read) at a time. The horizontal list comes first in the
 * document, so it is the one found first by text.
 */
export function Stepper({ items, label }: { items: StepperItem[]; label?: string }) {
  return (
    <>
      <ol className="ui-steps" aria-label={label}>
        {items.map((it, i) => (
          <li key={it.key} className="ui-step" data-state={it.state} aria-current={it.state === 'current' ? 'step' : undefined}>
            <Dot state={it.state} n={i + 1} />
            <span className="ui-step-label">{it.label}</span>
            {it.meta != null && <span className="ui-step-meta">{it.meta}</span>}
          </li>
        ))}
      </ol>
      <ol className="ui-vsteps" aria-label={label}>
        {items.map((it, i) => (
          <li key={it.key} className="ui-vstep" data-state={it.state} aria-current={it.state === 'current' ? 'step' : undefined}>
            <div className="ui-vstep-rail">
              <Dot state={it.state} n={i + 1} />
            </div>
            <div className="ui-vstep-body">
              <span className="ui-step-label">{it.label}</span>
              {it.meta != null && <span className="ui-step-meta">{it.meta}</span>}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
