'use client';
import { quizOptions } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useLayoutEffect, useReducer, useRef, type Dispatch, type RefObject } from 'react';
import { Link } from '@/i18n/navigation';
import { clearQuizFrom, setQuizAnswer, useQuizAnswers } from '@/lib/quiz-store';
import { useLandingUi } from '../ui-context';
import '../../../styles/landing-more.css';
import {
  chatReducer,
  chatView,
  INITIAL_CHAT,
  previousQuestion,
  TYPING_MS,
  type ChatAction,
  type ChatState,
} from './chat-logic';
import { useDialog } from './use-dialog';

const SANS = "font-family:'Manrope',system-ui,sans-serif";
const SERIF = "font-family:'Newsreader',Georgia,serif";

const BOT = 'color:#14202b;background:#ece6dc;max-width:88%';
const ME = 'color:#f8f5f0;background:#14202b;width:fit-content';
const DARK_BTN = `text-align:left;cursor:pointer;${SANS};font-weight:600;font-size:15px;color:#f8f5f0;background:#14202b;border:1px solid #14202b;border-radius:12px;padding:14px 16px`;
const LIGHT_BTN = `text-align:left;cursor:pointer;${SANS};font-size:15px;color:#14202b;background:transparent;border:1px solid #ece6dc;border-radius:12px;padding:14px 16px`;

/** The floating "Prefer a conversation?" launcher and the scripted eligibility chat it opens. */
export function ChatWidget() {
  const t = useTranslations('landingMore.chat');
  const { chatOpen, openChat, closeChat, advisorOpen } = useLandingUi();
  const [state, dispatch] = useReducer(chatReducer, INITIAL_CHAT);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const advisorOpenRef = useRef(advisorOpen);
  useLayoutEffect(() => {
    advisorOpenRef.current = advisorOpen;
  });

  // the typing indicator keeps running while the panel is closed, as in the prototype
  useEffect(() => {
    if (!state.typing) return;
    const id = window.setTimeout(() => dispatch({ type: 'typed' }), TYPING_MS[state.typing]);
    return () => window.clearTimeout(id);
  }, [state.typing]);

  return (
    <>
      {!chatOpen && (
        <button
          ref={launcherRef}
          type="button"
          data-chat-launcher
          aria-haspopup="dialog"
          onClick={openChat}
          {...x(
            `position:fixed;right:26px;bottom:26px;z-index:45;display:flex;align-items:center;gap:14px;background:#f8f5f0;color:#14202b;border:1px solid #ece6dc;border-radius:12px;padding:16px 22px;cursor:pointer;text-align:left;box-shadow:0 16px 40px rgba(20,32,43,0.14);${SANS};transition:transform 220ms ease`,
            { hover: 'transform:translateY(-2px)' },
          )}
        >
          <span
            aria-hidden="true"
            style={s(`width:40px;height:40px;border-radius:50%;background:#14202b;color:#f8f5f0;display:grid;place-items:center;${SERIF};font-size:19px;flex:none`)}
          >
            DP
          </span>
          <span>
            <span style={s(`display:block;${SERIF};font-size:17px;line-height:1.2;color:#14202b`)}>{t('launcherTitle')}</span>
            <span style={s('display:block;font-size:13px;color:#736d64;margin-top:3px')}>{t('launcherSub')}</span>
          </span>
        </button>
      )}
      {chatOpen && (
        <ChatPanel
          state={state}
          dispatch={dispatch}
          onClose={closeChat}
          launcherRef={launcherRef}
          advisorOpenRef={advisorOpenRef}
        />
      )}
    </>
  );
}

function ChatPanel({
  state,
  dispatch,
  onClose,
  launcherRef,
  advisorOpenRef,
}: {
  state: ChatState;
  dispatch: Dispatch<ChatAction>;
  onClose: () => void;
  launcherRef: RefObject<HTMLButtonElement | null>;
  advisorOpenRef: RefObject<boolean>;
}) {
  const t = useTranslations('landingMore.chat');
  const tq = useTranslations('funnel.quiz.questions');
  const answers = useQuizAnswers();
  const view = chatView(state, answers);
  const panelRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useDialog(panelRef, {
    modal: false,
    onClose,
    initialFocus: () => panelRef.current,
    fallbackFocus: () => launcherRef.current,
    skipRestore: () => advisorOpenRef.current,
  });

  // keep the newest message in view
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [view.phase, view.index, view.typing, view.showAbout]);

  // the button that was pressed disappears with the step; park focus on the log so keyboard users do not lose their place
  const keepFocus = () => logRef.current?.focus({ preventScroll: true });
  const go = (action: ChatAction) => {
    keepFocus();
    dispatch(action);
  };

  const statusLine =
    view.status === 'idle'
      ? t('statusIdle')
      : view.status === 'question'
        ? t('statusQuestion', { n: view.index + 1, total: view.total })
        : t('statusDone');

  const back = previousQuestion(view.index);
  const current = view.current;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={t('panelLabel')}
      tabIndex={-1}
      data-chat-panel
      data-lm-focus-target
      style={s(
        `position:fixed;right:0;bottom:0;z-index:46;width:424px;max-width:100vw;height:min(86vh,780px);background:#f8f5f0;border-left:1px solid #ece6dc;border-top:1px solid #ece6dc;display:flex;flex-direction:column;${SANS};animation:chatIn 280ms cubic-bezier(0.2,0,0,1) both`,
      )}
    >
      <div data-chat-head style={s('display:flex;align-items:center;gap:12px;padding:18px 20px;background:#14202b;color:#f8f5f0')}>
        <span
          aria-hidden="true"
          style={s(`width:34px;height:34px;border-radius:50%;background:rgba(248,245,240,0.14);display:grid;place-items:center;${SERIF};font-size:16px;flex:none`)}
        >
          DP
        </span>
        <span style={s('flex:1')}>
          <span style={s('display:block;font-size:15px;font-weight:600')}>{t('name')}</span>
          <span style={s('display:flex;align-items:center;gap:7px;font-size:12.5px;opacity:0.7;margin-top:2px')}>
            <i aria-hidden="true" style={s('width:7px;height:7px;border-radius:50%;background:#6f9a7c;display:block')} />
            {statusLine}
          </span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          {...x('background:transparent;border:0;color:#f8f5f0;opacity:0.7;cursor:pointer;font-size:20px;line-height:1;padding:4px 6px', {
            hover: 'opacity:1',
          })}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {view.phase === 'asking' && (
        <div
          role="progressbar"
          aria-label={t('progress')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={view.pct}
          style={s('height:2px;background:rgba(20,32,43,0.1)')}
        >
          <span style={s(`display:block;height:2px;background:#a07a3c;width:${view.pct}%;transition:width 400ms ease`)} />
        </div>
      )}

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        tabIndex={-1}
        data-chat-log
        data-lm-focus-target
        style={s('padding:20px;overflow-y:auto;display:flex;flex-direction:column;gap:14px;flex:1')}
      >
        {view.showIntro && (
          <>
            <div style={s(`font-size:14.5px;line-height:1.6;${BOT};padding:12px 15px;border-radius:2px 12px 12px 12px`)}>{t('intro1')}</div>
            <div style={s(`font-size:14.5px;line-height:1.6;${BOT};padding:12px 15px;border-radius:12px`)}>{t('intro2')}</div>
            <div style={s('font-size:13px;line-height:1.55;color:#736d64;max-width:88%')}>{t('intro3')}</div>
          </>
        )}

        {view.showAbout && (
          <>
            <div style={s(`font-size:14.5px;${ME};padding:11px 15px;border-radius:12px 2px 12px 12px;margin:0 0 0 auto;max-width:86%`)}>
              {t('about')}
            </div>
            <div style={s(`font-size:14.5px;line-height:1.6;${BOT};padding:12px 15px;border-radius:12px`)}>{t('aboutAnswer')}</div>
          </>
        )}

        {view.typing && (
          <div data-typing aria-hidden="true" style={s('display:flex;gap:5px;background:#ece6dc;padding:14px 16px;border-radius:12px;width:fit-content')}>
            {[0, 0.15, 0.3].map((delay) => (
              <i
                key={delay}
                style={s(`width:6px;height:6px;border-radius:50%;background:#a07a3c;display:block;animation:typingDot 1.1s ease-in-out ${delay}s infinite`)}
              />
            ))}
          </div>
        )}

        {view.showStart && (
          <div style={s('display:flex;flex-direction:column;gap:8px;margin-top:4px')}>
            <button type="button" onClick={() => go({ type: 'ask' })} style={s(DARK_BTN)}>
              {t('start')}
            </button>
            <button type="button" onClick={() => go({ type: 'about' })} {...x(LIGHT_BTN, { hover: 'border-color:#14202b' })}>
              {t('about')}
            </button>
          </div>
        )}

        {view.showStartOnly && (
          <button type="button" onClick={() => go({ type: 'ask' })} style={s(`${DARK_BTN};margin-top:4px`)}>
            {t('startOnly')}
          </button>
        )}

        {view.phase === 'asking' &&
          view.history.map((id) => (
            <div key={id}>
              <div style={s(`font-size:14px;line-height:1.55;${BOT};padding:11px 15px;border-radius:12px`)}>{tq(`${id}.text`)}</div>
              <div style={s(`font-size:14px;${ME};padding:11px 15px;border-radius:12px 2px 12px 12px;margin:8px 0 0 auto;max-width:86%`)}>
                {tq(`${id}.options.${answers[id]}`)}
              </div>
            </div>
          ))}

        {view.asking && current && (
          <>
            <div>
              <div
                style={s(`${SERIF};font-size:19px;line-height:1.35;color:#14202b;background:#ece6dc;padding:14px 16px;border-radius:12px`)}
              >
                {tq(`${current}.text`)}
              </div>
              <div style={s('font-size:13px;color:#736d64;margin:8px 0 0 2px')}>{tq(`${current}.help`)}</div>
            </div>
            <div style={s('display:flex;flex-direction:column;gap:8px')}>
              {quizOptions(current).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    keepFocus();
                    setQuizAnswer(current, option);
                  }}
                  {...x(`${LIGHT_BTN};transition:border-color 180ms ease, background 180ms ease`, {
                    hover: 'border-color:#14202b;background:rgba(20,32,43,0.04)',
                  })}
                >
                  {tq(`${current}.options.${option}`)}
                </button>
              ))}
            </div>
          </>
        )}

        {view.finished && (
          <>
            <div style={s(`${SERIF};font-size:20px;line-height:1.35;color:#14202b`)}>{t('finished')}</div>
            <Link
              href="/details"
              {...x(
                `${SANS};background:#14202b;color:#f8f5f0;font-weight:600;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;padding:17px;border-radius:12px;width:100%`,
                { className: 'btn lm-btn' },
              )}
            >
              {t('seeResult')}
            </Link>
          </>
        )}
      </div>

      <div style={s('display:flex;align-items:center;gap:12px;padding:14px 20px;border-top:1px solid #ece6dc')}>
        <button
          type="button"
          onClick={() => {
            if (!back) return;
            keepFocus();
            clearQuizFrom(back);
          }}
          style={s(`background:transparent;border:0;color:#736d64;${SANS};font-size:13px;cursor:pointer;visibility:${view.canGoBack ? 'visible' : 'hidden'}`)}
        >
          <span aria-hidden="true" style={s('display:inline-block;transform:scaleX(var(--dir, 1))')}>
            ←
          </span>{' '}
          {t('back')}
        </button>
        {/* a link now, but sized like the prototype's <button> (its default padding and line-height) so nothing moves */}
        <Link
          href="/eligibility"
          style={s(`background:transparent;border:0;color:#736d64;${SANS};font-size:13px;line-height:normal;padding:1px 6px;cursor:pointer;margin-left:auto;text-decoration:underline;text-underline-offset:3px`)}
        >
          {t('continueForm')}
        </Link>
      </div>
    </div>
  );
}
