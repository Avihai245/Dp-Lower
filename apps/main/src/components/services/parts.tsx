import { s } from '@dpl/ui';
import type { ReactNode } from 'react';

/**
 * Building blocks shared by the service, article and legal pages. Styles are the prototype's inline declarations;
 * headings are real <h2>/<h3> elements with every base heading style neutralised so they look exactly like the
 * prototype's <div> labels.
 */

export const FADE_IN = 'animation: fadeIn 280ms ease both';
export const SERIF = "font-family: 'Newsreader', Georgia, serif";
export const SANS = "font-family: 'Manrope', system-ui, sans-serif";
export const KICKER =
  'font-size: 12px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #a07a3c';

/** A page section: ink rule on top, then a serif h2. */
export function Block({
  title,
  marginTop = 44,
  titleGap = 20,
  children,
}: {
  title: string;
  marginTop?: number;
  titleGap?: number;
  children: ReactNode;
}) {
  return (
    <section style={s(`border-top: 1px solid #14202b; margin-top: ${marginTop}px; padding-top: 30px`)}>
      <h2
        style={s(
          `${SERIF}; font-weight: 400; font-size: 30px; line-height: 1.15; color: #14202b; margin: 0 0 ${titleGap}px`,
        )}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Rows with a bronze em dash (who it is for, eligibility). */
export function DashRows({ items }: { items: string[] }) {
  return (
    <ul role="list" style={s('list-style: none; margin: 0; padding: 0')}>
      {items.map((text, i) => (
        <li
          key={i}
          style={s(
            'display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 14px; padding: 12px 0; border-top: 1px solid #ece6dc; font-size: 16.5px; line-height: 1.6; color: #3f4b56',
          )}
        >
          <span aria-hidden="true" style={s('color: #a07a3c')}>
            —
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

/** The small bronze caps label that titles a sidebar card or a callout. */
export function CardLabel({
  children,
  color = '#a07a3c',
  marginBottom = 16,
}: {
  children: ReactNode;
  color?: string;
  marginBottom?: number;
}) {
  return (
    <h2
      style={s(
        `${SANS}; font-size: 12px; font-weight: 700; line-height: 1.55; letter-spacing: 0.2em; text-transform: uppercase; color: ${color}; margin: 0 0 ${marginBottom}px`,
      )}
    >
      {children}
    </h2>
  );
}

/** White sidebar card with a label. */
export function SideCard({
  label,
  marginTop = 0,
  children,
}: {
  label: string;
  marginTop?: number;
  children: ReactNode;
}) {
  return (
    <section
      style={s(
        `border: 1px solid #ece6dc; background: #fff; padding: 26px 26px 24px; margin-top: ${marginTop}px`,
      )}
    >
      <CardLabel>{label}</CardLabel>
      {children}
    </section>
  );
}

/** A sidebar row that links to an article: serif title, hairline above (hover colour #a07a3c). */
export const SERIF_ROW = `display: block; width: 100%; text-align: left; background: transparent; border: 0; border-top: 1px solid #ece6dc; padding: 12px 0; cursor: pointer; ${SERIF}; font-size: 18px; line-height: 1.3; color: #14202b; text-decoration: none`;

/** A sidebar row with a bold sans name (team member, related practice area). */
export const SANS_ROW = `display: block; width: 100%; text-align: left; background: transparent; border: 0; border-top: 1px solid #ece6dc; padding: 12px 0; cursor: pointer; ${SANS}; line-height: normal; text-decoration: none`;

/** List wrapper for rows rendered as links inside a card (no bullets, no margins). */
export function PlainList({ children }: { children: ReactNode }) {
  return (
    <ul role="list" style={s('list-style: none; margin: 0; padding: 0')}>
      {children}
    </ul>
  );
}
