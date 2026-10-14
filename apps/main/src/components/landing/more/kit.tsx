import { s, x } from '@dpl/ui';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import '../../../styles/landing-more.css';
import { Isolated } from './ltr';

/** Horizontal page padding used by every section of the landing page. */
export const PAD = 'clamp(20px, 4.6vw, 160px)';

type Tone = 'gold' | 'soft' | 'bright';

const EYEBROW: Record<Tone, { text: string; rule: string }> = {
  // on the paper-coloured sections
  gold: {
    text: "font-family:'Manrope',system-ui,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#a07a3c;display:flex;align-items:center;gap:12px;margin-bottom:26px",
    rule: 'width:26px;height:1px;background:currentColor;opacity:0.6',
  },
  // on the navy sections
  soft: {
    text: "font-family:'Manrope',system-ui,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:rgba(248,245,240,0.65);display:flex;align-items:center;gap:12px;margin-bottom:26px",
    rule: 'width:26px;height:1px;background:currentColor;opacity:0.6',
  },
  // the closing call to action
  bright: {
    text: "font-family:'Manrope',system-ui,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#d3ae6b;display:flex;align-items:center;gap:14px;margin-bottom:30px",
    rule: 'width:30px;height:1px;background:currentColor;opacity:0.7',
  },
};

/** The small caps label with a hairline in front of every section heading. */
export function Eyebrow({ tone = 'gold', children }: { tone?: Tone; children: ReactNode }) {
  const e = EYEBROW[tone];
  return (
    <div style={s(e.text)}>
      <span aria-hidden="true" style={s(e.rule)} />
      {children}
    </div>
  );
}

/** "Check your eligibility": a real link (crawlable, middle-clickable) that looks like the prototype's button. */
export function EligibilityLink({ css, hover, children }: { css: string; hover?: string; children: ReactNode }) {
  return (
    <Link href="/eligibility" {...x(css, { hover, className: 'btn lm-btn' })}>
      {children}
    </Link>
  );
}

/** ★★★★★ 4.9 · 380+ Google reviews. Placeholder claim kept as designed. */
export function Rating({ tone, value, reviews }: { tone: 'light' | 'dark'; value: string; reviews: string }) {
  const light = tone === 'light';
  const wrap = light
    ? "align-self:center;display:inline-flex;align-items:center;gap:12px;font-family:'Manrope',system-ui,sans-serif;font-size:14.5px;color:#736d64"
    : "display:inline-flex;align-items:center;gap:12px;font-family:'Manrope',system-ui,sans-serif;font-size:14.5px;color:rgba(248,245,240,0.82)";
  return (
    <div style={s(wrap)}>
      <span aria-hidden="true" style={s(`color:${light ? '#c99a3f' : '#d3ae6b'};font-size:15px;letter-spacing:2px`)}>
        ★★★★★
      </span>
      <span style={s(`font-weight:700;color:${light ? '#23292f' : '#f8f5f0'}`)}>{value}</span>
      <span aria-hidden="true" style={s('opacity:0.45')}>
        ·
      </span>
      <span>
        <Isolated text={reviews} />
      </span>
    </div>
  );
}
