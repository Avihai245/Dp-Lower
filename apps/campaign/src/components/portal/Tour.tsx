'use client';
import { s, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  scrollTargetFor,
  snapStep,
  TOUR_DEFAULT_CARD_H,
  TOUR_HOLE_PAD,
  tourKeyAction,
  type Rect,
  type TourSnap,
  type Viewport,
} from './model/tour-geometry';
import { useDir, useFocusTrap } from './shared';

/** The guided tour: a welcome card and five spotlights on [data-tour] targets of the dashboard. */
export const TOUR_STEPS = [
  { id: 'welcome', target: null },
  { id: 'timeline', target: 'timeline' },
  { id: 'checklist', target: 'checklist' },
  { id: 'action', target: 'action' },
  { id: 'docs', target: 'docs' },
  { id: 'account', target: 'account' },
] as const;

const LAST = TOUR_STEPS.length - 1;

function targetRect(i: number): Rect | null {
  const target = TOUR_STEPS[i]?.target;
  const el = target ? document.querySelector(`[data-tour="${target}"]`) : null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top + window.scrollY, w: r.width, h: r.height };
}

const viewport = (): Viewport => ({ vw: window.innerWidth, vh: window.innerHeight, docHeight: document.documentElement.scrollHeight });

const CARD_STYLE =
  "box-sizing: border-box; background: #fff; border-radius: 20px; padding: 24px 24px 20px; box-shadow: 0 24px 60px rgba(20,32,43,0.28); font-family: 'Manrope', system-ui, sans-serif; animation: fadeIn 220ms ease both";

/**
 * Behaves like the prototype: each step scrolls its target into the best position and the spotlight follows the live
 * layout (re-measured on scroll, on resize and 300ms after every step, once fonts and images have settled). Arrow keys
 * move through the steps (mirrored in Hebrew), Escape and a click outside the card close the tour, and on a phone the
 * card is a bottom sheet. Geometry lives in model/tour-geometry.ts.
 */
export function Tour({ onClose }: { onClose: () => void }) {
  const t = useTranslations('portal.tour');
  const dir = useDir();
  const [index, setIndex] = useState(0);
  const [snap, setSnap] = useState<TourSnap | null>(null);
  const indexRef = useRef(0);
  const keyRef = useRef('');
  const cardRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cardHeight = () => cardRef.current?.offsetHeight || TOUR_DEFAULT_CARD_H;

  const measure = useCallback(() => {
    const i = indexRef.current;
    const next = snapStep({ i, rect: targetRect(i), vp: viewport(), scrollY: window.scrollY, cardH: cardHeight() });
    const key = JSON.stringify(next);
    if (key !== keyRef.current) {
      keyRef.current = key;
      setSnap(next);
    }
  }, []);

  const goStep = useCallback(
    (i: number) => {
      indexRef.current = i;
      const target = scrollTargetFor(targetRect(i), viewport(), cardHeight());
      window.scrollTo({ top: target, behavior: 'instant' });
      const next = snapStep({ i, rect: targetRect(i), vp: viewport(), scrollY: target, cardH: cardHeight() });
      keyRef.current = JSON.stringify(next);
      setSnap(next);
      setIndex(i);
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(measure, 300);
    },
    [measure],
  );

  const close = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    onClose();
  }, [onClose]);

  useEffect(() => {
    const open = setTimeout(() => goStep(0), 30);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    // the layout can also change without a scroll or a resize (web fonts arrive, an image loads, a line wraps differently)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    observer?.observe(document.documentElement);
    return () => {
      clearTimeout(open);
      if (settleTimer.current) clearTimeout(settleTimer.current);
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [goStep, measure]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = tourKeyAction(e.key, indexRef.current, LAST, dir);
      if (action === 'close') close();
      else if (action === 'next') goStep(indexRef.current + 1);
      else if (action === 'back') goStep(indexRef.current - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dir, close, goStep]);

  useFocusTrap(cardRef, true, cardRef);
  // the card is hidden until its first position is known: take focus into it as soon as it can. The card itself is
  // focused rather than a button, so no focus ring is drawn over the design; Tab then reaches the buttons in order.
  const positioned = snap !== null;
  useEffect(() => {
    if (positioned && !cardRef.current?.contains(document.activeElement)) cardRef.current?.focus({ preventScroll: true });
  }, [positioned]);

  const step = TOUR_STEPS[index]!;
  const last = index === LAST;
  const rect = snap && snap.i === index ? snap.rect : null;
  const pad = TOUR_HOLE_PAD;

  const root: CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: Math.max(snap ? snap.dh : 0, snap ? snap.vh : 800),
    zIndex: 90,
  };
  const veil: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: rect ? 'transparent' : 'rgba(20,32,43,0.55)',
    transition: 'background 240ms ease',
  };
  const hole: CSSProperties = rect
    ? {
        position: 'absolute',
        pointerEvents: 'none',
        left: rect.x - pad,
        top: rect.y - pad,
        width: rect.w + pad * 2,
        height: rect.h + pad * 2,
        borderRadius: 16,
        boxShadow: '0 0 0 2px #c9a45c, 0 0 0 9999px rgba(20,32,43,0.55)',
      }
    : { display: 'none' };

  let position: CSSProperties;
  if (!snap) position = { position: 'fixed', left: '50%', top: '50%', width: 1, visibility: 'hidden' };
  else if (snap.cardPos.kind === 'sheet') position = { position: 'fixed', left: 12, right: 12, bottom: 12, maxHeight: 'calc(100vh - 24px)', overflowY: 'auto' };
  else position = { position: 'absolute', top: snap.cardPos.top, left: snap.cardPos.left, width: snap.cardPos.width };

  const dots = TOUR_STEPS.map((_, k) => (
    <i
      key={k}
      style={s(
        `display: block; width: ${k === index ? 18 : 6}px; height: 6px; border-radius: 999px; background: ${k <= index ? '#a07a3c' : '#e2dbcf'}; transition: width 240ms ease`,
      )}
    />
  ));

  return createPortal(
    // the dialog keeps one steady name; the step text is read once, from the focused card (a live region announces changes)
    <div role="dialog" aria-modal="true" aria-label={t('label')} style={root}>
      <div aria-hidden="true" onClick={close} style={veil} />
      <div aria-hidden="true" style={hole} />
      <div ref={cardRef} data-tour-card tabIndex={-1} style={{ ...position, ...s(CARD_STYLE), outline: 'none' }}>
        <div aria-live="polite">
          <div style={s('display: flex; align-items: center; gap: 10px; margin-bottom: 14px')}>
            <span style={s('font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #a07a3c')}>
              {index === 0 ? t('quick') : t('step', { n: index, total: LAST })}
            </span>
            <span aria-hidden="true" style={s('margin-left: auto; display: flex; gap: 5px')}>
              {dots}
            </span>
          </div>
          <div
            style={s("font-family: 'Newsreader', Georgia, serif; font-size: 25px; line-height: 1.2; color: #14202b; margin-bottom: 10px; text-wrap: balance")}
          >
            {t(`steps.${step.id}.title`)}
          </div>
          <p style={s('font-size: 15.5px; line-height: 1.6; color: #4f4a43; margin: 0 0 22px; text-wrap: pretty')}>
            {t(`steps.${step.id}.body`)}
          </p>
        </div>
        <div style={s('display: flex; align-items: center; gap: 10px')}>
          <button
            type="button"
            onClick={close}
            style={s(
              `background: none; border: 0; padding: 8px 0; font-family: 'Manrope', system-ui, sans-serif; font-size: 13.5px; color: #736d64; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: #d8cfc0; margin-right: ${index > 0 ? '0' : 'auto'}; visibility: ${last ? 'hidden' : 'visible'}`,
            )}
            tabIndex={last ? -1 : 0}
          >
            {t('skip')}
          </button>
          <button
            type="button"
            onClick={() => index > 0 && goStep(index - 1)}
            {...x(
              `background: #fff; color: #14202b; border: 1px solid #e2dbcf; border-radius: 999px; padding: 13px 18px; font-family: 'Manrope', system-ui, sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; margin-left: auto; display: ${index > 0 ? 'block' : 'none'}`,
              { hover: 'border-color: #14202b' },
            )}
          >
            {t('back')}
          </button>
          <button
            type="button"
            onClick={() => (last ? close() : goStep(index + 1))}
            {...x(
              "background: #14202b; color: #f8f5f0; border: 1px solid #14202b; border-radius: 999px; padding: 13px 24px; font-family: 'Manrope', system-ui, sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 0.04em; cursor: pointer",
              { hover: 'background: #1e2f3f' },
            )}
          >
            {index === 0 ? t('start') : last ? t('finish') : t('next')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
