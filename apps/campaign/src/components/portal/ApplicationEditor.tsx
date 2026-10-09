'use client';
import { APPLICATION_INPUT_SECTIONS, APPLICATION_SECTIONS, sectionDone } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from '@/i18n/navigation';
import { applicationPercent, momentum } from './model/progress';
import type { PortalState } from './model/types';
import { Arrow, PortalLogo, SANS, mix } from './shared';
import { useApplicationAutosave } from './useApplicationAutosave';

/** Fields that span both columns of the grid (the prototype's `grid-column: span 2`). */
const WIDE = new Set(['nameChanges', 'address']);

/** Input behaviour per field: the right keyboard and autofill on a phone, and left-to-right entry for addresses and numbers. */
const INPUT_PROPS: Record<string, { type?: string; inputMode?: 'email' | 'tel'; autoComplete: string; dir?: 'ltr' }> = {
  fullName: { autoComplete: 'name' },
  dob: { autoComplete: 'bday' },
  email: { type: 'email', inputMode: 'email', autoComplete: 'email', dir: 'ltr' },
  phone: { type: 'tel', inputMode: 'tel', autoComplete: 'tel', dir: 'ltr' },
  address: { autoComplete: 'street-address' },
};

const railButtonCss = (current: boolean, done: boolean): string =>
  `display: flex; align-items: flex-start; gap: 14px; text-align: left; cursor: pointer; padding: 14px 14px 14px 12px; font-family: var(--font-body); border: 0; border-radius: 12px; border-left: 2px solid ${
    current ? 'var(--color-accent)' : 'transparent'
  }; background: ${current ? 'var(--color-accent-100)' : 'transparent'}; opacity: ${current || done ? '1' : '0.62'}; transition: background 140ms ease`;

const railDotCss = (current: boolean, done: boolean): string =>
  `width: 22px; height: 22px; flex: none; display: grid; place-items: center; ${SANS}; font-size: 11px; border: 1px solid ${
    done || current ? 'var(--color-accent)' : mix(30)
  }; background: ${done ? 'var(--color-accent)' : 'transparent'}; color: ${done ? 'var(--color-bg)' : 'inherit'}`;

/** The application: five sections (four of questions and the review), saved as the applicant types. */
export function ApplicationEditor({ initial }: { initial: PortalState }) {
  const t = useTranslations('portal');
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const [leaveFailed, setLeaveFailed] = useState(false);

  const { values, setField, section, setSection, status, flush } = useApplicationAutosave({
    initialValues: initial.application?.data ?? {},
    initialSection: initial.application?.currentSection ?? 0,
    // submitted in another tab: the dashboard shows the case now
    onLocked: () => router.replace('/portal'),
  });

  const doneFlags = APPLICATION_SECTIONS.map((_, i) => sectionDone(values, i));
  const sectionsDone = doneFlags.filter(Boolean).length;
  const percent = applicationPercent(sectionsDone);
  const sec = APPLICATION_SECTIONS[section]!;
  const isReview = sec.id === 'review';
  const last = section === APPLICATION_SECTIONS.length - 1;

  // after moving to another section, keyboard and screen-reader users land on its title
  useEffect(() => {
    if (!moved.current) {
      moved.current = true;
      return;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    headingRef.current?.focus({ preventScroll: true });
  }, [section]);

  /** Saves what is pending, then leaves; when it cannot be saved the person stays and is told. */
  const leave = (href: '/portal' | '/portal/documents') => async () => {
    const ok = await flush();
    setLeaveFailed(!ok);
    if (ok) router.push(href);
  };

  const mom = momentum(sectionsDone);
  const momentumText =
    mom.kind === 'start' || mom.kind === 'almost'
      ? t(`application.momentum.${mom.kind}`)
      : t(`application.momentum.${mom.kind}`, { left: mom.left });

  const sectionTitle = (id: string) => t(`application.sections.${id}.title`);
  const hint = (id: string, field: string) => (t.has(`application.sections.${id}.fields.${field}.hint`) ? t(`application.sections.${id}.fields.${field}.hint`) : '');

  const showError = status === 'error' || leaveFailed;

  return (
    <div style={s('min-height: 100vh; display: flex; flex-direction: column')}>
      <div style={s('max-width: 100%; width: 100%; margin: 0 auto; padding: 20px clamp(20px, 4.6vw, 160px); display: flex; align-items: center; gap: 24px')}>
        <PortalLogo />
        <button type="button" className="btn btn-ghost" onClick={leave('/portal')} style={s('font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 10px')}>
          <Arrow /> {t('application.back')}
        </button>
        <div data-hide-xs style={s('margin-left: auto; display: flex; align-items: center; gap: 16px')}>
          <span style={s(`${SANS}; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: ${mix(55)}; white-space: nowrap`)}>
            {t('application.headerProgress', { percent })}
          </span>
          <span style={s('width: 120px; height: 2px; background: var(--color-neutral-200); display: block')}>
            <span style={s(`display: block; height: 2px; background: var(--color-accent); width: ${percent}%; transition: width 420ms cubic-bezier(0.4,0,0.2,1)`)} />
          </span>
        </div>
      </div>
      <div style={s('height: 1px; background: var(--color-divider)')} />

      <div
        data-resp="2"
        data-pad
        style={s('flex: 1; max-width: 100%; width: 100%; margin: 0 auto; padding: 0 clamp(20px, 4.6vw, 160px); display: grid; grid-template-columns: 268px minmax(0, 1fr); gap: 0')}
      >
        <nav aria-label={t('application.railTitle')} data-rail style={s('border-right: 1px solid var(--color-divider); padding: 44px 40px 44px 0')}>
          <div
            data-rail-label
            style={s(`${SANS}; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: ${mix(50)}; margin-bottom: 24px`)}
          >
            {t('application.railTitle')}
          </div>
          <div data-rail-list style={s('display: flex; flex-direction: column; gap: 2px')}>
            {APPLICATION_SECTIONS.map((sc, i) => {
              const current = i === section;
              const done = doneFlags[i]!;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setSection(i)}
                  aria-current={current ? 'step' : undefined}
                  {...x(railButtonCss(current, done), { hover: 'background: var(--color-accent-100)' })}
                >
                  <span aria-hidden="true" style={s(railDotCss(current, done))}>
                    {done ? '✓' : String(i + 1)}
                  </span>
                  <span style={s('display: flex; flex-direction: column; gap: 2px; text-align: left')}>
                    <span style={s(`${SANS}; font-size: 16px; line-height: 1.2; white-space: nowrap`)}>{sectionTitle(sc.id)}</span>
                    <span style={s(`font-size: 11.5px; letter-spacing: 0.04em; color: ${mix(52)}`)}>
                      {done
                        ? t('application.rail.complete')
                        : current
                          ? t('application.rail.inProgress')
                          : sc.id === 'review'
                            ? t('application.rail.final')
                            : t('application.rail.questions', { count: sc.fields.length })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <div key={section} data-pane style={s('padding: 44px 0 60px 44px; animation: qIn 300ms cubic-bezier(0.2,0,0,1) both')}>
          <div style={s(`${SANS}; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-accent-700); margin-bottom: 16px`)}>
            {t('application.kicker', { n: section + 1 })}
          </div>
          <h1 ref={headingRef} tabIndex={-1} data-h1 style={{ ...s('font-size: 42px; letter-spacing: -0.022em; margin: 0 0 12px'), outline: 'none' }}>
            {sectionTitle(sec.id)}
          </h1>
          <p style={s(`font-size: 16px; color: ${mix(66)}; margin: 0 0 12px; max-width: 56ch`)}>{t(`application.sections.${sec.id}.intro`)}</p>
          <p style={s('font-size: 14.5px; color: #a07a3c; margin: 0 0 36px')}>{momentumText}</p>

          {isReview ? (
            <ul style={s('list-style: none; padding: 0; display: flex; flex-direction: column; border-top: 1px solid var(--color-divider); max-width: 720px; margin: 0 0 40px')}>
              {APPLICATION_SECTIONS.slice(0, APPLICATION_INPUT_SECTIONS).map((sc, i) => (
                <li key={sc.id} style={s('border-bottom: 1px solid var(--color-divider)')}>
                  <button
                    type="button"
                    onClick={() => setSection(i)}
                    aria-label={t('application.review.goTo', { section: sectionTitle(sc.id) })}
                    {...x(
                      `display: grid; grid-template-columns: 1fr auto; gap: 20px; padding: 18px 0; align-items: center; width: 100%; background: none; border: 0; text-align: left; cursor: pointer; color: inherit; font: inherit`,
                      { hover: 'background: color-mix(in srgb, var(--color-accent-100) 45%, transparent)' },
                    )}
                  >
                    <span>
                      <span style={s(`display: block; ${SANS}; font-size: 18px`)}>{sectionTitle(sc.id)}</span>
                      <span style={s(`display: block; font-size: 13.5px; color: ${mix(60)}; margin-top: 3px`)}>
                        {doneFlags[i] ? t('application.review.answered') : t('application.review.blank')}
                      </span>
                    </span>
                    <span className="tag tag-accent" style={s('letter-spacing: 0.08em; text-transform: uppercase')}>
                      {doneFlags[i] ? t('application.review.complete') : t('application.review.incomplete')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div data-resp="2" style={s('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 26px 24px; max-width: 720px')}>
              {sec.fields.map((f) => {
                const id = `app-${f.id}`;
                const props = INPUT_PROPS[f.id];
                const hintText = hint(sec.id, f.id);
                return (
                  <div key={f.id} className="field" style={s(WIDE.has(f.id) ? 'grid-column: span 2' : '')}>
                    <label
                      htmlFor={id}
                      style={s(`${SANS}; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: ${mix(62)}; display: block; margin-bottom: 8px`)}
                    >
                      {t(`application.sections.${sec.id}.fields.${f.id}.label`)}
                    </label>
                    <input
                      id={id}
                      name={id}
                      className="input"
                      type={props?.type ?? 'text'}
                      inputMode={props?.inputMode}
                      autoComplete={props?.autoComplete ?? 'off'}
                      dir={props?.dir}
                      maxLength={2000}
                      placeholder={t(`application.sections.${sec.id}.fields.${f.id}.placeholder`)}
                      value={values[f.id] ?? ''}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setField(f.id, e.target.value)}
                      aria-describedby={hintText ? `${id}-hint` : undefined}
                      style={s('width: 100%; padding: 13px 14px; font-size: 15px; border-radius: 12px')}
                    />
                    <span id={`${id}-hint`} style={s(`display: block; font-size: 12px; color: ${mix(50)}; margin-top: 6px`)}>
                      {hintText}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div
            data-app-foot
            style={s('display: flex; align-items: center; gap: 14px; margin-top: 48px; padding-top: 28px; border-top: 1px solid var(--color-divider); max-width: 720px')}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSection(Math.max(0, section - 1))}
              style={s(`padding: 14px 22px; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; visibility: ${section === 0 ? 'hidden' : 'visible'}`)}
              tabIndex={section === 0 ? -1 : 0}
            >
              <Arrow /> {t('application.prev')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={last ? leave('/portal/documents') : () => setSection(section + 1)}
              style={s('padding: 15px 28px; font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase')}
            >
              {last ? t('application.toDocuments') : t('application.next')}
            </button>
            <span style={s(`font-size: 12.5px; line-height: 1.5; color: ${showError ? '#9a3b2e' : mix(55)}; margin-left: auto; text-align: right; max-width: 30ch`)}>
              {showError ? t('application.saveError') : t('application.footnote')}
            </span>
          </div>
          <span role="status" aria-live="polite" className="pt-sr-only">
            {status === 'saving' ? t('application.saving') : status === 'saved' ? t('application.saved') : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

