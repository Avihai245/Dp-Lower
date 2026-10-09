import { define } from '../doc';
import { eyebrow, hero, para, photoRow, section } from '../kit';
import { bottom, common, personalAreaCta, top } from './common';
import type { Frag } from '../text';

/** Email 7 of 15 · day 14 · a family that thought the trail had gone cold. */
const en = {
  subject: 'A family that thought the trail had gone cold',
  preheader: 'One client story, and the people who will handle your case.',
  kicker: 'Client story',
  h1: '{first}, you would not be the first.',
  lede: 'Most of the families we work with started with less information than you have now.',
  familyEyebrow: 'A family like yours',
  quote:
    '“My family had very limited information about my grandfather’s life in Germany, so I assumed the process would be almost impossible. They helped us understand what was missing and how to move forward. Their guidance made a huge difference.”',
  by: '<ltr>Rachel Hoffman</ltr> · May 18, 2026',
  rating: '4.9 average, 380+ reviews',
  area1: 'If your own application is still part finished, it is saved and waiting in your personal area.',
  area2: 'You can add a document or check your status there whenever you like.',
};

const he: typeof en = {
  subject: 'משפחה שחשבה שהעקבות נעלמו',
  preheader: 'סיפור לקוח אחד, והאנשים שיטפלו בתיק שלכם.',
  kicker: 'סיפור לקוח',
  h1: '{first}, לא תהיו הראשונים.',
  lede: 'רוב המשפחות שאנחנו עובדים איתן התחילו עם פחות מידע ממה שיש לכם עכשיו.',
  familyEyebrow: 'משפחה כמו שלכם',
  quote:
    '„למשפחה שלי היה מעט מאוד מידע על חייו של סבי בגרמניה, ולכן הנחתי שהתהליך כמעט בלתי אפשרי. הם עזרו לנו להבין מה חסר ואיך מתקדמים. ההכוונה שלהם עשתה הבדל עצום.”',
  by: '<ltr>Rachel Hoffman</ltr> · 18 במאי 2026',
  rating: 'ממוצע 4.9, <ltr>380+</ltr> ביקורות',
  area1: 'אם הבקשה שלכם עדיין מולאה רק בחלקה, היא שמורה וממתינה באזור האישי שלכם.',
  area2: 'אפשר להוסיף שם מסמך או לבדוק את הסטטוס מתי שנוח לכם.',
};

export const welcome7 = define('welcome', { en, he }, (k, c) => {
  const cm = common(k);
  const rating = k.r(c.rating);
  const by = k.r(c.by);
  const quote = k.r(c.quote);
  const story: Frag[] = [
    eyebrow(k, k.r(c.familyEyebrow), { mb: 16 }),
    {
      html: `<p class="quote t-ink" style="margin:0 0 16px 0; font-family:${k.SERIF}; font-size:21px; line-height:33px; color:#14202b; mso-line-height-rule:exactly;">${quote.html}</p>`,
      text: quote.text,
    },
    {
      html: `<p style="margin:0 0 22px 0; font-family:${k.SANS}; font-size:13px; line-height:20px; color:#55606b;">${by.html}</p>`,
      text: by.text,
    },
    {
      html: `<p class="t-ink" style="margin:0; font-family:${k.SERIF}; font-size:17px; line-height:26px; color:#14202b;"><span style="color:#a07a3c; letter-spacing:0.08em;">&#9733;&#9733;&#9733;&#9733;&#9733;</span> &nbsp;${rating.html}</p>`,
      text: `★★★★★ ${rating.text}`,
    },
  ];
  return {
    subject: c.subject,
    preheader: c.preheader,
    rows: [
      top(k),
      hero(k, { kicker: c.kicker, h1: k.r(c.h1, k.vars), ledes: [k.r(c.lede)] }),
      photoRow(k, cm.teamAlt),
      section(
        k,
        { bg: 'paper', pad: '26px 44px 10px 44px', cls: 'px pt' },
        eyebrow(k, k.r(cm.peopleEyebrow), { mb: 10 }),
        para(k, k.r(cm.peopleLine), { mb: '0px' }),
      ),
      section(k, { bg: 'stone', pad: '34px 44px 32px 44px' }, ...story),
      personalAreaCta(k, { bg: 'paper', p1: c.area1, p2: c.area2, label: cm.openPortal }),
      bottom(k),
    ],
  };
});
