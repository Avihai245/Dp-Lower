'use client';
import { s, x } from '@dpl/ui';
import { useState } from 'react';
import { splitColumns, type FaqItem } from './faq-jsonld';

/**
 * The accordion. Every answer is in the server-rendered HTML (closed panels are `hidden`, not absent) so crawlers and
 * readers without JavaScript get all ten; one panel is open at a time, as in the prototype.
 */
export function FaqList({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [left, right] = splitColumns(items);

  const column = (list: FaqItem[], offset: number) => (
    <div>
      {list.map((item, k) => {
        const i = offset + k;
        const isOpen = open === i;
        return (
          <div key={i} style={s('border-bottom:1px solid #ece6dc')}>
            <h3 style={s('margin:0;font-weight:400;letter-spacing:normal')}>
              <button
                type="button"
                id={`faq-q-${i}`}
                aria-expanded={isOpen}
                aria-controls={`faq-a-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                {...x(
                  "width:100%;display:flex;align-items:flex-start;gap:20px;text-align:left;background:transparent;border:0;cursor:pointer;padding:22px 2px;font-family:'Newsreader',Georgia,serif;font-size:clamp(19px,1.35vw,23px);line-height:1.3;color:#14202b;transition:color 200ms ease",
                  { hover: 'color:#a07a3c' },
                )}
              >
                <span style={s('flex:1')}>{item.q}</span>
                <span
                  aria-hidden="true"
                  data-lm-sign
                  style={s(
                    `font-family:'Manrope',system-ui,sans-serif;font-weight:400;font-size:24px;color:#a07a3c;flex:none;transition:transform 260ms ease;transform:rotate(${isOpen ? '45deg' : '0deg'})`,
                  )}
                >
                  +
                </span>
              </button>
            </h3>
            <div
              id={`faq-a-${i}`}
              data-faq-panel
              hidden={!isOpen}
              style={isOpen ? s('display:block;animation:qIn 260ms cubic-bezier(0.2,0,0,1) both') : undefined}
            >
              <p style={s('font-size:16.5px;line-height:1.75;color:#736d64;margin:0 0 24px;max-width:58ch')}>{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      data-resp="2"
      style={s(`display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 clamp(40px,5vw,96px);align-items:start;border-top:1px solid #ece6dc`)}
    >
      {column(left, 0)}
      {column(right, left.length)}
    </div>
  );
}
