'use client';
import { APPLICATION_INPUT_SECTIONS, APPLICATION_SECTIONS, sectionDone } from '@dpl/core';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from '@/i18n/navigation';
import { applicationPercent, momentum } from './model/progress';
import type { PortalState } from './model/types';
import { IconAlert, IconArrow, IconBack, IconCheck, IconSpark } from '../ui/icons';
import { PortalShell } from './PortalShell';
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

  const railMeta = (i: number, done: boolean, current: boolean): string =>
    done
      ? t('application.rail.complete')
      : current
        ? t('application.rail.inProgress')
        : APPLICATION_SECTIONS[i]!.id === 'review'
          ? t('application.rail.final')
          : t('application.rail.questions', { count: APPLICATION_SECTIONS[i]!.fields.length });

  return (
    <PortalShell
      active="application"
      lead={initial.lead}
      onNavigate={(href) => {
        if (href !== '/portal/application') void leave(href)();
      }}
    >
      <div className="ui-grid-side ui-app">
        <aside className="ui-card ui-rail ui-rise">
          <div className="ui-rail-head">
            <div className="ui-kicker">{t('application.railTitle')}</div>
            <div className="ui-rail-progress">
              <span className="ui-meter">
                <span style={{ width: `${percent}%` }} />
              </span>
              <span className="ui-small">{t('application.headerProgress', { percent })}</span>
            </div>
          </div>
          <nav aria-label={t('application.railTitle')}>
            <div className="ui-rail-list">
              {APPLICATION_SECTIONS.map((sc, i) => {
                const current = i === section;
                const done = doneFlags[i]!;
                return (
                  <button
                    key={sc.id}
                    type="button"
                    className="ui-rail-item"
                    data-state={done ? 'done' : current ? 'current' : 'next'}
                    onClick={() => setSection(i)}
                    aria-current={current ? 'step' : undefined}
                  >
                    <span className="ui-check-mark" aria-hidden="true">
                      {done ? <IconCheck size={15} strokeWidth={2.4} /> : String(i + 1)}
                    </span>
                    <span className="ui-rail-text">
                      <span className="ui-rail-title">{sectionTitle(sc.id)}</span>
                      <span className="ui-rail-meta">{railMeta(i, done, current)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        <section key={section} className="ui-card ui-pane ui-rise">
          <div className="ui-pane-head">
            <div className="ui-kicker">{t('application.kicker', { n: section + 1 })}</div>
            {!showError && (
              <span className={`ui-badge ui-push ${status === 'saving' ? 'ui-badge-line' : 'ui-badge-ok'}`} aria-hidden="true">
                {status === 'saving' ? t('application.saving') : t('application.saved')}
              </span>
            )}
          </div>
          <h1 ref={headingRef} tabIndex={-1} className="ui-h1 ui-pane-title">
            {sectionTitle(sec.id)}
          </h1>
          <p className="ui-lede" style={{ maxWidth: '56ch' }}>
            {t(`application.sections.${sec.id}.intro`)}
          </p>
          <p className="ui-momentum">
            <IconSpark size={16} />
            {momentumText}
          </p>

          {isReview ? (
            <ul className="ui-review">
              {APPLICATION_SECTIONS.slice(0, APPLICATION_INPUT_SECTIONS).map((sc, i) => (
                <li key={sc.id}>
                  <button
                    type="button"
                    className="ui-review-item"
                    onClick={() => setSection(i)}
                    aria-label={t('application.review.goTo', { section: sectionTitle(sc.id) })}
                  >
                    <span className={`ui-icon-chip ${doneFlags[i] ? 'ui-icon-chip-ok' : 'ui-icon-chip-warn'}`} aria-hidden="true">
                      {doneFlags[i] ? <IconCheck size={16} strokeWidth={2.2} /> : <IconAlert size={16} />}
                    </span>
                    <span>
                      <span className="ui-review-title">{sectionTitle(sc.id)}</span>
                      <span className="ui-small">{doneFlags[i] ? t('application.review.answered') : t('application.review.blank')}</span>
                    </span>
                    <span className={`ui-badge ${doneFlags[i] ? 'ui-badge-ok' : 'ui-badge-warn'}`}>
                      {doneFlags[i] ? t('application.review.complete') : t('application.review.incomplete')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="ui-fields">
              {sec.fields.map((f) => {
                const id = `app-${f.id}`;
                const props = INPUT_PROPS[f.id];
                const hintText = hint(sec.id, f.id);
                return (
                  <div key={f.id} className={WIDE.has(f.id) ? 'ui-field ui-field-wide' : 'ui-field'}>
                    <label htmlFor={id} className="ui-label">
                      {t(`application.sections.${sec.id}.fields.${f.id}.label`)}
                    </label>
                    <input
                      id={id}
                      name={id}
                      className="ui-input"
                      type={props?.type ?? 'text'}
                      inputMode={props?.inputMode}
                      autoComplete={props?.autoComplete ?? 'off'}
                      dir={props?.dir}
                      maxLength={2000}
                      placeholder={t(`application.sections.${sec.id}.fields.${f.id}.placeholder`)}
                      value={values[f.id] ?? ''}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setField(f.id, e.target.value)}
                      aria-describedby={hintText ? `${id}-hint` : undefined}
                    />
                    {hintText && (
                      <span id={`${id}-hint`} className="ui-hint">
                        {hintText}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="ui-pane-foot">
            <button
              type="button"
              className="ui-btn"
              onClick={() => setSection(Math.max(0, section - 1))}
              style={{ visibility: section === 0 ? 'hidden' : 'visible' }}
              tabIndex={section === 0 ? -1 : 0}
            >
              <IconBack size={17} />
              {t('application.prev')}
            </button>
            <button type="button" className="ui-btn ui-btn-primary ui-btn-lg" onClick={last ? leave('/portal/documents') : () => setSection(section + 1)}>
              {last ? t('application.toDocuments') : t('application.next')}
              <IconArrow size={18} />
            </button>
            <span className={showError ? 'ui-pane-note ui-error' : 'ui-pane-note'}>{showError ? t('application.saveError') : t('application.footnote')}</span>
          </div>
          <span role="status" aria-live="polite" className="pt-sr-only">
            {status === 'saving' ? t('application.saving') : status === 'saved' ? t('application.saved') : ''}
          </span>
        </section>
      </div>
    </PortalShell>
  );
}
