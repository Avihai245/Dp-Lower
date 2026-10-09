'use client';

import type { LeadRoute } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useAdmin } from './AdminProvider';

/** Small shared pieces of the CRM, with the prototype's style strings copied verbatim. */

// -- style strings reused across panels ------------------------------------------------------------------------------

export const CARD = 'background:#fff;border:1px solid #e8e1d5;border-radius:18px;padding:22px 22px 20px';
export const KICKER =
  'font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#7a5c2c;margin:0 0 14px';
export const KICKER_INLINE = 'font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#7a5c2c;margin:0';
export const MUTED = 'font-size:13px;color:#736d64';
/** the outlined pill used for "Edit", "← All leads", "Edit details & password" */
export const PILL =
  "background:#fff;border:1px solid #e2dbcf;border-radius:999px;font-family:'Manrope',system-ui,sans-serif;font-weight:600;color:#14202b;cursor:pointer";
export const SMALL_BTN = `${PILL};font-size:12px;padding:6px 12px;white-space:nowrap`;

// -- "?" help popover ------------------------------------------------------------------------------------------------

export function HelpTip({ id, align = 'right' }: { id: string; align?: 'left' | 'right' }) {
  const t = useTranslations('admin');
  const { helpOpen, setHelpOpen } = useAdmin();
  const open = helpOpen === id;
  const btn =
    "width:20px;height:20px;padding:0;border-radius:50%;display:grid;place-items:center;cursor:pointer;font-family:'Manrope',system-ui,sans-serif;font-size:11.5px;font-weight:700;line-height:1;letter-spacing:0;transition:border-color 140ms ease, background 140ms ease;" +
    `border:1px solid ${open ? '#14202b' : '#cfc6b8'};background:${open ? '#14202b' : '#fff'};color:${open ? '#f8f5f0' : '#736d64'}`;
  return (
    <span data-help style={s('position:relative;display:inline-flex;vertical-align:middle;flex:none')}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setHelpOpen(open ? null : id);
        }}
        aria-label={t('a11y.help')}
        aria-expanded={open}
        aria-controls={open ? `help-${id}` : undefined}
        {...x(btn, open ? {} : { hover: 'border-color:#14202b;color:#14202b' })}
      >
        ?
      </button>
      {open && (
        <span
          id={`help-${id}`}
          role="tooltip"
          style={s(
            `position:absolute;top:calc(100% + 8px);${align}:-6px;z-index:80;width:270px;max-width:calc(100vw - 40px);box-sizing:border-box;background:#fff;color:#3f3a34;border:1px solid #e2dbcf;border-radius:14px;padding:13px 15px 14px;box-shadow:0 16px 40px rgba(20,32,43,0.22);font-family:'Manrope',system-ui,sans-serif;font-size:13.5px;font-weight:400;line-height:1.55;letter-spacing:0;text-transform:none;text-align:left;white-space:normal;animation:fadeIn 160ms ease both`,
          )}
        >
          <strong style={s('display:block;font-size:13.5px;font-weight:700;color:#14202b;margin-bottom:4px')}>{t(`help.${id}.title`)}</strong>
          {t(`help.${id}.text`)}
        </span>
      )}
    </span>
  );
}

// -- page frame for the pages that are not the lead list (inbox, availability, team) -----------------------------------

export function PageFrame({ title, help, lead, children }: { title: string; help?: string; lead?: string; children: React.ReactNode }) {
  return (
    <div data-pad style={s("padding:22px 24px 64px;max-width:1440px;margin:0 auto;box-sizing:border-box;font-family:'Manrope',system-ui,sans-serif;color:#14202b")}>
      <div style={s('display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:6px')}>
        <h1 style={s("font-family:'Newsreader',Georgia,serif;font-size:34px;line-height:1.1;font-weight:400;letter-spacing:0;margin:0")}>{title}</h1>
        {help && <HelpTip id={help} align="left" />}
      </div>
      {lead && <p style={s('font-size:14px;color:#736d64;margin:0 0 18px')}>{lead}</p>}
      {!lead && <div style={s('height:12px')} />}
      {children}
    </div>
  );
}

/** Pill-shaped filter button (same look as the filter pills in the header). */
export function Pill({ on, onClick, children, ...rest }: { on: boolean; onClick: () => void; children: React.ReactNode } & Record<`data-${string}`, string>) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      {...rest}
      style={s(
        `cursor:pointer;border-radius:999px;border:1px solid ${on ? '#14202b' : '#e2dbcf'};background:${on ? '#14202b' : '#fff'};color:${on ? '#f8f5f0' : '#14202b'};padding:7px 14px;font-family:'Manrope',system-ui,sans-serif;font-size:12.5px;font-weight:600`,
      )}
    >
      {children}
    </button>
  );
}

// -- direction aware arrow glyph ----------------------------------------------------------------------------------------

/** "→" for forward, "←" for back; both mirror in right-to-left pages (--dir is -1 there). */
export function Arrow({ back = false }: { back?: boolean }) {
  return (
    <span aria-hidden style={s('display:inline-block;transform:scaleX(var(--dir, 1))')}>
      {back ? '←' : '→'}
    </span>
  );
}

// -- route badge -------------------------------------------------------------------------------------------------------

export function useRouteLabels() {
  const t = useTranslations('admin');
  return {
    short: (r: LeadRoute | null): string =>
      r === 'germany' ? t('route.shortGermany') : r === 'austria' ? t('route.shortAustria') : r === 'both' ? t('route.shortBoth') : r === 'unsure' ? t('route.shortUnsure') : '–',
    long: (r: LeadRoute | null): string =>
      r === 'germany' ? t('route.germany') : r === 'austria' ? t('route.austria') : r === 'both' ? t('route.both') : r === 'unsure' ? t('route.unsure') : t('route.unknown'),
  };
}

// -- toasts -----------------------------------------------------------------------------------------------------------------

export function Toasts() {
  const t = useTranslations('admin');
  const { toasts, dismissToast } = useAdmin();
  return (
    <div
      role="status"
      aria-live="polite"
      style={s('/* noflip */ position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:120;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none')}
      data-toasts
    >
      {toasts.map((x2) => (
        <div
          key={x2.id}
          style={s(
            `pointer-events:auto;display:flex;align-items:center;gap:12px;max-width:min(92vw,520px);padding:11px 14px 11px 18px;border-radius:999px;font-family:'Manrope',system-ui,sans-serif;font-size:13.5px;line-height:1.4;color:#f8f5f0;box-shadow:0 12px 32px rgba(20,32,43,0.28);animation:qIn 220ms cubic-bezier(0.2,0,0,1) both;background:${x2.kind === 'error' ? '#8a3b2c' : '#14202b'}`,
          )}
        >
          <span>{x2.text}</span>
          <button
            type="button"
            onClick={() => dismissToast(x2.id)}
            aria-label={t('toast.dismiss')}
            {...x("flex:none;width:22px;height:22px;border-radius:50%;border:0;background:rgba(255,255,255,0.14);color:#f8f5f0;cursor:pointer;display:grid;place-items:center;padding:0;font-size:12px;line-height:1", {
              hover: 'background:rgba(255,255,255,0.28)',
            })}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
