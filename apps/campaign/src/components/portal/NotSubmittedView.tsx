'use client';
import { APPLICANT_STATUS_OPTIONS, APPLICATION_SECTIONS } from '@dpl/core';
import { s } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  buildChecklist,
  dashboardHeadline,
  nextLine,
  type ChecklistItem,
} from './model/progress';
import type { PortalState } from './model/types';
import { Arrow, SANS, mix } from './shared';

const markCss = (state: ChecklistItem['state']): string =>
  `width: 26px; height: 26px; display: grid; place-items: center; font-size: 13px; border: 1px solid ${
    state === 'next' ? mix(28) : 'var(--color-accent)'
  }; background: ${state === 'done' ? 'var(--color-accent)' : 'transparent'}; color: ${state === 'done' ? 'var(--color-bg)' : 'var(--color-accent-700)'}`;

/** The dashboard before the application is submitted: progress, checklist and the one next step. */
export function NotSubmittedView({ state }: { state: PortalState }) {
  const t = useTranslations('portal');
  const { application, progress, lead } = state;
  const data = application?.data ?? {};
  const applicationComplete = application?.complete ?? false;
  const started = !!lead.applicationStartedAt || progress.sectionsDone > 0;
  const headline = dashboardHeadline({ started, applicationComplete });
  const checklist = buildChecklist({ applicationComplete, docsReceived: progress.docsReceived, docsTotal: progress.docsTotal });
  const next = nextLine({ data, docsReceived: progress.docsReceived, docsTotal: progress.docsTotal });

  const nextText =
    next.kind === 'section'
      ? t('dashboard.current.nextSection', { section: t(`application.sections.${APPLICATION_SECTIONS[next.index]!.id}.title`) })
      : next.kind === 'allIn'
        ? t('dashboard.current.allIn')
        : t('dashboard.current.docsLeft', { count: next.count });

  // a status the team set before the application was submitted ("Additional information required"): the applicant sees it too
  const teamStatus = (APPLICANT_STATUS_OPTIONS as readonly string[]).includes(lead.status);

  return (
    <div data-pad style={s('max-width: 100%; margin: 0 auto; padding: 56px clamp(20px, 4.6vw, 160px) 80px')}>
      <div style={s(`${SANS}; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-accent-700); margin-bottom: 16px`)}>
        {t('dashboard.kicker')}
      </div>
      {teamStatus && (
        <p
          data-team-status
          role="status"
          style={s(`${SANS}; font-size: 14.5px; line-height: 1.55; color: ${mix(80)}; border: 1px solid var(--color-accent); padding: 10px 16px; margin: 0 0 22px; max-width: 620px`)}
        >
          {t.rich('dashboard.teamStatus', { status: t(`status.${lead.status}`), b: (chunks) => <strong style={s('font-weight: 600')}>{chunks}</strong> })}
        </p>
      )}
      <h1 data-hero-h1 style={s('font-size: 48px; letter-spacing: -0.022em; margin: 0 0 14px; max-width: 22ch')}>{t(`dashboard.headline.${headline}`)}</h1>
      <p style={s(`font-size: 17px; color: ${mix(68)}; margin: 0 0 26px; max-width: 60ch`)}>{t(`dashboard.sub.${started ? 'continue' : 'start'}`)}</p>
      <div style={s('display: flex; align-items: center; gap: 18px; flex-wrap: wrap; margin-bottom: 44px; max-width: 620px')}>
        <span style={s('flex: 1; min-width: 200px; height: 3px; background: var(--color-divider); display: block')}>
          <span
            style={s(`display: block; height: 3px; background: #a07a3c; width: ${progress.percent}%; transition: width 700ms cubic-bezier(0.4,0,0.2,1)`)}
          />
        </span>
        <span style={s('font-size: 14.5px; color: #736d64')}>{t('dashboard.progress', { percent: progress.percent })}</span>
      </div>

      <div data-resp="2" style={s('display: grid; grid-template-columns: minmax(0, 0.6fr) minmax(0, 1fr); gap: 56px; align-items: start')}>
        <ul data-tour="checklist" style={s('list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--color-divider)')}>
          {checklist.map((c) => (
            <li
              key={c.id}
              style={s(
                `display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--color-divider); opacity: ${c.state === 'next' ? '0.5' : '1'}`,
              )}
            >
              <span aria-hidden="true" style={s(markCss(c.state))}>
                {c.state === 'done' ? '✓' : c.state === 'current' ? <Arrow forward /> : '○'}
              </span>
              <span style={s(`${SANS}; font-size: 17px; padding-top: 1px`)}>{t(`dashboard.checklist.${c.id}`)}</span>
            </li>
          ))}
        </ul>
        <div className="blueprint" style={s('border: 1px solid var(--color-accent); padding: 30px 28px')}>
          <div style={s(`${SANS}; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-accent-700); margin-bottom: 14px`)}>
            {t('dashboard.current.kicker')}
          </div>
          <div style={s("font-family: 'Newsreader', Georgia, serif; font-size: 26px; line-height: 1.15; margin-bottom: 14px")}>{t('dashboard.current.title')}</div>
          <p style={s(`font-size: 14.5px; line-height: 1.6; color: ${mix(68)}; margin: 0 0 10px`)}>{nextText}</p>
          <p style={s(`font-size: 13.5px; line-height: 1.6; color: ${mix(55)}; margin: 0 0 24px`)}>{t('dashboard.current.saved')}</p>
          <Link
            href="/portal/application"
            data-tour="action"
            className="btn btn-primary"
            style={s('width: 100%; padding: 16px; font-size: 14.5px; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10px')}
          >
            {t(`dashboard.current.${started ? 'continue' : 'start'}`)}
          </Link>
          <Link
            href="/portal/documents"
            data-tour="docs"
            className="btn btn-secondary"
            style={s('width: 100%; padding: 15px; font-size: 13.5px; letter-spacing: 0.08em; text-transform: uppercase')}
          >
            {t('dashboard.current.documents')}
          </Link>
        </div>
      </div>
    </div>
  );
}
