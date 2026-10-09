'use client';

import { s, x } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import {
  addExceptionAction,
  addRuleAction,
  deleteExceptionAction,
  deleteRuleAction,
  updateRuleAction,
} from '@/app/[locale]/(admin)/admin/actions';
import { Link } from '@/i18n/navigation';
import { useAdmin } from './AdminProvider';
import { formatCall, formatDate, weekdayName } from './format';
import { TIME_RE, trimRuleDraft, type RuleDraft } from './model';
import { settle } from './settle';
import type { ActionError, AvailabilityData, ExceptionView, RuleView } from './types';
import { CARD, HelpTip, PageFrame } from './ui';
import { useRun } from './useRun';

const INPUT =
  "padding:8px 10px;font-size:14px;font-family:'Manrope',system-ui,sans-serif;color:#14202b;border:1px solid #ddd5c8;background:#fff;border-radius:10px;box-sizing:border-box";
const FOCUS = 'border-color:#14202b;outline:none';
const SMALL =
  "background:#fff;color:#14202b;border:1px solid #e2dbcf;border-radius:999px;padding:6px 12px;font-family:'Manrope',system-ui,sans-serif;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap";
const DARK =
  "background:#14202b;color:#f8f5f0;border:1px solid #14202b;border-radius:999px;padding:7px 14px;font-family:'Manrope',system-ui,sans-serif;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap";
const H2 =
  "font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#7a5c2c;margin:0;font-family:'Manrope',system-ui,sans-serif;line-height:inherit";

const errorKey = (e: ActionError): string =>
  e === 'duplicate' ? 'duplicate' : e === 'invalid' ? 'invalid' : e === 'forbidden' ? 'forbidden' : 'generic';

/** /admin/availability: the weekly call template, blocked days and slots, and the next bookings. Admins edit; others read. */
export function AvailabilityView({ data, canEdit }: { data: AvailabilityData; canEdit: boolean }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const days = [0, 1, 2, 3, 4, 5, 6];

  return (
    <PageFrame title={t('availability.title')} lead={t('availability.timezone', { timezone: data.timezone, minutes: data.callMinutes })}>
      {!canEdit && (
        <p role="note" style={s('font-size:13.5px;color:#8a4b1f;margin:0 0 14px')}>
          {t('availability.readOnly')}
        </p>
      )}

      <section style={s('margin-bottom:14px')}>
        <div style={s('display:flex;align-items:center;gap:10px;margin-bottom:10px')}>
          <h2 style={s(H2)}>{t('availability.weekly')}</h2>
          <HelpTip id="weekly" align="left" />
        </div>
        <div data-weekly style={s('display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));gap:14px;align-items:start')}>
          {days.map((wd) => (
            <WeekdayCard key={wd} weekday={wd} title={weekdayName(wd, locale)} rules={data.rules.filter((r) => r.weekday === wd)} canEdit={canEdit} />
          ))}
        </div>
      </section>

      <div data-resp="2" style={s('display:grid;grid-template-columns:minmax(0, 1fr) minmax(0, 1fr);gap:14px;align-items:start')}>
        <BlockedCard exceptions={data.exceptions} canEdit={canEdit} />
        <UpcomingCard bookings={data.bookings} />
      </div>
    </PageFrame>
  );
}

// -- weekly template ---------------------------------------------------------------------------------------------------

function WeekdayCard({ weekday, title, rules, canEdit }: { weekday: number; title: string; rules: RuleView[]; canEdit: boolean }) {
  const t = useTranslations('admin');
  return (
    <div data-weekday={weekday} style={s(`${CARD};padding:18px 18px 16px`)}>
      <h3 style={s("font-size:13px;font-weight:700;letter-spacing:0.04em;margin:0 0 10px;font-family:'Manrope',system-ui,sans-serif;line-height:inherit")}>{title}</h3>
      {rules.length === 0 && <div style={s('font-size:13px;color:#9a948a;padding:4px 0 8px')}>{t('availability.noTimes')}</div>}
      {rules.map((r) => (
        <RuleRow key={r.id} rule={r} canEdit={canEdit} />
      ))}
      {canEdit && <AddRule weekday={weekday} />}
    </div>
  );
}

function RuleRow({ rule, canEdit }: { rule: RuleView; canEdit: boolean }) {
  const t = useTranslations('admin');
  const id = useId();
  const { pending, run } = useRun();
  const { fail } = useAdmin();
  // The row is not re-created when the stored rule changes (a save arriving, or another admin's edit): the stored values
  // show at once, and what is being typed into the other fields stays.
  const [typed, setTyped] = useState<RuleDraft>({});
  const draft = trimRuleDraft(typed, rule);
  const time = draft.time ?? rule.startTime;
  const capacity = draft.capacity ?? String(rule.capacity);
  const active = draft.active ?? rule.active;
  const dirty = Object.keys(draft).length > 0;
  const change = (patch: RuleDraft) => setTyped({ ...draft, ...patch });
  useEffect(() => {
    // fields that now equal the stored rule are no longer "typed"; a later change of the rule must show through
    setTyped((d) => {
      const kept = trimRuleDraft(d, rule);
      return Object.keys(kept).length === Object.keys(d).length ? d : kept;
    });
  }, [rule]);
  const [error, setError] = useState<string | null>(null);

  const timeOk = TIME_RE.test(time);
  const capOk = /^\d{1,2}$/.test(capacity) && Number(capacity) <= 50;

  const save = () => {
    if (!timeOk || !capOk) return setError(t('availability.errors.invalid'));
    setError(null);
    void (async () => {
      const res = await settle(() =>
        updateRuleAction({ id: rule.id, weekday: rule.weekday, startTime: time, capacity: Number(capacity), active }),
      );
      if (!res.ok) {
        if (res.error === 'unauthorized') fail(res.error);
        else setError(t(`availability.errors.${errorKey(res.error)}`));
      }
    })();
  };

  return (
    <div data-rule={rule.id} style={s('padding:8px 0;border-top:1px solid #f3eee6')}>
      <div style={s('display:flex;align-items:center;gap:8px;flex-wrap:wrap')}>
        <label htmlFor={`${id}-t`} className="adm-sr">
          {t('availability.time')}
        </label>
        <input
          id={`${id}-t`}
          dir="ltr"
          inputMode="numeric"
          placeholder="HH:MM"
          value={time}
          disabled={!canEdit}
          maxLength={5}
          aria-invalid={!timeOk}
          onChange={(e) => change({ time: e.target.value })}
          {...x(`${INPUT};width:84px;text-align:center`, { focus: FOCUS })}
        />
        <label htmlFor={`${id}-c`} className="adm-sr">
          {t('availability.capacity')}
        </label>
        <input
          id={`${id}-c`}
          dir="ltr"
          inputMode="numeric"
          title={t('availability.capacityHint')}
          value={capacity}
          disabled={!canEdit}
          maxLength={2}
          aria-invalid={!capOk}
          onChange={(e) => change({ capacity: e.target.value })}
          {...x(`${INPUT};width:54px;text-align:center`, { focus: FOCUS })}
        />
        <label style={s('display:inline-flex;align-items:center;gap:6px;font-size:13px;cursor:pointer')}>
          <input type="checkbox" checked={active} disabled={!canEdit} onChange={(e) => change({ active: e.target.checked })} />
          {t('availability.active')}
        </label>
        {canEdit && (
          <span style={s('margin-left:auto;display:flex;gap:6px')}>
            {dirty && (
              <button type="button" data-rule-save disabled={pending} onClick={save} {...x(DARK, { hover: 'background:#1e2f3f' })}>
                {t('availability.save')}
              </button>
            )}
            <button
              type="button"
              data-rule-delete
              disabled={pending}
              onClick={() => run(() => deleteRuleAction({ id: rule.id }))}
              aria-label={t('availability.delete')}
              {...x(SMALL, { hover: 'border-color:#a03a2c;color:#a03a2c' })}
            >
              {t('availability.delete')}
            </button>
          </span>
        )}
      </div>
      {error && (
        <div role="alert" style={s('font-size:12.5px;color:#a03a2c;margin-top:6px')}>
          {error}
        </div>
      )}
    </div>
  );
}

function AddRule({ weekday }: { weekday: number }) {
  const t = useTranslations('admin');
  const id = useId();
  const { fail } = useAdmin();
  const [time, setTime] = useState('');
  const [capacity, setCapacity] = useState('2');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!TIME_RE.test(time) || !/^\d{1,2}$/.test(capacity)) return setError(t('availability.errors.invalid'));
    setError(null);
    setBusy(true);
    const res = await settle(() => addRuleAction({ weekday, startTime: time, capacity: Number(capacity), active: true }));
    setBusy(false);
    if (!res.ok) {
      if (res.error === 'unauthorized') fail(res.error);
      else setError(t(`availability.errors.${errorKey(res.error)}`));
      return;
    }
    setTime('');
  };

  return (
    <div data-add-rule={weekday} style={s('padding-top:10px;border-top:1px solid #f3eee6;margin-top:2px')}>
      <div style={s('display:flex;align-items:center;gap:8px;flex-wrap:wrap')}>
        <label htmlFor={`${id}-t`} className="adm-sr">
          {t('availability.time')}
        </label>
        <input
          id={`${id}-t`}
          dir="ltr"
          inputMode="numeric"
          placeholder="HH:MM"
          maxLength={5}
          value={time}
          onChange={(e) => setTime(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
          {...x(`${INPUT};width:84px;text-align:center`, { focus: FOCUS })}
        />
        <label htmlFor={`${id}-c`} className="adm-sr">
          {t('availability.capacity')}
        </label>
        <input
          id={`${id}-c`}
          dir="ltr"
          inputMode="numeric"
          title={t('availability.capacityHint')}
          maxLength={2}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          {...x(`${INPUT};width:54px;text-align:center`, { focus: FOCUS })}
        />
        <button type="button" data-rule-add disabled={busy} onClick={() => void add()} {...x(`${SMALL};margin-left:auto`, { hover: 'border-color:#14202b' })}>
          {t('availability.add')}
        </button>
      </div>
      {error && (
        <div role="alert" style={s('font-size:12.5px;color:#a03a2c;margin-top:6px')}>
          {error}
        </div>
      )}
    </div>
  );
}

// -- blocked days and slots -----------------------------------------------------------------------------------------------

function BlockedCard({ exceptions, canEdit }: { exceptions: ExceptionView[]; canEdit: boolean }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const id = useId();
  const { fail } = useAdmin();
  const { pending, run } = useRun();
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const block = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (slot !== '' && !TIME_RE.test(slot))) return setError(t('availability.errors.invalid'));
    setError(null);
    setBusy(true);
    const res = await settle(() =>
      addExceptionAction({ onDate: date, startTime: slot === '' ? null : slot, reason: reason.trim() || undefined }),
    );
    setBusy(false);
    if (!res.ok) {
      if (res.error === 'unauthorized') fail(res.error);
      else setError(t(`availability.errors.${errorKey(res.error)}`));
      return;
    }
    setDate('');
    setSlot('');
    setReason('');
  };

  return (
    <section data-blocked style={s(CARD)}>
      <div style={s('display:flex;align-items:center;gap:10px;margin-bottom:10px')}>
        <h2 style={s(H2)}>{t('availability.blocked')}</h2>
        <span style={s('margin-left:auto')}>
          <HelpTip id="blocked" />
        </span>
      </div>
      {exceptions.length === 0 && <div style={s('font-size:13.5px;color:#9a948a;padding:6px 0')}>{t('availability.noBlocked')}</div>}
      {exceptions.map((e) => (
        <div key={e.id} data-exception={e.id} style={s('display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid #f3eee6;flex-wrap:wrap')}>
          <span style={s('font-size:14px;font-weight:600')}>{formatDate(e.onDate, locale)}</span>
          <span style={s('font-size:13px;color:#736d64')}>{e.startTime ? <bdi>{e.startTime}</bdi> : t('availability.wholeDay')}</span>
          {e.reason && <span style={s('font-size:13px;color:#9a948a;overflow-wrap:anywhere')}>{e.reason}</span>}
          {canEdit && (
            <button
              type="button"
              data-exception-delete
              disabled={pending}
              onClick={() => run(() => deleteExceptionAction({ id: e.id }))}
              {...x(`${SMALL};margin-left:auto`, { hover: 'border-color:#14202b' })}
            >
              {t('availability.unblock')}
            </button>
          )}
        </div>
      ))}
      {canEdit && (
        <div data-add-exception style={s('border-top:1px solid #f3eee6;margin-top:6px;padding-top:12px;display:flex;flex-direction:column;gap:8px')}>
          <div style={s('display:flex;gap:8px;flex-wrap:wrap')}>
            <div>
              <label htmlFor={`${id}-d`} style={s('display:block;font-size:12px;color:#736d64;margin-bottom:4px')}>
                {t('availability.date')}
              </label>
              <input id={`${id}-d`} type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} {...x(`${INPUT};width:160px`, { focus: FOCUS })} />
            </div>
            <div style={s('flex:1;min-width:150px')}>
              <label htmlFor={`${id}-s`} style={s('display:block;font-size:12px;color:#736d64;margin-bottom:4px')}>
                {t('availability.slot')}
              </label>
              <input
                id={`${id}-s`}
                dir="ltr"
                inputMode="numeric"
                placeholder="HH:MM"
                maxLength={5}
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                {...x(`${INPUT};width:100%`, { focus: FOCUS })}
              />
            </div>
          </div>
          <div style={s('display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap')}>
            <div style={s('flex:1;min-width:180px')}>
              <label htmlFor={`${id}-r`} style={s('display:block;font-size:12px;color:#736d64;margin-bottom:4px')}>
                {t('availability.reason')}
              </label>
              <input id={`${id}-r`} dir="auto" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} {...x(`${INPUT};width:100%`, { focus: FOCUS })} />
            </div>
            <button type="button" data-exception-add disabled={busy} onClick={() => void block()} {...x(DARK, { hover: 'background:#1e2f3f' })}>
              {t('availability.block')}
            </button>
          </div>
          {error && (
            <div role="alert" style={s('font-size:12.5px;color:#a03a2c')}>
              {error}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// -- upcoming bookings ---------------------------------------------------------------------------------------------------

function UpcomingCard({ bookings }: { bookings: AvailabilityData['bookings'] }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const { listQuery } = useAdmin();
  return (
    <section data-bookings style={s(CARD)}>
      <h2 style={s(`${H2};margin-bottom:10px`)}>{t('availability.upcoming')}</h2>
      {bookings.length === 0 && <div style={s('font-size:13.5px;color:#9a948a;padding:6px 0')}>{t('availability.noBookings')}</div>}
      {bookings.map((b) => (
        <div key={b.id} data-booking={b.id} style={s('display:flex;align-items:center;gap:6px 14px;padding:10px 0;border-top:1px solid #f3eee6;flex-wrap:wrap')}>
          <span style={s('font-size:14px;font-weight:600;white-space:nowrap')}>{formatCall(b.startsAt, locale)}</span>
          {b.lead ? (
            <Link href={`/admin/leads/${b.lead.id}${listQuery}`} {...x('font-size:14px;color:#14202b;text-decoration:none;border-bottom:1px solid #e2dbcf', { hover: 'color:#7a5c2c' })}>
              {t('availability.callWith', { name: b.lead.name })} <span style={s('color:#9a948a')}>
                <bdi>{b.lead.caseRef}</bdi>
              </span>
            </Link>
          ) : null}
          {b.lead?.phone && (
            <a href={`tel:${b.lead.phone.replace(/[^0-9+]/g, '')}`} {...x('font-size:13px;color:#736d64;text-decoration:none;margin-left:auto', { hover: 'color:#7a5c2c' })}>
              <bdi>{b.lead.phone}</bdi>
            </a>
          )}
        </div>
      ))}
    </section>
  );
}
