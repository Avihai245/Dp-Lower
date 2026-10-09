'use client';
import type { Locale } from '@dpl/core';
import { s } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ancestorSummary } from './model/facts';
import { formatLongDate, formatShortDate } from './model/format';
import type { PortalActivity, PortalState, StatusStep, StatusStepMeta, StepState } from './model/types';
import { SANS, mix, richTags } from './shared';

const AFTER = ['one', 'two', 'three'] as const;

const stepCss = (state: StepState): string => `padding: 22px 20px 24px 0; opacity: ${state === 'next' ? '0.5' : '1'}`;
const stepBarCss = (state: StepState): string =>
  `display: block; height: 2px; margin: -23px 0 20px; background: ${state === 'next' ? 'var(--color-neutral-200)' : 'var(--color-accent)'}`;
const stepMarkCss = (state: StepState): string =>
  `width: 20px; height: 20px; display: grid; place-items: center; font-size: 11px; border: 1px solid ${
    state === 'next' ? mix(28) : 'var(--color-accent)'
  }; background: ${state === 'done' ? 'var(--color-accent)' : 'transparent'}; color: ${state === 'done' ? 'var(--color-bg)' : 'var(--color-accent-700)'}`;

/** The dashboard once the application is with the firm: status, what happens next, the roadmap, activity and case facts. */
export function SubmittedView({ state }: { state: PortalState }) {
  const t = useTranslations('portal');
  const locale = useLocale() as Locale;
  const { lead, documents, progress, application, caseHandler } = state;
  const route = lead.route ?? 'unsure';

  const stepMeta = (m: StatusStepMeta): string => {
    switch (m.kind) {
      case 'date':
        return formatShortDate(m.iso, locale);
      case 'received':
        return t('submitted.stepMeta.received', { done: m.done, total: m.total });
      default:
        return t(`submitted.stepMeta.${m.kind}`);
    }
  };

  const activityText = (a: PortalActivity): string => {
    if (a.code === 'document_uploaded') {
      return a.docType
        ? t('submitted.activity.document_uploaded', { title: t(`documents.slots.${a.docType}.title`) })
        : t('submitted.activity.document_uploaded_generic');
    }
    if (a.code === 'status_changed' && a.status) return t('submitted.activity.status_changed', { status: t(`status.${a.status}`) });
    return t(`submitted.activity.${a.code}`);
  };

  const flagged = documents.filter((d) => d.status === 'reupload' || d.status === 'requested');
  const showAction = lead.status !== 'review_completed' && lead.status !== 'contacting' && (flagged.length > 0 || lead.status === 'info_required');
  const actionTitle =
    flagged.length === 0
      ? t('submitted.action.titleInfo')
      : flagged.length === 1
        ? t('submitted.action.titleOne')
        : t('submitted.action.titleMany', { count: flagged.length });

  const ancestor = ancestorSummary(application?.data);
  const facts: Array<{ key: string; label: string; value: string }> = [
    { key: 'route', label: t('submitted.facts.route'), value: t(`submitted.facts.routeValue.${route}`) },
    ...(ancestor ? [{ key: 'ancestor', label: t('submitted.facts.ancestor'), value: ancestor }] : []),
    {
      key: 'documents',
      label: t('submitted.facts.documents'),
      value: t('submitted.facts.documentsValue', { done: progress.docsReceived, total: progress.docsTotal }),
    },
  ];

  const h3 = `font-size: 13px; letter-spacing: 0.16em; text-transform: uppercase; color: ${mix(55)}; margin: 0 0 18px`;

  return (
    <div data-pad style={s('max-width: 100%; margin: 0 auto; padding: 56px clamp(20px, 4.6vw, 160px) 80px')}>
      <div style={s(`${SANS}; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-accent-700); margin-bottom: 16px`)}>
        {t('submitted.kicker', { route: t(`submitted.route.${route}`), date: formatLongDate(lead.submittedAt ?? lead.createdAt, locale) })}
      </div>
      <h1 data-hero-h1 style={s('font-size: 48px; letter-spacing: -0.024em; margin: 0 0 10px; max-width: 24ch')}>{t(`status.${lead.status}`)}</h1>
      <p style={s(`font-size: 16px; color: ${mix(66)}; margin: 0 0 34px`)}>{t.rich('submitted.intro', { caseRef: lead.caseRef, ...richTags })}</p>

      <div
        data-resp="3"
        style={s(
          'display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px; padding: 26px 0 34px; border-top: 1px solid var(--color-divider); border-bottom: 1px solid var(--color-divider); margin-bottom: 48px',
        )}
      >
        {AFTER.map((key, i) => (
          <div key={key}>
            <div style={s('font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #a07a3c; margin-bottom: 10px')}>0{i + 1}</div>
            <div style={s("font-family: 'Newsreader', Georgia, serif; font-size: 21px; line-height: 1.2; margin-bottom: 8px")}>{t(`submitted.after.${key}.title`)}</div>
            <div style={s(`font-size: 14.5px; line-height: 1.6; color: ${mix(66)}`)}>{t(`submitted.after.${key}.body`)}</div>
          </div>
        ))}
      </div>

      {showAction && (
        <div
          className="blueprint"
          data-resp="2"
          style={s('border: 1px solid var(--color-accent); padding: 32px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 32px; align-items: center; margin-bottom: 56px')}
        >
          <div>
            <div style={s(`${SANS}; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-accent-700); margin-bottom: 12px`)}>
              {t('submitted.action.kicker')}
            </div>
            <div style={s(`${SANS}; font-size: 30px; line-height: 1.15; margin-bottom: 8px`)}>{actionTitle}</div>
            {flagged.length === 0 ? (
              <p style={s(`font-size: 14.5px; color: ${mix(70)}; margin: 0; max-width: 60ch`)}>{t('submitted.action.bodyInfo')}</p>
            ) : (
              flagged.map((d) => (
                <p key={d.docType} style={s(`font-size: 14.5px; color: ${mix(70)}; margin: 0 0 4px; max-width: 60ch`)}>
                  <strong style={s('font-weight: 600')}>{t(`documents.slots.${d.docType}.title`)}</strong>
                  {': '}
                  {d.reviewNote ? <span dir="auto">{d.reviewNote}</span> : t(`submitted.action.${d.status === 'reupload' ? 'reupload' : 'requested'}`)}
                </p>
              ))
            )}
          </div>
          <Link
            href="/portal/documents"
            className="btn btn-primary"
            style={s('padding: 18px 30px; font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap')}
          >
            {t('submitted.action.button')}
          </Link>
        </div>
      )}

      <ol
        data-resp="6"
        style={s('list-style: none; padding: 0; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); border-top: 1px solid var(--color-divider); margin: 0 0 56px')}
      >
        {state.statusSteps.map((step: StatusStep) => (
          <li key={step.id} data-cell aria-current={step.state === 'current' ? 'step' : undefined} style={s(stepCss(step.state))}>
            <span aria-hidden="true" style={s(stepBarCss(step.state))} />
            <span aria-hidden="true" style={s(stepMarkCss(step.state))}>
              {step.state === 'done' ? '✓' : step.state === 'current' ? '●' : ''}
            </span>
            <span style={s(`${SANS}; font-size: 17px; line-height: 1.15; margin-top: 14px; display: block`)}>{t(`submitted.steps.${step.id}`)}</span>
            <span style={s(`font-size: 12.5px; color: ${mix(55)}; display: block; margin-top: 5px`)}>{stepMeta(step.meta)}</span>
          </li>
        ))}
      </ol>

      <div data-resp="2" style={s('display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 56px')}>
        <div>
          <h3 style={s(h3)}>{t('submitted.activityTitle')}</h3>
          <ul style={s('list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--color-divider)')}>
            {state.activity.map((a) => (
              <li
                key={a.id}
                data-kv
                style={s('display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 18px; padding: 15px 0; border-bottom: 1px solid var(--color-divider)')}
              >
                <span style={s(`font-size: 12.5px; letter-spacing: 0.04em; color: ${mix(52)}; ${SANS}`)}>{formatShortDate(a.at, locale)}</span>
                <span style={s('font-size: 14.5px; line-height: 1.5')}>{activityText(a)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 style={s(h3)}>{t('submitted.caseTitle')}</h3>
          <dl style={s('margin: 0; border-top: 1px solid var(--color-divider)')}>
            {facts.map((f) => (
              <div
                key={f.key}
                data-kv
                style={s('display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; padding: 15px 0; border-bottom: 1px solid var(--color-divider)')}
              >
                <dt style={s(`font-size: 12.5px; letter-spacing: 0.06em; text-transform: uppercase; color: ${mix(52)}; ${SANS}`)}>{f.label}</dt>
                <dd style={s('font-size: 14.5px; margin: 0')}>{f.value}</dd>
              </div>
            ))}
          </dl>
          <p style={s(`font-size: 12.5px; color: ${mix(50)}; margin-top: 20px`)}>
            {caseHandler ? t('submitted.handler', { name: caseHandler.name }) : t('submitted.handlerNone')}
          </p>
        </div>
      </div>
    </div>
  );
}
