'use client';

import { s, x } from '@dpl/ui';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';

export interface ArticleRow {
  slug: string;
  date: string;
  title: string;
  excerpt: string;
  cat: string;
}

const SANS = "font-family: 'Manrope', system-ui, sans-serif";

/** The prototype's filter pill, dark when selected. */
const pill = (on: boolean) =>
  `border: 1px solid ${on ? '#14202b' : '#d8cfc0'}; background: ${on ? '#14202b' : 'transparent'}; color: ${on ? '#f8f5f0' : '#14202b'}; border-radius: 999px; padding: 9px 16px; font-size: 13.5px; ${SANS}; cursor: pointer`;

const ROW = `width: 100%; text-align: left; background: transparent; border: 0; border-top: 1px solid #ece6dc; padding: 26px 0; display: grid; grid-template-columns: 130px minmax(0, 1fr) auto; gap: 24px; align-items: baseline; cursor: pointer; ${SANS}; line-height: normal; transition: background 160ms ease; text-decoration: none`;

/**
 * Category pills and the article rows. Every article is in the server-rendered HTML (crawlers see them all); the pills
 * only filter what is shown. The pills come from the articles' own categories, in order of first appearance.
 */
export function InsightsList({
  articles,
  allLabel,
  filterLabel,
}: {
  articles: ArticleRow[];
  allLabel: string;
  filterLabel: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const categories = Array.from(new Set(articles.map((a) => a.cat)));
  const shown = selected === null ? articles : articles.filter((a) => a.cat === selected);

  return (
    <>
      <div
        role="group"
        aria-label={filterLabel}
        style={s('display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 36px')}
      >
        {[null, ...categories].map((cat) => (
          <button
            key={cat ?? 'all'}
            type="button"
            aria-pressed={selected === cat}
            onClick={() => setSelected(cat)}
            style={s(pill(selected === cat))}
          >
            {cat ?? allLabel}
          </button>
        ))}
      </div>
      <ul role="list" style={s('list-style: none; margin: 0; padding: 0')}>
        {shown.map((a) => (
          <li key={a.slug}>
            <Link href={`/insights/${a.slug}`} data-art-row {...x(ROW, { hover: 'background: #efe9df' })}>
              <span style={s('font-size: 13px; letter-spacing: 0.06em; color: #736d64')}>{a.date}</span>
              <span>
                <span
                  style={s(
                    "display: block; font-family: 'Newsreader', Georgia, serif; font-size: clamp(21px, 1.8vw, 27px); line-height: 1.25; color: #14202b",
                  )}
                >
                  {a.title}
                </span>
                <span
                  style={s(
                    'display: block; font-size: 16px; line-height: 1.7; color: #736d64; margin-top: 8px; max-width: 74ch',
                  )}
                >
                  {a.excerpt}
                </span>
              </span>
              <span
                style={s(
                  'font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #a07a3c; white-space: nowrap',
                )}
              >
                {a.cat}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
