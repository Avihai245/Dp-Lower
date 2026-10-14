import { s } from '@dpl/ui';
import type { ReactNode } from 'react';

/** Section label with the short rule in front: 12px, tracked, uppercase (Hebrew drops tracking and caps via fonts.css). */
const KICKER_COLOR = {
  /** bronze on the paper background */
  bronze: '#a07a3c',
  /** light bronze on navy */
  gold: '#d3ae6b',
  /** muted paper on navy */
  muted: 'rgba(248,245,240,0.65)',
} as const;

export function Kicker({
  tone = 'bronze',
  children,
}: {
  tone?: keyof typeof KICKER_COLOR;
  children: ReactNode;
}) {
  return (
    <div
      style={s(
        `font-family: 'Manrope', system-ui, sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: ${KICKER_COLOR[tone]}; display: flex; align-items: center; gap: 12px; margin-bottom: 26px`,
      )}
    >
      <span style={s('width: 26px; height: 1px; background: currentColor; opacity: 0.6')} />
      {children}
    </div>
  );
}

/** Five-star line. The glyphs are decoration; the label carries the meaning. */
export function Stars({ label, css }: { label: string; css: string }) {
  return (
    <span role="img" aria-label={label} style={s(css)}>
      ★★★★★
    </span>
  );
}
