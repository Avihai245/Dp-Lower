'use client';
import { FIRM_TIMEZONE, isValidTimeZone, type Locale } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { AvailabilityResponse, BookingSummary, LeadSummary } from './logic/api-types';
import { dayLabel, showSeatsLine, slotLabel, visitorTimeZone, whenLabel } from './logic/booking-format';
import { confettiStyles } from './logic/confetti';
import { H1_STYLE, LEDE_STYLE, LINK_BUTTON, Page, PRIMARY_BUTTON, SANS, StepHeader } from './ui';

type Notice = 'taken' | 'failed' | 'rateLimited' | 'network' | null;

const CONFETTI = confettiStyles();

/**
 * "Choose a time for your free call": five bookable days from the firm's real calendar, the free slots of the chosen
 * day in the visitor's own time zone, then a confirmation with confetti. Skipping goes straight to the result.
 */
export function BookingPicker() {
  const t = useTranslations('funnel');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [lead, setLead] = useState<LeadSummary | null>(null);
  // the screen waits for the lead (name, an existing booking) so it never flashes the wrong state
  const [checked, setChecked] = useState(false);
  const [avail, setAvail] = useState<AvailabilityResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [dayIdx, setDayIdx] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [view, setView] = useState<'pick' | 'done'>('pick');
  const [celebrate, setCelebrate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [tz, setTz] = useState(FIRM_TIMEZONE);

  const loadAvailability = useCallback(async () => {
    const res = await api<AvailabilityResponse>('/api/availability');
    if (res.ok && res.data) {
      setAvail(res.data);
      setLoadFailed(false);
    } else {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    setTz(visitorTimeZone());
    let cancelled = false;
    void (async () => {
      const [me] = await Promise.all([api<LeadSummary>('/api/lead'), loadAvailability()]);
      if (cancelled) return;
      if (me.status === 401) {
        // no details yet, so nobody to book for
        router.replace('/details');
        return;
      }
      if (me.ok && me.data) {
        setLead(me.data);
        if (me.data.booking) {
          setBooking(me.data.booking);
          setView('done');
        }
      }
      setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAvailability, router]);

  const days = avail?.days ?? [];
  const day = days[Math.min(dayIdx, Math.max(days.length - 1, 0))];
  const selected = day?.slots.find((sl) => sl.startsAt === slot) ?? null;
  const firstName = lead?.firstName ?? '';
  const minutes = avail?.callMinutes ?? 20;

  async function confirm() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setNotice(null);
    const res = await api<{ booking: BookingSummary }>('/api/bookings', { body: { startsAt: selected.startsAt, timezone: tz } });
    setSubmitting(false);
    if (res.ok && res.data) {
      setBooking(res.data.booking);
      setView('done');
      setCelebrate(true);
      window.scrollTo({ top: 0 });
    } else if (res.status === 409) {
      // somebody took the last seat while this page was open: say so and show what is still free
      setNotice('taken');
      setSlot(null);
      await loadAvailability();
    } else if (res.status === 401) {
      router.replace('/details');
    } else {
      setNotice(res.error === 'rate_limited' ? 'rateLimited' : res.error === 'network' ? 'network' : 'failed');
    }
  }

  function changeTime() {
    setView('pick');
    setSlot(null);
    setNotice(null);
    setCelebrate(false);
    void loadAvailability();
  }

  const labels = { answers: t('steps.answers'), details: t('steps.details'), call: t('steps.call'), result: t('steps.result') };
  const seatsLine = avail && showSeatsLine(avail.seatsLeft) ? t('booking.seatsLeft', { count: avail.seatsLeft }) : null;
  const bookedWhen = useMemo(() => {
    if (!booking) return null;
    const zone = booking.timezone && isValidTimeZone(booking.timezone) ? booking.timezone : tz;
    return whenLabel(booking.startsAt, zone, locale);
  }, [booking, tz, locale]);

  return (
    <Page>
      <StepHeader current="call" logoAlt={t('brand.logoAlt')} labels={labels} ariaLabel={t('steps.label')} />
      <div data-pad style={s('flex: 1; display: flex; justify-content: center; padding: clamp(40px, 7vh, 84px) 20px 72px')}>
        <div data-fx-anim style={s(`width: 100%; max-width: 560px; animation: ${checked ? 'qIn 340ms cubic-bezier(0.2,0,0,1) both' : 'none'}; visibility: ${checked ? 'visible' : 'hidden'}`)}>
          {view === 'pick' && (
            <>
              <h1 data-h1 style={s(H1_STYLE)}>{firstName ? t('booking.headlineNamed', { name: firstName }) : t('booking.headline')}</h1>
              <p style={s(`${LEDE_STYLE}; margin-bottom: ${seatsLine ? 18 : 32}px`)}>{t('booking.opener', { minutes })}</p>
              {seatsLine && (
                <div style={s('display: flex; align-items: center; gap: 8px; margin-bottom: 32px; font-size: 14px; font-weight: 600; color: #7a5c2c')}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a07a3c" strokeWidth="1.7" style={s('flex: none')} aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  <span>{seatsLine}</span>
                </div>
              )}
              {notice && (
                <p role="alert" style={s('font-size: 14.5px; line-height: 1.55; color: #a03a2c; margin: 0 0 22px')}>
                  {t(`booking.notice.${notice}`)}
                </p>
              )}

              {loadFailed && !avail ? (
                <div role="alert" style={s('border: 1px solid #ece6dc; background: #fff; border-radius: 12px; padding: 18px 20px; margin-bottom: 28px')}>
                  <p style={s('margin: 0 0 8px; font-size: 14.5px; line-height: 1.55; color: #14202b')}>{t('booking.loadError')}</p>
                  <button type="button" onClick={() => void loadAvailability()} {...x(LINK_BUTTON, { hover: 'color: #14202b' })}>
                    {t('booking.retry')}
                  </button>
                </div>
              ) : !avail ? (
                <div aria-busy="true" aria-label={t('booking.loading')}>
                  <div style={s('display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 26px')}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i} data-skeleton style={s('display: block; width: 74px; height: 84px; background: #fff; border: 1px solid #ece6dc; border-radius: 12px')} />
                    ))}
                  </div>
                </div>
              ) : days.length === 0 ? (
                <p style={s('font-size: 15px; line-height: 1.6; color: #5f5a52; margin: 0 0 28px')}>{t('booking.none')}</p>
              ) : (
                <>
                  <div id="book-day" style={s('display: block; font-size: 14px; font-weight: 600; color: #14202b; margin-bottom: 8px')}>{t('booking.chooseDay')}</div>
                  <div role="group" aria-labelledby="book-day" style={s('display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 26px')}>
                    {days.map((d, i) => {
                      const on = d === day;
                      const label = dayLabel(d.date, locale);
                      return (
                        <button
                          key={d.date}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            setDayIdx(i);
                            setSlot(null);
                          }}
                          style={s(
                            `background: ${on ? '#14202b' : '#fff'}; color: ${on ? '#f8f5f0' : '#14202b'}; border: 1px solid ${on ? '#14202b' : '#ece6dc'}; padding: 12px 16px; min-width: 74px; text-align: center; cursor: pointer; border-radius: 12px; ${SANS}; transition: background 160ms ease, border-color 160ms ease`,
                          )}
                        >
                          <span style={s('display: block; font-size: 11.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.7')}>{label.dow}</span>
                          <span style={s("display: block; font-family: 'Newsreader', Georgia, serif; font-size: 24px; line-height: 1.1; margin-top: 3px")}>{label.day}</span>
                          <span style={s('display: block; font-size: 11.5px; opacity: 0.7')}>{label.mon}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div id="book-time" style={s('display: block; font-size: 14px; font-weight: 600; color: #14202b; margin-bottom: 8px')}>{t('booking.chooseTime')}</div>
                  <div data-slots role="group" aria-labelledby="book-time" style={s('display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 30px')}>
                    {day?.slots.map((sl) => {
                      const on = sl.startsAt === slot;
                      return (
                        <button
                          key={sl.startsAt}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setSlot(sl.startsAt)}
                          style={s(
                            `padding: 15px 10px; ${SANS}; font-size: 15px; border-radius: 12px; cursor: pointer; background: ${on ? '#14202b' : '#fff'}; color: ${on ? '#f8f5f0' : '#14202b'}; border: 1px solid ${on ? '#14202b' : '#ece6dc'}; transition: background 160ms ease, border-color 160ms ease`,
                          )}
                        >
                          <bdi>{slotLabel(sl.startsAt, day.date, tz, locale)}</bdi>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <button
                type="button"
                className="btn"
                disabled={!selected || submitting}
                aria-busy={submitting}
                onClick={() => void confirm()}
                style={s(
                  `width: 100%; border: 1px solid #14202b; cursor: pointer; background: #14202b; color: #f8f5f0; ${SANS}; font-weight: 600; padding: 19px; font-size: 15.5px; letter-spacing: 0.06em; text-transform: uppercase; border-radius: 12px; opacity: ${selected ? (submitting ? 0.6 : 1) : 0.35}`,
                )}
              >
                {selected && day ? t('booking.bookFor', { time: slotLabel(selected.startsAt, day.date, tz, locale) }) : t('booking.chooseAbove')}
              </button>
              <div style={s('display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 16px')}>
                <button type="button" onClick={() => router.push('/offer')} {...x(LINK_BUTTON, { hover: 'color: #14202b' })}>
                  {t('booking.skip')}
                </button>
                <span style={s('font-size: 13px; color: #9a948a')}>{t('booking.timeZone', { timezone: tz })}</span>
              </div>
            </>
          )}

          {view === 'done' && booking && bookedWhen && (
            <>
              {celebrate && (
                <div data-confetti aria-hidden="true" style={s('position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 60')}>
                  {CONFETTI.map((css, i) => (
                    <i key={i} style={s(css)} />
                  ))}
                </div>
              )}
              <div data-fx-anim style={s('width: 52px; height: 52px; border-radius: 50%; background: #a07a3c; display: grid; place-items: center; color: #f8f5f0; font-size: 24px; line-height: 1; margin-bottom: 24px; animation: markIn 420ms ease both')}>
                <span aria-hidden="true">✓</span>
              </div>
              <h1 data-h1 style={s(H1_STYLE)}>{t('booking.done.title')}</h1>
              <div role="status" style={s('border: 1px solid #ece6dc; background: #fff; border-radius: 18px; padding: 24px 26px; margin: 22px 0 18px')}>
                <div style={s("font-family: 'Newsreader', Georgia, serif; font-size: 28px; line-height: 1.15; margin-bottom: 8px")}>
                  <bdi>{t('booking.done.when', { date: bookedWhen.date, time: bookedWhen.time })}</bdi>
                </div>
                <div style={s('font-size: 15px; color: #5f5a52; line-height: 1.6')}>
                  {lead?.phone
                    ? t.rich('booking.done.callTo', { phone: lead.phone, name: firstName, num: (c) => <bdi dir="ltr">{c}</bdi> })
                    : t('booking.done.callToNumber')}{' '}
                  {t('booking.done.length', { minutes: Math.round((Date.parse(booking.endsAt) - Date.parse(booking.startsAt)) / 60_000) || minutes })}
                </div>
              </div>
              <p style={s('font-size: 14.5px; line-height: 1.6; color: #736d64; margin: 0 0 30px')}>
                {lead ? t.rich('booking.done.confirm', { name: firstName, email: lead.email, bdi: (c) => <bdi dir="ltr">{c}</bdi> }) : ''}
              </p>
              <button type="button" onClick={() => router.push('/offer')} {...x(PRIMARY_BUTTON, { hover: 'background: #1e2f3f', className: 'btn' })}>
                {t('booking.seeResult')}
              </button>
              <div style={s('display: flex; justify-content: center; margin-top: 14px')}>
                <button type="button" onClick={changeTime} {...x(LINK_BUTTON, { hover: 'color: #14202b' })}>
                  {t('booking.done.change')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Page>
  );
}
