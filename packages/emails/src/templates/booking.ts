import { bookingData } from '../data';
import { define } from '../doc';
import { bullets, eyebrow, hero, para, section } from '../kit';
import { formatWhen } from '../labels';
import { ltr } from '../text';
import { common, top } from './common';
import { actionBand, callCard, txFooter } from './tx';

/** booking-confirmation: sent right after a free call is booked (wording from the prototype's "Your call is booked" screen). */
const confirmEn = {
  subject: 'Your free call is booked',
  preheader:
    '{when}. A lawyer will call you, go through your answers and tell you which route fits your family.',
  kicker: 'Free consultation',
  h1: '{first}, your call is booked.',
  ledes: [
    'A lawyer will call you, go through your answers and tell you which route fits your family.',
    '{minutes} minutes, free, no obligation.',
  ],
  cardEyebrow: 'Your free call',
  callPhone: 'We will call {phone} and ask for {first}. {minutes} minutes, free.',
  callNoPhone: 'We will call your number and ask for {first}. {minutes} minutes, free.',
  coversEyebrow: 'What the call covers',
  covers: [
    'Which route looks likely for your family',
    'What records your case would need',
    'What we can search for on your behalf',
    'Any question you have before deciding anything',
  ],
  change: 'If something changes, you can move or cancel the call from your portal.',
  zone: 'Times are shown in your own time zone.',
  reason: 'You received this because you booked a free call with us.',
  at: '{date} at {time}',
};

const confirmHe: typeof confirmEn = {
  subject: 'השיחה החינמית שלכם נקבעה',
  preheader: '{when}. עורך דין יתקשר אליכם, יעבור על התשובות שלכם ויאמר לכם איזה מסלול מתאים למשפחה שלכם.',
  kicker: 'ייעוץ ללא תשלום',
  h1: '{first}, השיחה שלכם נקבעה.',
  ledes: [
    'עורך דין יתקשר אליכם, יעבור על התשובות שלכם ויאמר לכם איזה מסלול מתאים למשפחה שלכם.',
    '{minutes} דקות, ללא תשלום וללא התחייבות.',
  ],
  cardEyebrow: 'השיחה החינמית שלכם',
  callPhone: 'אנחנו נתקשר אל {phone} ונבקש את {first}. {minutes} דקות, ללא תשלום.',
  callNoPhone: 'אנחנו נתקשר למספר שלכם ונבקש את {first}. {minutes} דקות, ללא תשלום.',
  coversEyebrow: 'מה כוללת השיחה',
  covers: [
    'איזה מסלול נראה סביר עבור המשפחה שלכם',
    'אילו רשומות התיק שלכם יצטרך',
    'מה אנחנו יכולים לחפש בשמכם',
    'כל שאלה שיש לכם לפני שמחליטים משהו',
  ],
  change: 'אם משהו משתנה, אפשר להזיז או לבטל את השיחה מהפורטל שלכם.',
  zone: 'השעות מוצגות לפי אזור הזמן שלכם.',
  reason: 'קיבלתם הודעה זו מפני שקבעתם אצלנו שיחה חינם.',
  at: '{date} בשעה {time}',
};

export const bookingConfirmation = define('welcome', { en: confirmEn, he: confirmHe }, (k, c) => {
  const cm = common(k);
  const b = bookingData(k.ctx);
  const when = formatWhen(b.startsAt, b.timezone, k.locale);
  const time = `${when.time}${when.zone ? ` ${when.zone}` : ''}`;
  const whenText = k.t(c.at, { date: when.date, time });
  const vars = { ...k.vars, minutes: String(b.minutes), phone: ltr(k.ctx.lead.phone ?? '') };
  return {
    subject: c.subject,
    preheader: k.t(c.preheader, { when: whenText }),
    rows: [
      top(k),
      hero(k, { kicker: c.kicker, h1: k.r(c.h1, k.vars), ledes: c.ledes.map((l) => k.r(l, vars)) }),
      section(
        k,
        { bg: 'paper', pad: '34px 44px 32px 44px' },
        callCard(k, {
          eyebrow: c.cardEyebrow,
          when,
          lines: [k.r(k.ctx.lead.phone ? c.callPhone : c.callNoPhone, vars)],
        }),
      ),
      section(
        k,
        { bg: 'paper', pad: '0 44px 32px 44px', cls: 'px pb' },
        eyebrow(k, k.r(c.coversEyebrow), { mb: 20 }),
        bullets(
          k,
          c.covers.map((w) => k.r(w)),
          { gap: 8 },
        ),
      ),
      actionBand(k, {
        href: k.ctx.links.portal,
        label: cm.openPortal,
        note: c.zone,
        lead: para(k, k.r(c.change), { mb: 22 }),
      }),
      txFooter(k, { reason: c.reason, legal: true }),
    ],
  };
});

/** booking-cancelled: the booked call was cancelled (by the person or by the firm). */
const cancelEn = {
  subject: 'Your free call has been cancelled',
  preheader: 'You are welcome to book a new time whenever suits you.',
  kicker: 'Free consultation',
  h1: '{first}, your call has been cancelled.',
  ledes: [
    'The call booked for the time below will not take place.',
    'You are welcome to book a new time whenever suits you. It costs nothing, and it takes twenty minutes.',
  ],
  cardEyebrow: 'Cancelled call',
  zone: 'Times are shown in your own time zone.',
  reason: 'You received this because your free call with us was cancelled.',
};

const cancelHe: typeof cancelEn = {
  subject: 'השיחה החינמית שלכם בוטלה',
  preheader: 'אתם מוזמנים לקבוע זמן חדש מתי שנוח לכם.',
  kicker: 'ייעוץ ללא תשלום',
  h1: '{first}, השיחה שלכם בוטלה.',
  ledes: [
    'השיחה שנקבעה למועד שלהלן לא תתקיים.',
    'אתם מוזמנים לקבוע זמן חדש מתי שנוח לכם. זה לא עולה כלום, וזה לוקח עשרים דקות.',
  ],
  cardEyebrow: 'שיחה שבוטלה',
  zone: 'השעות מוצגות לפי אזור הזמן שלכם.',
  reason: 'קיבלתם הודעה זו מפני שהשיחה החינמית שלכם איתנו בוטלה.',
};

export const bookingCancelled = define('welcome', { en: cancelEn, he: cancelHe }, (k, c) => {
  const cm = common(k);
  const b = bookingData(k.ctx);
  const when = formatWhen(b.startsAt, b.timezone, k.locale);
  return {
    subject: c.subject,
    preheader: c.preheader,
    rows: [
      top(k),
      hero(k, { kicker: c.kicker, h1: k.r(c.h1, k.vars), ledes: c.ledes.map((l) => k.r(l)) }),
      section(
        k,
        { bg: 'paper', pad: '34px 44px 8px 44px', cls: 'px pt' },
        callCard(k, { eyebrow: c.cardEyebrow, when, strike: true }),
      ),
      actionBand(k, { href: k.ctx.links.booking, label: cm.bookCall, note: c.zone }),
      txFooter(k, { reason: c.reason, legal: true }),
    ],
  };
});
