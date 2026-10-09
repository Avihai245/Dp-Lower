'use client';

import { s, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { setInboxStatusAction } from '@/app/[locale]/(admin)/admin/actions';
import { Link } from '@/i18n/navigation';
import { useAdmin } from './AdminProvider';
import { useAgo, useIsolate } from './rowbits';
import type { CallbackItem, ContactItem, InboxData, InboxStatus } from './types';
import { CARD, PageFrame, Pill } from './ui';
import { useRun } from './useRun';

type Filter = 'open' | 'new' | 'in_progress' | 'closed' | 'all';
const FILTERS: Filter[] = ['open', 'new', 'in_progress', 'closed', 'all'];
const matches = (f: Filter, st: InboxStatus) => f === 'all' || (f === 'open' ? st !== 'closed' : f === st);

const CHIP: Record<InboxStatus, { bg: string; fg: string }> = {
  new: { bg: '#f6f0e4', fg: '#7a5c2c' },
  in_progress: { bg: '#e9f0f7', fg: '#2d4a68' },
  closed: { bg: '#f6f2ec', fg: '#736d64' },
};

const SMALL =
  "background:#fff;color:#14202b;border:1px solid #e2dbcf;border-radius:999px;padding:6px 11px;font-family:'Manrope',system-ui,sans-serif;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap";

/** /admin/inbox: callback requests and the website's contact forms, each moving new -> in progress -> closed. */
export function InboxView({ data }: { data: InboxData }) {
  const t = useTranslations('admin');
  const [filter, setFilter] = useState<Filter>('open');
  const all = [...data.callbacks, ...data.contacts];
  const count = (f: Filter) => all.filter((i) => matches(f, i.status)).length;
  const label: Record<Filter, string> = {
    open: t('inbox.filterOpen'),
    new: t('inbox.filterNew'),
    in_progress: t('inbox.filterProgress'),
    closed: t('inbox.filterClosed'),
    all: t('inbox.filterAll'),
  };
  const callbacks = data.callbacks.filter((c) => matches(filter, c.status));
  const contacts = data.contacts.filter((c) => matches(filter, c.status));

  return (
    <PageFrame title={t('inbox.title')} help="inbox">
      <div role="group" aria-label={t('nav.filters')} style={s('display:flex;flex-wrap:wrap;gap:4px;margin-bottom:16px')}>
        {FILTERS.map((f) => (
          <Pill key={f} on={filter === f} onClick={() => setFilter(f)} data-inbox-filter={f}>
            {label[f]} <span style={s('opacity:0.6')}>{count(f)}</span>
          </Pill>
        ))}
      </div>
      <div data-resp="2" style={s('display:grid;grid-template-columns:minmax(0, 1fr) minmax(0, 1fr);gap:14px;align-items:start')}>
        <section data-inbox-callbacks style={s(CARD)}>
          <SectionHead title={t('inbox.callbacks')} />
          {callbacks.length === 0 && <Empty text={t('inbox.emptyCallbacks')} />}
          {callbacks.map((c) => (
            <CallbackRow key={c.id} item={c} />
          ))}
        </section>
        <section data-inbox-contacts style={s(CARD)}>
          <SectionHead title={t('inbox.contacts')} />
          {contacts.length === 0 && <Empty text={t('inbox.emptyContacts')} />}
          {contacts.map((c) => (
            <ContactRow key={c.id} item={c} />
          ))}
        </section>
      </div>
    </PageFrame>
  );
}

function SectionHead({ title }: { title: string }) {
  return (
    <h2
      style={s(
        "font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#7a5c2c;margin:0 0 6px;font-family:'Manrope',system-ui,sans-serif;line-height:inherit",
      )}
    >
      {title}
    </h2>
  );
}

const Empty = ({ text }: { text: string }) => <div style={s('font-size:13.5px;color:#9a948a;padding:10px 0')}>{text}</div>;

function StatusChip({ status }: { status: InboxStatus }) {
  const t = useTranslations('admin');
  return (
    <span
      data-inbox-status={status}
      style={s(`font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;white-space:nowrap;background:${CHIP[status].bg};color:${CHIP[status].fg}`)}
    >
      {t(`inbox.status.${status}`)}
    </span>
  );
}

/** The workflow buttons: Start / Close / Reopen. */
function Actions({ kind, id, status }: { kind: 'callback' | 'contact'; id: string; status: InboxStatus }) {
  const t = useTranslations('admin');
  const { pending, run } = useRun();
  const set = (to: InboxStatus) => run(() => setInboxStatusAction({ kind, id, status: to }));
  const btn = (to: InboxStatus, text: string, key: string) => (
    <button key={key} type="button" data-inbox-action={key} disabled={pending} onClick={() => set(to)} {...x(`${SMALL};opacity:${pending ? '0.5' : '1'}`, { hover: 'border-color:#14202b' })}>
      {text}
    </button>
  );
  return (
    <span style={s('display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end')}>
      {status === 'new' && btn('in_progress', t('inbox.start'), 'start')}
      {status !== 'closed' && btn('closed', t('inbox.close'), 'close')}
      {status === 'closed' && btn('in_progress', t('inbox.reopen'), 'reopen')}
    </span>
  );
}

function Meta({ parts }: { parts: Array<string | null | undefined> }) {
  const shown = parts.filter(Boolean);
  if (!shown.length) return null;
  return <div style={s('font-size:12px;color:#9a948a;margin-top:6px;line-height:1.6')}>{shown.join(' · ')}</div>;
}

function LeadLinkChip({ lead }: { lead: NonNullable<CallbackItem['lead']> }) {
  const t = useTranslations('admin');
  const isolate = useIsolate();
  const { listQuery } = useAdmin();
  return (
    <Link
      href={`/admin/leads/${lead.id}${listQuery}`}
      data-inbox-lead={lead.id}
      {...x('display:inline-block;margin-top:8px;font-size:12.5px;font-weight:600;color:#7a5c2c;text-decoration:none;border-bottom:1px solid #e2dbcf', {
        hover: 'color:#14202b;border-bottom-color:#14202b',
      })}
    >
      {t('inbox.openLead', { caseRef: isolate(lead.caseRef) })}
    </Link>
  );
}

const ROW = 'padding:14px 0;border-bottom:1px solid #f3eee6';
const HEAD = 'display:flex;align-items:flex-start;gap:10px 12px;flex-wrap:wrap';

function CallbackRow({ item }: { item: CallbackItem }) {
  const t = useTranslations('admin');
  const ago = useAgo();
  return (
    <div data-inbox-item={item.id} data-inbox-kind="callback" style={s(ROW)}>
      <div style={s(HEAD)}>
        <div style={s('flex:1;min-width:180px')}>
          <div style={s('display:flex;align-items:center;gap:8px;flex-wrap:wrap')}>
            <span style={s('font-size:14.5px;font-weight:600')}>{item.name?.trim() || t('inbox.unnamed')}</span>
            <StatusChip status={item.status} />
          </div>
          <a href={`tel:${item.phone.replace(/[^0-9+]/g, '')}`} {...x('display:inline-block;margin-top:4px;font-size:14.5px;color:#14202b;text-decoration:none', { hover: 'color:#7a5c2c' })}>
            <bdi>{item.phone}</bdi>
          </a>
        </div>
        <Actions kind="callback" id={item.id} status={item.status} />
      </div>
      <Meta
        parts={[
          t('inbox.received', { when: ago(item.createdAt) }),
          item.source ? t('inbox.source', { source: item.source }) : null,
          t('inbox.language', { language: t(item.locale === 'he' ? 'inbox.languageHe' : 'inbox.languageEn') }),
          item.handledByName ? t('inbox.handledBy', { name: item.handledByName }) : null,
        ]}
      />
      {item.lead && <LeadLinkChip lead={item.lead} />}
    </div>
  );
}

function ContactRow({ item }: { item: ContactItem }) {
  const t = useTranslations('admin');
  const ago = useAgo();
  const isolate = useIsolate();
  return (
    <div data-inbox-item={item.id} data-inbox-kind="contact" style={s(ROW)}>
      <div style={s(HEAD)}>
        <div style={s('flex:1;min-width:180px')}>
          <div style={s('display:flex;align-items:center;gap:8px;flex-wrap:wrap')}>
            <span style={s('font-size:14.5px;font-weight:600')}>{item.name}</span>
            <StatusChip status={item.status} />
            <span style={s('font-size:11px;font-weight:600;letter-spacing:0.04em;padding:2px 8px;background:var(--color-accent-100);color:var(--color-accent-800)')}>
              {t(`inbox.kind.${item.kind}`)}
            </span>
          </div>
          <div style={s('display:flex;gap:4px 16px;flex-wrap:wrap;margin-top:4px;font-size:14px')}>
            {item.email && (
              <a href={`mailto:${item.email}`} {...x('color:#14202b;text-decoration:none;overflow-wrap:anywhere', { hover: 'color:#7a5c2c' })}>
                <bdi>{item.email}</bdi>
              </a>
            )}
            {item.phone && (
              <a href={`tel:${item.phone.replace(/[^0-9+]/g, '')}`} {...x('color:#14202b;text-decoration:none', { hover: 'color:#7a5c2c' })}>
                <bdi>{item.phone}</bdi>
              </a>
            )}
          </div>
        </div>
        <Actions kind="contact" id={item.id} status={item.status} />
      </div>
      {(item.matter || item.note) && (
        <div style={s('margin-top:8px;font-size:14px;line-height:1.55;background:#f8f5f0;border:1px solid #efe8dc;border-radius:12px;padding:10px 12px')}>
          {item.matter && (
            <div style={s('font-size:12px;color:#9a948a')}>
              {t('inbox.matter')}: <span style={s('color:#14202b')}>{item.matter}</span>
            </div>
          )}
          {item.note && (
            <div dir="auto" style={s('white-space:pre-wrap;overflow-wrap:anywhere;text-align:start')}>
              {item.note}
            </div>
          )}
        </div>
      )}
      <Meta
        parts={[
          t('inbox.received', { when: ago(item.createdAt) }),
          item.page ? t('inbox.page', { page: isolate(item.page) }) : null,
          item.source ? t('inbox.source', { source: item.source }) : null,
          t('inbox.language', { language: t(item.locale === 'he' ? 'inbox.languageHe' : 'inbox.languageEn') }),
          item.handledByName ? t('inbox.handledBy', { name: item.handledByName }) : null,
        ]}
      />
      {item.lead && <LeadLinkChip lead={item.lead} />}
    </div>
  );
}
