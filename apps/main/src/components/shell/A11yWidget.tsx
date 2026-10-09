'use client';

import { s, x } from '@dpl/ui';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import {
  applyA11yToRoot,
  DEFAULT_A11Y,
  loadA11y,
  reduceA11y,
  saveA11y,
  type A11yAction,
  type A11yState,
} from '@/lib/shell/a11y';
import { useDialog } from './useDialog';

// layout effects run before paint on the client; on the server this is a plain (inert) effect
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type ToolId = 'larger' | 'smaller' | 'contrast' | 'invert' | 'grayscale' | 'light' | 'links' | 'font' | 'motion';

interface Tool {
  id: ToolId;
  on: boolean;
  action: A11yAction;
}

/** The widget's texts (the `a11y` messages), resolved on the server and passed down. */
export interface A11yLabels {
  open: string;
  dialog: string;
  title: string;
  close: string;
  tools: Record<ToolId, string>;
  reset: string;
  statement: string;
}

const tools = (a: A11yState): Tool[] => [
  { id: 'larger', on: a.zoom > 0, action: { type: 'zoom', delta: 1 } },
  { id: 'smaller', on: a.zoom < 0, action: { type: 'zoom', delta: -1 } },
  { id: 'contrast', on: a.filter === 'contrast', action: { type: 'filter', value: 'contrast' } },
  { id: 'invert', on: a.filter === 'invert', action: { type: 'filter', value: 'invert' } },
  { id: 'grayscale', on: a.filter === 'grayscale', action: { type: 'filter', value: 'grayscale' } },
  { id: 'light', on: a.filter === 'light', action: { type: 'filter', value: 'light' } },
  { id: 'links', on: a.links, action: { type: 'toggle', key: 'links' } },
  { id: 'font', on: a.font, action: { type: 'toggle', key: 'font' } },
  { id: 'motion', on: a.motion, action: { type: 'toggle', key: 'motion' } },
];

const cell = (on: boolean) =>
  `text-align: left; padding: 11px 12px; font-family: 'Manrope', system-ui, sans-serif; font-size: 13.5px; line-height: 1.3; cursor: pointer; border: 1px solid ${on ? '#14202b' : '#ded7ca'}; background: ${on ? '#14202b' : 'transparent'}; color: ${on ? '#f8f5f0' : '#14202b'}`;

interface Props {
  labels: A11yLabels;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

/**
 * Accessibility tools: a round button at the bottom corner that opens a panel with zoom, colour filters, underlined
 * links, a readable font and "stop animation". The choices are applied as data-a11y-* attributes on <html>
 * (globals.css styles #dpl-page from them) and remembered in localStorage.
 */
export function A11yWidget({ labels: t, open, onToggle, onClose }: Props) {
  const panelId = useId();
  const [state, setState] = useState<A11yState>(DEFAULT_A11Y);
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const onKeyDown = useDialog(open, { containerRef: panelRef, returnFocusRef: launcherRef, onClose });

  // pick up what the visitor chose earlier. The inline script of the layout already applied it to <html> before first
  // paint; this restores the panel's state, and re-applies it in case a client-side language switch replaced <html>.
  useIsoLayoutEffect(() => {
    const stored = loadA11y();
    setState(stored);
    applyA11yToRoot(document.documentElement, stored);
  }, []);

  function change(action: A11yAction) {
    const next = reduceA11y(state, action);
    setState(next);
    applyA11yToRoot(document.documentElement, next);
    saveA11y(next);
  }

  return (
    <div data-float style={s('position: fixed; left: 22px; bottom: 22px; z-index: 52; display: flex; flex-direction: column; align-items: flex-start; gap: 12px')}>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-label={t.dialog}
          tabIndex={-1}
          className="dpl-dialog"
          onKeyDown={onKeyDown}
          style={s("width: 280px; max-width: calc(100vw - 44px); background: #fff; border: 1px solid #14202b; box-shadow: 0 22px 60px rgba(20,32,43,0.22); font-family: 'Manrope', system-ui, sans-serif; animation: fadeIn 160ms ease both")}
        >
          <div style={s('display: flex; align-items: center; gap: 10px; background: #14202b; color: #f8f5f0; padding: 14px 16px')}>
            <span style={s('font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; flex: 1')}>{t.title}</span>
            <button
              type="button"
              aria-label={t.close}
              onClick={() => {
                onClose();
                launcherRef.current?.focus();
              }}
              style={s('background: transparent; border: 0; color: #f8f5f0; cursor: pointer; font-size: 20px; line-height: 1; padding: 2px 4px')}
            >
              ×
            </button>
          </div>
          <div style={s('padding: 12px 14px 14px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px')}>
            {tools(state).map((tool) => (
              <button key={tool.id} type="button" aria-pressed={tool.on} onClick={() => change(tool.action)} style={s(cell(tool.on))}>
                {t.tools[tool.id]}
              </button>
            ))}
          </div>
          <div style={s('border-top: 1px solid #ece6dc; padding: 12px 14px 14px')}>
            <button
              type="button"
              onClick={() => change({ type: 'reset' })}
              style={s("width: 100%; background: transparent; border: 1px solid #d8cfc0; padding: 10px; font-family: 'Manrope', system-ui, sans-serif; font-size: 13.5px; color: #14202b; cursor: pointer; margin-bottom: 10px")}
            >
              {t.reset}
            </button>
            <Link
              href="/accessibility"
              onClick={onClose}
              data-linkbtn
              style={s("background: none; border: 0; padding: 0; font-family: 'Manrope', system-ui, sans-serif; font-size: 13px; color: #7a5c2c; cursor: pointer; text-decoration: underline; text-underline-offset: auto")}
            >
              {t.statement}
            </Link>
          </div>
        </div>
      )}
      <button
        ref={launcherRef}
        type="button"
        onClick={onToggle}
        aria-label={t.open}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={t.open}
        {...x(
          'width: 54px; height: 54px; border-radius: 50%; background: #14202b; color: #f8f5f0; border: 2px solid #f8f5f0; box-shadow: 0 10px 30px rgba(20,32,43,0.3); cursor: pointer; display: grid; place-items: center; flex: none',
          { hover: 'background: #22323f' },
        )}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="4" r="1.6" fill="currentColor" stroke="none" />
          <path d="M4 8.5h16M12 8.5V15M12 15l-3.4 6M12 15l3.4 6" />
        </svg>
      </button>
    </div>
  );
}
