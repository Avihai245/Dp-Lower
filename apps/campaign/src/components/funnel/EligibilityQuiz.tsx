'use client';
import { QUIZ, QUIZ_ORDER, type QuizAnswers, type QuizId } from '@dpl/core';
import { s, x } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { getQuizAnswers, seedQuizAnswers, setQuizAnswer, useQuizAnswers } from '@/lib/quiz-store';
import { ADVANCE_MS, LAST_INDEX, QUESTION_COUNT, canSeeResult, nudgeFor, progressPercent, questionsLeft, startIndex } from './logic/quiz-flow';
import { SANS, Logo, Page } from './ui';
import { useLeaveToSite } from './use-leave-to-site';

const setAnswer = setQuizAnswer as (id: QuizId, value: string) => void;

/**
 * The six eligibility questions, one to a screen (docs: prototype stage "eligibility"). A pick is shown for a beat and
 * the next question slides in on its own; only the last question has a button ("See my result"). Answers live in
 * the quiz store (localStorage), which the landing-page chat shares, so the quiz resumes where the chat stopped. For a
 * visitor who already has a lead (`savedAnswers`: the answers on the file, null for nobody) it resumes from the file, and
 * every answer is also saved to it.
 */
export function EligibilityQuiz({ savedAnswers = null }: { savedAnswers?: QuizAnswers | null }) {
  const t = useTranslations('funnel');
  const router = useRouter();
  const leaveToSite = useLeaveToSite();
  const answers = useQuizAnswers();
  const [qi, setQi] = useState(0);
  const [ready, setReady] = useState(false);
  const qiRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const title = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (savedAnswers) seedQuizAnswers(savedAnswers);
    const at = startIndex(getQuizAnswers());
    qiRef.current = at;
    setQi(at);
    setReady(true);
    return () => clearTimeout(timer.current);
    // seeded once, when the page opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    qiRef.current = qi;
    // after an answer the heading takes focus so a screen reader announces the next question
    if (moved.current) title.current?.focus();
  }, [qi]);

  const id = QUIZ_ORDER[qi]!;
  const picked = answers[id];
  const nudge = nudgeFor(qi, answers);
  const options = QUIZ[id] as readonly string[];

  function pick(value: string) {
    setAnswer(id, value);
    // a lead exists: the file follows the answers (the details form would send them too, but not if the visitor stops here)
    if (savedAnswers) void api('/api/lead/answers', { method: 'PUT', body: { answers: { [id]: value } } });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      moved.current = true;
      if (qiRef.current === LAST_INDEX) router.push('/details');
      else setQi((i) => i + 1);
    }, ADVANCE_MS);
  }

  function previous() {
    clearTimeout(timer.current);
    if (qi === 0) leaveToSite();
    else {
      moved.current = true;
      setQi(qi - 1);
    }
  }

  const label = t('quiz.label', { n: qi + 1, total: QUESTION_COUNT });

  return (
    <Page>
      <div data-pad style={s('max-width: 100%; width: 100%; margin: 0 auto; padding: 22px clamp(20px, 4.6vw, 160px); display: flex; align-items: center; gap: 24px')}>
        <Logo alt={t('brand.logoAlt')} height={34} />
        <div style={s('margin-left: auto; font-size: 13px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #736d64')}>
          {t('quiz.header', { label })}
        </div>
      </div>
      <div
        role="progressbar"
        aria-label={t('quiz.progress')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent(qi, answers)}
        style={s('height: 2px; background: #ece6dc')}
      >
        <div style={s(`height: 2px; background: #a07a3c; width: ${progressPercent(qi, answers)}%; transition: width 460ms cubic-bezier(0.4,0,0.2,1)`)} />
      </div>

      <main data-pad style={s('flex: 1; display: flex; align-items: center; justify-content: center; padding: 56px 44px 24px')}>
        {ready && (
          <div key={`q${qi}`} data-fx-anim style={s('width: 100%; max-width: 760px; animation: qIn 340ms cubic-bezier(0.2,0,0,1) both')}>
            <div style={s('font-size: 12px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #a07a3c; margin-bottom: 22px')}>{label}</div>
            <h1
              ref={title}
              tabIndex={-1}
              data-q-title
              data-h1
              style={s("font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: clamp(30px, 3.6vw, 52px); line-height: 1.14; letter-spacing: -0.018em; margin: 0 0 14px; max-width: 26ch")}
            >
              {t(`quiz.questions.${id}.text`)}
            </h1>
            <p style={s('font-size: 17.5px; line-height: 1.7; color: #736d64; margin: 0 0 24px; max-width: 54ch')}>{t(`quiz.questions.${id}.help`)}</p>
            {nudge && (
              <div role="status" style={s('font-size: 14.5px; line-height: 1.6; color: #a07a3c; margin: 0 0 26px; max-width: 52ch')}>
                {t(`quiz.nudge.${nudge}`)}
              </div>
            )}
            <div role="group" aria-label={t(`quiz.questions.${id}.text`)} style={s('display: flex; flex-direction: column; gap: 10px')}>
              {options.map((option) => {
                const on = picked === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pick(option)}
                    {...x(
                      `display: flex; align-items: center; gap: 18px; text-align: left; cursor: pointer; padding: 22px 26px; ${SANS}; border-radius: 12px; transition: background 180ms ease, border-color 180ms ease; border: 1px solid ${on ? '#14202b' : '#ece6dc'}; background: ${on ? '#ece6dc' : 'transparent'}`,
                      { hover: 'border-color: #14202b; background: rgba(20,32,43,0.035)' },
                    )}
                  >
                    <span
                      aria-hidden="true"
                      style={s(`width: 18px; height: 18px; border-radius: 50%; flex: none; transition: background 180ms ease; border: 1px solid ${on ? '#14202b' : 'rgba(20,32,43,0.3)'}; background: ${on ? '#a07a3c' : 'transparent'}`)}
                    />
                    <span style={s("font-family: 'Newsreader', Georgia, serif; font-size: 21px; line-height: 1.3")}>{t(`quiz.questions.${id}.options.${option}`)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <div style={s('border-top: 1px solid #ece6dc')}>
        <div data-q-foot style={s('max-width: 760px; margin: 0 auto; padding: 14px 44px; display: flex; align-items: center; justify-content: space-between; gap: 16px')}>
          <button
            type="button"
            onClick={previous}
            {...x(`background: #fff; border: 1px solid #d8cfc0; cursor: pointer; color: #14202b; ${SANS}; font-weight: 600; font-size: 14.5px; letter-spacing: 0.02em; padding: 15px 24px; border-radius: 12px; white-space: nowrap; transition: border-color 180ms ease, background 180ms ease`, {
              hover: 'border-color: #14202b; background: #ece6dc',
            })}
          >
            {qi === 0 ? t('quiz.backToSite') : t('quiz.previous')}
          </button>
          <span style={s('flex: 1; text-align: center')}>
            <span style={s('display: block; font-size: 13.5px; color: #736d64')}>{qi === LAST_INDEX ? t('quiz.lastQuestion') : t('quiz.remaining', { count: questionsLeft(qi) })}</span>
            <span style={s('display: block; font-size: 12.5px; color: #736d64; opacity: 0.8; margin-top: 3px')}>{t('quiz.reassure')}</span>
          </span>
          <button
            type="button"
            className="btn"
            onClick={() => router.push('/details')}
            style={s(`background: #14202b; color: #f8f5f0; ${SANS}; font-weight: 600; padding: 17px 34px; font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase; border-radius: 12px; visibility: ${canSeeResult(qi, answers) ? 'visible' : 'hidden'}`)}
          >
            {t('quiz.seeResult')}
          </button>
        </div>
      </div>
    </Page>
  );
}
