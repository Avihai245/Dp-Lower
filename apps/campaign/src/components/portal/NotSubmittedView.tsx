'use client';
import { APPLICANT_STATUS_OPTIONS, APPLICATION_SECTIONS } from '@dpl/core';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { IconAlert, IconArrow, IconCheck, IconFolder, IconSpark } from '../ui/icons';
import { ProgressRing } from '../ui/ProgressRing';
import { buildChecklist, dashboardHeadline, nextLine } from './model/progress';
import type { PortalState } from './model/types';
import { Timeline } from './Timeline';

/**
 * The dashboard before the application is submitted: the progress (hero), where the case stands (timeline), the one
 * next step and the checklist. The timeline comes before the checklist: the tour visits them in that order.
 */
export function NotSubmittedView({ state }: { state: PortalState }) {
  const t = useTranslations('portal');
  const { application, progress, lead } = state;
  const data = application?.data ?? {};
  const applicationComplete = application?.complete ?? false;
  const started = !!lead.applicationStartedAt || progress.sectionsDone > 0;
  const headline = dashboardHeadline({ started, applicationComplete });
  const checklist = buildChecklist({ applicationComplete, docsReceived: progress.docsReceived, docsTotal: progress.docsTotal });
  const next = nextLine({ data, docsReceived: progress.docsReceived, docsTotal: progress.docsTotal });
  const doneCount = checklist.filter((c) => c.state === 'done').length;

  const nextText =
    next.kind === 'section'
      ? t('dashboard.current.nextSection', { section: t(`application.sections.${APPLICATION_SECTIONS[next.index]!.id}.title`) })
      : next.kind === 'allIn'
        ? t('dashboard.current.allIn')
        : t('dashboard.current.docsLeft', { count: next.count });

  // a status the team set before the application was submitted ("Additional information required"): the applicant sees it too
  const teamStatus = (APPLICANT_STATUS_OPTIONS as readonly string[]).includes(lead.status);

  return (
    <>
      {teamStatus && (
        <p data-team-status role="status" className="ui-note ui-note-gold ui-rise" style={{ margin: 0 }}>
          <IconAlert size={18} style={{ color: 'var(--ui-gold-strong)' }} />
          <span>{t.rich('dashboard.teamStatus', { status: t(`status.${lead.status}`), b: (chunks) => <strong>{chunks}</strong> })}</span>
        </p>
      )}

      <section className="ui-hero ui-hero-pad ui-rise">
        <div className="ui-hero-grid">
          <div>
            <div className="ui-kicker">{t('dashboard.kicker')}</div>
            <h1 className="ui-h1 ui-hero-title">{t(`dashboard.headline.${headline}`)}</h1>
            <p className="ui-lede">{t(`dashboard.sub.${started ? 'continue' : 'start'}`)}</p>
            <div className="ui-hero-progress">
              <span className="ui-meter">
                <span style={{ width: `${progress.percent}%` }} />
              </span>
              <span className="ui-hero-progress-text">{t('dashboard.progress', { percent: progress.percent })}</span>
            </div>
          </div>
          <div className="ui-hide-sm">
            <ProgressRing percent={progress.percent} />
          </div>
        </div>
      </section>

      <div className="ui-rise-2">
        <Timeline timeline={state.timeline} />
      </div>

      <div className="ui-grid-2 ui-rise-3">
        <section className="ui-card ui-card-pad ui-next" aria-labelledby="pt-next-title">
          <div className="ui-kicker">{t('dashboard.current.kicker')}</div>
          <h2 id="pt-next-title" className="ui-h2">
            {t('dashboard.current.title')}
          </h2>
          <p className="ui-next-line">
            <IconSpark size={18} />
            <span>{nextText}</span>
          </p>
          <p className="ui-small" style={{ margin: '0 0 22px' }}>
            {t('dashboard.current.saved')}
          </p>
          <div className="ui-stack-sm">
            <Link href="/portal/application" data-tour="action" className="ui-btn ui-btn-primary ui-btn-lg ui-btn-block">
              {t(`dashboard.current.${started ? 'continue' : 'start'}`)}
              <IconArrow size={18} />
            </Link>
            <Link href="/portal/documents" data-tour="docs" className="ui-btn ui-btn-lg ui-btn-block">
              <IconFolder size={18} />
              {t('dashboard.current.documents')}
            </Link>
          </div>
        </section>

        <section data-tour="checklist" className="ui-card" aria-labelledby="pt-checklist-title">
          <div className="ui-card-head">
            <h2 id="pt-checklist-title" className="ui-card-title">
              {t('dashboard.checklistTitle')}
            </h2>
            <span className="ui-badge ui-badge-ok ui-push" dir="ltr">
              {doneCount}/{checklist.length}
            </span>
          </div>
          <ul className="ui-rows ui-checklist">
            {checklist.map((c, i) => (
              <li key={c.id} data-state={c.state}>
                <span className="ui-check-mark" aria-hidden="true">
                  {c.state === 'done' ? <IconCheck size={15} strokeWidth={2.4} /> : c.state === 'current' ? <IconArrow size={15} strokeWidth={2.2} /> : i + 1}
                </span>
                <span>{t(`dashboard.checklist.${c.id}`)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
