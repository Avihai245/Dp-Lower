'use client';
import type { Locale } from '@dpl/core';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { IconAlert, IconClock, IconShield, IconUpload } from '../ui/icons';
import { Stepper } from '../ui/Stepper';
import { ancestorSummary } from './model/facts';
import { formatLongDate, formatShortDate } from './model/format';
import type { PortalActivity, PortalState, StatusStepMeta } from './model/types';
import { richTags } from './shared';
import { Timeline } from './Timeline';

const AFTER = ['one', 'two', 'three'] as const;

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

  return (
    <>
      <section className="ui-hero ui-hero-pad ui-rise">
        <div className="ui-kicker">
          {t('submitted.kicker', { route: t(`submitted.route.${route}`), date: formatLongDate(lead.submittedAt ?? lead.createdAt, locale) })}
        </div>
        <h1 className="ui-h1 ui-hero-title">{t(`status.${lead.status}`)}</h1>
        <p className="ui-lede">{t.rich('submitted.intro', { caseRef: lead.caseRef, ...richTags })}</p>
      </section>

      {showAction && (
        <section className="ui-card ui-card-pad ui-action-card ui-rise-2" aria-labelledby="pt-action-title">
          <span className="ui-icon-chip ui-icon-chip-lg ui-icon-chip-warn" aria-hidden="true">
            <IconAlert size={22} />
          </span>
          <div className="ui-action-body">
            <div className="ui-kicker">{t('submitted.action.kicker')}</div>
            <h2 id="pt-action-title" className="ui-h2" style={{ margin: '6px 0 8px' }}>
              {actionTitle}
            </h2>
            {flagged.length === 0 ? (
              <p className="ui-action-text">{t('submitted.action.bodyInfo')}</p>
            ) : (
              flagged.map((d) => (
                <p key={d.docType} className="ui-action-text">
                  <strong>{t(`documents.slots.${d.docType}.title`)}</strong>
                  {': '}
                  {d.reviewNote ? <span dir="auto">{d.reviewNote}</span> : t(`submitted.action.${d.status === 'reupload' ? 'reupload' : 'requested'}`)}
                </p>
              ))
            )}
          </div>
          <Link href="/portal/documents" className="ui-btn ui-btn-primary ui-btn-lg">
            <IconUpload size={18} />
            {t('submitted.action.button')}
          </Link>
        </section>
      )}

      <div className="ui-rise-2">
        <Timeline timeline={state.timeline} />
      </div>

      <div className="ui-grid-3 ui-rise-3">
        {AFTER.map((key, i) => (
          <div key={key} className="ui-card ui-card-pad ui-after">
            <span className="ui-num" aria-hidden="true">
              0{i + 1}
            </span>
            <h3 className="ui-after-title">{t(`submitted.after.${key}.title`)}</h3>
            <p className="ui-small" style={{ margin: 0, fontSize: 14 }}>
              {t(`submitted.after.${key}.body`)}
            </p>
          </div>
        ))}
      </div>

      <section className="ui-card" aria-labelledby="pt-road-title">
        <div className="ui-card-head">
          <h2 id="pt-road-title" className="ui-kicker" style={{ margin: 0 }}>
            {t('submitted.roadmapTitle')}
          </h2>
        </div>
        <div className="ui-card-pad">
          <Stepper items={state.statusSteps.map((step) => ({ key: step.id, state: step.state, label: t(`submitted.steps.${step.id}`), meta: stepMeta(step.meta) }))} />
        </div>
      </section>

      <div className="ui-grid-2">
        <section className="ui-card" aria-labelledby="pt-activity-title">
          <div className="ui-card-head">
            <IconClock size={18} style={{ color: 'var(--ui-gold)' }} />
            <h2 id="pt-activity-title" className="ui-card-title">
              {t('submitted.activityTitle')}
            </h2>
          </div>
          <ul className="ui-rows ui-activity">
            {state.activity.map((a) => (
              <li key={a.id}>
                <span className="ui-activity-date">{formatShortDate(a.at, locale)}</span>
                <span>{activityText(a)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="ui-card" aria-labelledby="pt-case-title">
          <div className="ui-card-head">
            <IconShield size={18} style={{ color: 'var(--ui-gold)' }} />
            <h2 id="pt-case-title" className="ui-card-title">
              {t('submitted.caseTitle')}
            </h2>
          </div>
          <dl className="ui-rows ui-facts">
            {facts.map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
          <p className="ui-small ui-handler">{caseHandler ? t('submitted.handler', { name: caseHandler.name }) : t('submitted.handlerNone')}</p>
        </section>
      </div>
    </>
  );
}
