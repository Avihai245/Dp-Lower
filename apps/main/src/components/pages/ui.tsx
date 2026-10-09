import { s, x } from '@dpl/ui';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import '@/styles/pages.css';
import { SANS, SERIF } from './tokens';

/*
 * Building blocks shared by the about, team, attorney, testimonials, media and contact pages. Every style string is
 * copied from the prototype's template; the responsive hooks (data-pad, data-hero-pad, data-h1, data-big, data-resp,
 * data-kv, data-linkbtn) are the ones styled in globals.css and stay on the same elements as in the prototype.
 */

/** Every page fades in (the prototype's `animation: fadeIn 280ms ease both` wrapper). */
export function PageFade({ children }: { children: ReactNode }) {
  return <div style={s('animation: fadeIn 280ms ease both')}>{children}</div>;
}

/** Page section: `margin: 0 auto; padding: <top>px clamp(20px, 4.6vw, 120px) 0`. `hero` marks the first section of a page. */
export function Pad({
  top,
  hero,
  children,
  style,
}: {
  top: number;
  hero?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      data-pad=""
      data-hero-pad={hero ? '' : undefined}
      style={{ ...s(`margin: 0 auto; padding: ${top}px clamp(20px, 4.6vw, 120px) 0`), ...style }}
    >
      {children}
    </div>
  );
}

const EYEBROW =
  'font-size: 12px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #a07a3c; margin-bottom: 22px';
const EYEBROW_STRONG =
  'font-size: 12px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #a07a3c; margin-bottom: 20px';

/**
 * The small bronze caps label above a heading. `strong` is the heavier variant used inside blocks. As an h2 it is the
 * section's heading (sections without a big heading), reset so it looks exactly like the prototype's div.
 */
export function Eyebrow({
  children,
  strong,
  as = 'div',
  mb,
  color,
  id,
}: {
  children: ReactNode;
  strong?: boolean;
  as?: 'div' | 'h2';
  mb?: number;
  color?: string;
  id?: string;
}) {
  const css = [
    strong ? EYEBROW_STRONG : EYEBROW,
    mb !== undefined && `margin-bottom: ${mb}px`,
    color && `color: ${color}`,
    as === 'h2' && `font-family: ${SANS}; line-height: 1.55`,
  ]
    .filter(Boolean)
    .join('; ');
  const Tag = as;
  return (
    <Tag id={id} style={s(css)}>
      {children}
    </Tag>
  );
}

const H1_CSS = `font-family: ${SERIF}; font-weight: 400; font-size: clamp(36px, 4.4vw, 62px); line-height: 1.05; letter-spacing: -0.022em; color: #14202b; margin: 0; max-width: 20ch`;
const H2_CSS = `font-family: ${SERIF}; font-weight: 400; font-size: clamp(28px, 3.2vw, 44px); line-height: 1.1; letter-spacing: -0.018em; color: #14202b; margin: 0; max-width: 18ch`;

/** The page title. `css` is appended to the prototype's declarations (later ones win). */
export function H1({ children, css, id }: { children: ReactNode; css?: string; id?: string }) {
  return (
    <h1 id={id} data-h1="" style={s(css ? `${H1_CSS}; ${css}` : H1_CSS)}>
      {children}
    </h1>
  );
}

/** A section title (`data-big` shrinks it on phones). */
export function H2Big({ children, css, id }: { children: ReactNode; css?: string; id?: string }) {
  return (
    <h2 id={id} data-big="" style={s(css ? `${H2_CSS}; ${css}` : H2_CSS)}>
      {children}
    </h2>
  );
}

/**
 * A link that looks like the prototype's text button ("Meet the whole team", "← All team members"): bronze, semibold, with
 * a thin underline that darkens on hover. It is a real link (the prototype navigated from a button).
 */
export function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      data-linkbtn=""
      {...x(
        `display: inline-block; line-height: normal; background: none; border: 0; padding: 0; font-family: ${SANS}; font-size: 15.5px; font-weight: 600; color: #7a5c2c; cursor: pointer; border-bottom: 1px solid #ded7ca; text-decoration: none`,
        { hover: 'border-bottom-color: #7a5c2c' },
      )}
    >
      {children}
    </Link>
  );
}

/** A "←" that points the way back in both directions of writing. */
export function BackArrow() {
  return (
    <span aria-hidden="true" style={s('display: inline-block; transform: scaleX(var(--dir, 1))')}>
      ←
    </span>
  );
}
