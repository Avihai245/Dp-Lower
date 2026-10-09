import { define } from '../doc';
import { bullets, cta, eyebrow, h2, hero, note, para, section } from '../kit';
import { bottom, common, personalAreaLink, top } from './common';

/** Email 3 of 15 · day 3 · your free call with a lawyer (skipped when a call is already booked). */
const en = {
  subject: 'Your free call with a lawyer is still open',
  preheader: 'Twenty minutes with a lawyer, at no cost and no obligation.',
  kicker: 'Free consultation',
  h1: '{first}, your call has not been booked yet.',
  ledes: [
    'The fastest way to know where you stand is to talk to one of our lawyers.',
    'It costs nothing, and it takes twenty minutes.',
  ],
  coversEyebrow: 'What the call covers',
  covers: [
    'Which route looks likely for your family',
    'What records your case would need',
    'What we can search for on your behalf',
    'Any question you have before deciding anything',
  ],
  free: ['Twenty minutes with a lawyer, at no cost.', 'You are not committing to anything by taking it.'],
  pick: 'Pick a time that suits you.',
  zone: 'Times are shown in your own time zone.',
  area1: 'If a form or a document is still outstanding, your personal area shows what is left.',
  area2: 'Anything you add before the call gives the lawyer more to work with.',
};

const he: typeof en = {
  subject: 'השיחה החינמית שלכם עם עורך דין עדיין פתוחה',
  preheader: 'עשרים דקות עם עורך דין, ללא עלות וללא התחייבות.',
  kicker: 'ייעוץ ללא תשלום',
  h1: '{first}, עדיין לא קבעתם את השיחה.',
  ledes: [
    'הדרך המהירה ביותר לדעת היכן אתם עומדים היא לדבר עם אחד מעורכי הדין שלנו.',
    'זה לא עולה כלום, וזה לוקח עשרים דקות.',
  ],
  coversEyebrow: 'מה כוללת השיחה',
  covers: [
    'איזה מסלול נראה סביר עבור המשפחה שלכם',
    'אילו רשומות התיק שלכם יצטרך',
    'מה אנחנו יכולים לחפש בשמכם',
    'כל שאלה שיש לכם לפני שמחליטים משהו',
  ],
  free: ['עשרים דקות עם עורך דין, ללא עלות.', 'השיחה לא מחייבת אתכם בשום דבר.'],
  pick: 'בחרו זמן שנוח לכם.',
  zone: 'השעות מוצגות לפי אזור הזמן שלכם.',
  area1: 'אם טופס או מסמך עדיין חסרים, האזור האישי שלכם מראה מה נותר.',
  area2: 'כל דבר שתוסיפו לפני השיחה נותן לעורך הדין יותר חומר לעבוד איתו.',
};

export const welcome3 = define('welcome', { en, he }, (k, c) => {
  const cm = common(k);
  return {
    subject: c.subject,
    preheader: c.preheader,
    rows: [
      top(k),
      hero(k, { kicker: c.kicker, h1: k.r(c.h1, k.vars), ledes: c.ledes.map((l) => k.r(l)) }),
      section(
        k,
        { bg: 'paper', pad: '34px 44px 32px 44px' },
        eyebrow(k, k.r(c.coversEyebrow), { mb: 20 }),
        bullets(
          k,
          c.covers.map((w) => k.r(w)),
          { mb: 24, gap: 8 },
        ),
        para(k, k.r(c.free[0]!), { mb: 8 }),
        para(k, k.r(c.free[1]!), { mb: '0px' }),
      ),
      section(
        k,
        { bg: 'stone', pad: '32px 44px 34px 44px', center: true, textAlign: true },
        h2(k, k.r(c.pick), { mb: 20, size: 22 }),
        cta(k, { href: k.ctx.links.booking, label: cm.bookCall, variant: 'ink', center: true }),
        note(k, k.r(c.zone), { mt: 14, cls: '' }),
      ),
      ...personalAreaLink(k, c.area1, c.area2),
      bottom(k),
    ],
  };
});
