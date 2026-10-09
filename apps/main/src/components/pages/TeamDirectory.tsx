'use client';

import { s, x } from '@dpl/ui';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { ALL, filterByDepartment } from './team';
import { SANS, SERIF } from './tokens';

export interface DirectoryPerson {
  slug: string;
  name: string;
  role: string;
  /** English department name (see `departmentOf` in @dpl/i18n): what the filter compares */
  dept: string;
  photo?: string;
  initials: string;
}

export interface DirectoryPill {
  /** `ALL` or an English department name */
  id: string;
  label: string;
  count: number;
  /** announced to screen readers when this pill is chosen, e.g. "Showing 3 people" */
  status: string;
}

const pillCss = (on: boolean) =>
  `border: 1px solid ${on ? '#14202b' : '#d8cfc0'}; background: ${on ? '#14202b' : 'transparent'}; color: ${on ? '#f8f5f0' : '#14202b'}; border-radius: 999px; padding: 9px 16px; font-size: 13.5px; font-family: ${SANS}; cursor: pointer`;

/**
 * The team page's department filter and the grid it filters. All 37 people are in the server-rendered HTML (the filter
 * starts on "All"); only the pills' state is client side. The labels, counts and status texts arrive translated.
 */
export function TeamDirectory({
  pills,
  people,
  groupLabel,
}: {
  pills: DirectoryPill[];
  people: DirectoryPerson[];
  groupLabel: string;
}) {
  const [active, setActive] = useState(ALL);
  const shown = useMemo(() => filterByDepartment(people, active), [people, active]);
  const current = pills.find((p) => p.id === active) ?? pills[0];

  return (
    <>
      <div
        role="group"
        aria-label={groupLabel}
        style={s('display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 36px')}
      >
        {pills.map((pill) => {
          const on = pill.id === active;
          return (
            <button
              key={pill.id}
              type="button"
              aria-pressed={on}
              onClick={() => setActive(pill.id)}
              style={s(pillCss(on))}
            >
              {pill.label}
            </button>
          );
        })}
      </div>
      <p role="status" className="dpl-sr-only">
        {current?.status}
      </p>
      <ul
        data-resp="4"
        style={s(
          'display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: clamp(18px, 2vw, 28px); list-style: none; margin: 0; padding: 0',
        )}
      >
        {shown.map((p, i) => (
          <li key={p.slug} style={s('display: flex')}>
            <Link
              href={`/team/${p.slug}`}
              {...x(
                `flex: 1; min-width: 0; line-height: normal; text-align: left; background: #fff; border: 1px solid #ece6dc; padding: 20px 20px 22px; cursor: pointer; font-family: ${SANS}; display: flex; flex-direction: column; text-decoration: none; transition: border-color 180ms ease`,
                { hover: 'border-color: #14202b' },
              )}
            >
              {p.photo ? (
                <span
                  style={s(
                    'display: block; position: relative; width: 100%; aspect-ratio: 1 / 1; overflow: hidden; background-color: #efe9df',
                  )}
                >
                  <Image
                    src={p.photo}
                    alt=""
                    fill
                    priority={i < 4}
                    sizes="(max-width: 720px) 90vw, (max-width: 1080px) 42vw, 22vw"
                    style={{ objectFit: 'cover', objectPosition: 'center 20%' }}
                  />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  style={s(
                    `display: grid; place-items: center; width: 100%; aspect-ratio: 1 / 1; background: #14202b; color: #c9a45c; font-family: ${SERIF}; font-size: 40px`,
                  )}
                >
                  {p.initials}
                </span>
              )}
              <span
                style={s(
                  `font-family: ${SERIF}; font-size: 22px; line-height: 1.15; color: #14202b; margin-top: 16px`,
                )}
              >
                {p.name}
              </span>
              <span style={s('font-size: 13.5px; line-height: 1.45; color: #736d64; margin-top: 6px')}>
                {p.role}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
