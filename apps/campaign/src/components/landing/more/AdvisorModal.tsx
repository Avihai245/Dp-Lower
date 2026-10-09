'use client';
import { isPhone } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useLayoutEffect, useRef, useState, type Dispatch, type FormEvent, type RefObject, type SetStateAction } from 'react';
import { Turnstile } from '@/components/funnel/Turnstile';
import { api } from '@/lib/api';
import { useLandingUi } from '../ui-context';
import '../../../styles/landing-more.css';
import { useDialog } from './use-dialog';

/** How long the "request received" screen (the designed ring with a counting number) shows before the confirmation. */
const COUNTDOWN_SECONDS = 5;

type Stage = 'form' | 'received' | 'done';
type Problem = 'phone' | 'rate_limited' | 'failed' | null;
interface Fields {
  name: string;
  phone: string;
}

const KICKER = 'font-size:12px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#a07a3c';
const SERIF = "font-family:'Newsreader',Georgia,serif";
const LABEL = 'display:block;font-size:12.5px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#736d64;margin-bottom:7px';
const INPUT = "width:100%;padding:14px 15px;font-size:15.5px;font-family:'Manrope',system-ui,sans-serif;border:1px solid #ece6dc;background:#fff;border-radius:12px;box-sizing:border-box";

/**
 * The "Speak with an AI Advisor" modal: form -> "request received" (the designed 5 second ring) -> confirmation.
 *
 * There is no voice AI yet: a person from the firm calls the visitor back. The designed screens and visuals are kept,
 * but every sentence says what really happens (request received, a team member will call shortly), and the request is
 * stored through POST /api/callbacks the moment the form is submitted. Mounted by the page; renders nothing while closed.
 */
export function AdvisorModal() {
  const { advisorOpen, closeAdvisor, chatOpen } = useLandingUi();
  // what the visitor typed survives closing and reopening, like the prototype
  const [fields, setFields] = useState<Fields>({ name: '', phone: '' });
  const chatOpenRef = useRef(chatOpen);
  useLayoutEffect(() => {
    chatOpenRef.current = chatOpen;
  });
  if (!advisorOpen) return null;
  return <AdvisorDialog fields={fields} setFields={setFields} onClose={closeAdvisor} chatOpenRef={chatOpenRef} />;
}

function AdvisorDialog({
  fields,
  setFields,
  onClose,
  chatOpenRef,
}: {
  fields: Fields;
  setFields: Dispatch<SetStateAction<Fields>>;
  onClose: () => void;
  chatOpenRef: RefObject<boolean>;
}) {
  const t = useTranslations('landingMore.advisor');
  const locale = useLocale();
  const [stage, setStage] = useState<Stage>('form');
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const [problem, setProblem] = useState<Problem>(null);
  // the Turnstile token (only when a site key is configured; the server decides what a missing one means)
  const captcha = useRef<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const trapRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const refocusPhone = useRef(false);
  const uid = useId();
  const titleId = `${uid}-title`;
  const errorId = `${uid}-error`;

  useDialog(cardRef, {
    modal: true,
    onClose,
    initialFocus: () => nameRef.current,
    skipRestore: () => chatOpenRef.current,
  });

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // "request received" holds for COUNTDOWN_SECONDS, then settles on the confirmation
  useEffect(() => {
    if (stage !== 'received') return;
    let left = COUNTDOWN_SECONDS;
    const id = window.setInterval(() => {
      left -= 1;
      if (left <= 0) {
        window.clearInterval(id);
        setCount(0);
        setStage('done');
      } else {
        setCount(left);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [stage]);

  // the button that was pressed is replaced by the next stage: hand focus to the dialog (its title is announced)
  useEffect(() => {
    if (stage === 'form') {
      if (refocusPhone.current) {
        refocusPhone.current = false;
        phoneRef.current?.focus({ preventScroll: true });
      }
      return;
    }
    cardRef.current?.focus({ preventScroll: true });
  }, [stage]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!isPhone(fields.phone)) {
      setProblem('phone');
      phoneRef.current?.focus({ preventScroll: true });
      return;
    }
    setProblem(null);
    setBusy(true);
    const name = fields.name.trim();
    const honeypot = trapRef.current?.value ?? '';
    const res = await api('/api/callbacks', {
      body: {
        ...(name ? { name } : {}),
        phone: fields.phone.trim(),
        locale,
        source: 'landing-advisor',
        ...(honeypot ? { website: honeypot } : {}),
        ...(captcha.current ? { turnstileToken: captcha.current } : {}),
      },
    });
    if (!alive.current) return;
    setBusy(false);
    if (res.ok) {
      setCount(COUNTDOWN_SECONDS);
      setStage('received');
      return;
    }
    // a token is single use: ask for a fresh one before the next attempt
    setCaptchaReset((n) => n + 1);
    // 400 means the server did not accept the number (or the captcha); 429 the rate limit; anything else (including no network) is a failure to send
    setProblem(res.status === 429 || res.error === 'rate_limited' ? 'rate_limited' : res.error === 'captcha_failed' ? 'failed' : res.status === 400 ? 'phone' : 'failed');
  }

  function changeNumber() {
    refocusPhone.current = true;
    setProblem(null);
    setStage('form');
  }

  const problemText = problem === 'phone' ? t('phoneError') : problem === 'rate_limited' ? t('rateLimited') : problem === 'failed' ? t('failed') : '';

  return (
    <div
      data-advisor-overlay
      style={s('position:fixed;inset:0;z-index:60;background:rgba(20,32,43,0.55);display:grid;place-items:center;padding:20px;overflow-y:auto;overscroll-behavior:contain;animation:fadeIn 200ms ease both')}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-advisor-card
        data-lm-focus-target
        style={s("width:100%;max-width:460px;background:#f8f5f0;padding:38px 36px 34px;font-family:'Manrope',system-ui,sans-serif;position:relative;animation:riseIn 260ms cubic-bezier(0.2,0,0,1) both;margin:auto")}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          style={s('position:absolute;top:14px;right:16px;background:transparent;border:0;color:#736d64;font-size:22px;line-height:1;cursor:pointer')}
        >
          <span aria-hidden="true">×</span>
        </button>

        {stage === 'form' && (
          <form onSubmit={submit} noValidate>
            <div style={s(`${KICKER};margin-bottom:16px`)}>{t('kicker')}</div>
            <h3 id={titleId} style={s(`${SERIF};font-weight:400;font-size:32px;line-height:1.15;letter-spacing:normal;color:#14202b;margin:0 0 12px`)}>
              {t('title')}
            </h3>
            <p style={s('font-size:15.5px;line-height:1.65;color:#736d64;margin:0 0 26px')}>{t('body')}</p>
            <label htmlFor={`${uid}-name`} style={s(LABEL)}>
              {t('nameLabel')}
            </label>
            <input
              id={`${uid}-name`}
              ref={nameRef}
              name="name"
              autoComplete="name"
              maxLength={120}
              value={fields.name}
              onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('namePlaceholder')}
              style={s(`${INPUT};margin-bottom:18px`)}
            />
            <label htmlFor={`${uid}-phone`} style={s(LABEL)}>
              {t('phoneLabel')}
            </label>
            <input
              id={`${uid}-phone`}
              ref={phoneRef}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              maxLength={40}
              value={fields.phone}
              onChange={(e) => {
                setFields((f) => ({ ...f, phone: e.target.value }));
                setProblem(null);
              }}
              placeholder={t('phonePlaceholder')}
              aria-invalid={problem === 'phone' ? true : undefined}
              aria-describedby={problem ? errorId : undefined}
              style={s(INPUT)}
            />
            {problem && (
              <div id={errorId} role="alert" style={s('font-size:13px;color:#9a3b2e;margin-top:9px')}>
                {problemText}
              </div>
            )}
            <Turnstile onToken={(token) => (captcha.current = token)} resetKey={captchaReset} />
            <button
              type="submit"
              disabled={busy}
              className="btn lm-btn"
              style={s("width:100%;margin-top:24px;background:#14202b;color:#f8f5f0;font-family:'Manrope',system-ui,sans-serif;font-weight:600;font-size:15px;letter-spacing:0.06em;text-transform:uppercase;padding:19px;border-radius:12px")}
            >
              {busy ? t('sending') : t('submit')}
            </button>
            <p style={s('font-size:12.5px;line-height:1.6;color:#736d64;margin:14px 0 0')}>{t('fine')}</p>
            {/* honeypot: people never see or fill this */}
            <input
              ref={trapRef}
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={s('position:absolute;width:1px;height:1px;padding:0;margin:-1px;border:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;opacity:0')}
            />
          </form>
        )}

        {stage === 'received' && (
          <div style={s('text-align:center;padding:12px 0 4px')}>
            <div style={s(`${KICKER};margin-bottom:22px`)}>{t('receivedKicker')}</div>
            <div
              aria-hidden="true"
              style={s('width:132px;height:132px;margin:0 auto 26px;border-radius:50%;border:2px solid #ece6dc;display:grid;place-items:center;position:relative')}
            >
              <span style={s(`${SERIF};font-size:58px;line-height:1;color:#14202b`)}>{count}</span>
            </div>
            <h3 id={titleId} style={s(`${SERIF};font-weight:400;font-size:28px;line-height:1.2;letter-spacing:normal;color:#14202b;margin:0 0 10px`)}>
              {t('receivedTitle')}
            </h3>
            <p style={s('font-size:15.5px;line-height:1.65;color:#736d64;margin:0 0 24px')}>{t('receivedBody')}</p>
            <button
              type="button"
              onClick={onClose}
              style={s("background:transparent;border:0;color:#736d64;font-family:'Manrope',system-ui,sans-serif;font-size:13.5px;cursor:pointer;text-decoration:underline;text-underline-offset:3px")}
            >
              {t('receivedClose')}
            </button>
          </div>
        )}

        {stage === 'done' && (
          <div style={s('text-align:center;padding:12px 0 4px')}>
            <div
              aria-hidden="true"
              style={s('width:74px;height:74px;margin:0 auto 24px;border-radius:50%;background:#14202b;color:#f8f5f0;display:grid;place-items:center;font-size:30px')}
            >
              ☎
            </div>
            <div style={s(`${KICKER};margin-bottom:14px`)}>{t('doneKicker')}</div>
            <h3 id={titleId} style={s(`${SERIF};font-weight:400;font-size:28px;line-height:1.2;letter-spacing:normal;color:#14202b;margin:0 0 10px`)}>
              {t('doneTitle')}
            </h3>
            <p style={s(`${SERIF};font-size:24px;color:#14202b;margin:0 0 8px`)}>
              <bdi dir="ltr">{fields.phone.trim()}</bdi>
            </p>
            <p style={s('font-size:15px;line-height:1.65;color:#736d64;margin:0 0 26px')}>{t('doneBody')}</p>
            <button
              type="button"
              onClick={changeNumber}
              {...x(
                "background:transparent;color:#14202b;border:1px solid #14202b;font-family:'Manrope',system-ui,sans-serif;font-weight:600;font-size:13.5px;letter-spacing:0.06em;text-transform:uppercase;padding:16px 26px;border-radius:12px",
                { hover: 'background:#14202b;color:#f8f5f0', className: 'btn lm-btn' },
              )}
            >
              {t('doneRetry')}
            </button>
            <p style={s('font-size:13px;color:#736d64;margin:16px 0 0')}>{t('doneHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
