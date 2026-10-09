import { s } from '@dpl/ui';
import { Fragment, type CSSProperties, type ReactNode } from 'react';

/** Small pieces shared by the funnel and sign-in screens. Plain markup: usable from Server and Client Components. */

export const SANS = "font-family: 'Manrope', system-ui, sans-serif";

/** The frame of every screen: full height, paper background, ink text. */
export function Page({ children, className = 'fx' }: { children: ReactNode; className?: string }) {
  return (
    <div className={className} style={s(`min-height: 100vh; display: flex; flex-direction: column; background: #f8f5f0; color: #14202b; ${SANS}`)}>
      {children}
    </div>
  );
}

export function Logo({ alt, height = 32, flex = false }: { alt: string; height?: number; flex?: boolean }) {
  return <img src="/images/DPL_logo-sm.webp" alt={alt} width={320} height={114} decoding="async" style={s(`height: ${height}px; width: auto; display: block${flex ? '; flex: none' : ''}`)} />;
}

type Step = 'details' | 'call' | 'result';
const ORDER: Step[] = ['details', 'call', 'result'];

const CIRCLE = 'width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; flex: none; font-size: 11.5px';
const DONE = { text: 'color: #7a5c2c', circle: `${CIRCLE}; background: #a07a3c; color: #f8f5f0; border: 1px solid #a07a3c` };
const ACTIVE = { text: 'color: #14202b', circle: `${CIRCLE}; background: #14202b; color: #f8f5f0; border: 1px solid #14202b` };
const TODO = { text: 'color: #9a948a', circle: `${CIRCLE}; background: transparent; color: #9a948a; border: 1px solid #d8cfc0` };

/**
 * Answers -> Details -> Call -> Result. Answers is always done on these screens. The current step keeps its label on
 * small screens (the others lose theirs: data-step-label), and a connector is gold once the step before it is done.
 */
export function Stepper({ current, labels, ariaLabel }: { current: Step; labels: { answers: string; details: string; call: string; result: string }; ariaLabel: string }) {
  const at = ORDER.indexOf(current) + 2; // step number of `current` (Answers is step 1)
  const items = [
    { n: 1, label: labels.answers },
    { n: 2, label: labels.details },
    { n: 3, label: labels.call },
    { n: 4, label: labels.result },
  ];
  return (
    <div data-stepper role="group" aria-label={ariaLabel} style={s('margin-left: auto; display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; letter-spacing: 0.04em')}>
      {items.map((it, i) => {
        const state = it.n < at ? DONE : it.n === at ? ACTIVE : TODO;
        return (
          <Fragment key={it.n}>
            <span aria-current={it.n === at ? 'step' : undefined} style={s(`display: flex; align-items: center; gap: 8px; ${state.text}`)}>
              <span aria-hidden="true" style={s(state.circle)}>
                {it.n < at ? '✓' : it.n}
              </span>
              <span {...(it.n === at ? {} : { 'data-step-label': '' })}>{it.label}</span>
            </span>
            {i < items.length - 1 && (
              <span aria-hidden="true" data-step-line style={s(`width: 22px; height: 1px; background: ${it.n < at ? '#a07a3c' : '#d8cfc0'}; flex: none`)} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/** Header of the details / booking / result screens: logo on one side, the stepper on the other. */
export function StepHeader({ current, logoAlt, labels, ariaLabel }: { current: Step; logoAlt: string; labels: Parameters<typeof Stepper>[0]['labels']; ariaLabel: string }) {
  return (
    <>
      <div data-pad style={s('max-width: 100%; width: 100%; margin: 0 auto; padding: 20px clamp(20px, 4.6vw, 160px); display: flex; align-items: center; gap: 20px; box-sizing: border-box')}>
        <Logo alt={logoAlt} height={32} flex />
        <Stepper current={current} labels={labels} ariaLabel={ariaLabel} />
      </div>
      <div style={s('height: 1px; background: #ece6dc')} />
    </>
  );
}

export const H1_STYLE =
  "font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(32px, 3.4vw, 46px); line-height: 1.1; letter-spacing: -0.018em; margin: 0 0 14px; text-wrap: balance";
export const LEDE_STYLE = 'font-size: 17.5px; line-height: 1.6; color: #5f5a52; margin: 0 0 34px; text-wrap: pretty';

/** The prototype's underlined text button ("Skip for now", "Email me my result instead", ...). */
export const LINK_BUTTON =
  `background: none; border: 0; padding: 6px 0; ${SANS}; font-size: 14.5px; color: #5f5a52; cursor: pointer; text-decoration: underline; text-decoration-color: #d8cfc0; text-underline-offset: 4px`;

export const PRIMARY_BUTTON =
  `width: 100%; background: #14202b; color: #f8f5f0; border: 1px solid #14202b; ${SANS}; font-weight: 600; padding: 19px; font-size: 15.5px; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; transition: background 160ms ease`;

export function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#a07a3c" strokeWidth="1.6" style={s('flex: none')} aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function CheckIcon({ size = 18, color = '#3f6b4f', style }: { size?: number; color?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" style={style} aria-hidden="true">
      <path d="m4 12 5 5L20 6" />
    </svg>
  );
}

/** Reads a failed API call as the key of the message to show (rate limit, network, anything else). */
export function errorKey(error: string | null): 'rateLimited' | 'network' | 'generic' {
  return error === 'rate_limited' ? 'rateLimited' : error === 'network' ? 'network' : 'generic';
}
