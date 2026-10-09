import { define } from '../doc';
import { cta, eyebrow, h2, hero, note, para, photoRow, section } from '../kit';
import { bottom, common, faq, top } from './common';
import { reviews } from './reviews';

/** Email 1 of 15 · immediately after the lead is created · thank you and your portal. */
const en = {
  subject: 'Thank you — your citizenship file is open',
  preheader: 'Your answers are saved and your portal is already open. No password needed.',
  kicker: 'Eligibility check complete',
  h1: '{first}, thank you for your details.',
  ledes: [
    'Your answers are saved, and your portal is already open.',
    'Nothing to set up, and no password to remember.',
    'Add your family details and whatever records you have, and one of our lawyers starts reading your case.',
  ],
  heroNote: 'No card and no fee. Everything saves as you go.',
  people1: 'Licensed attorneys, not agents.',
  people2: 'The lawyers and researchers who look at your eligibility are the ones who prepare your case, and one of them signs the filing.',
  q1: 'I don’t have any documents. Can I still start?',
  a1: [
    'Yes, and most families do.',
    'People come to us with a story rather than a file, and finding the birth, marriage and emigration records in German and Austrian archives is our job.',
  ],
  q2: 'What does it cost to find out?',
  q3: 'Who actually handles my case?',
  closing: 'Your file is waiting, {first}.',
  closingNote: 'About twelve minutes, and you can stop and come back whenever you like.',
};

const he: typeof en = {
  subject: 'תודה — תיק האזרחות שלכם נפתח',
  preheader: 'התשובות שלכם נשמרו והפורטל שלכם כבר פתוח. אין צורך בסיסמה.',
  kicker: 'בדיקת הזכאות הושלמה',
  h1: '{first}, תודה על הפרטים שמסרתם.',
  ledes: [
    'התשובות שלכם נשמרו, והפורטל שלכם כבר פתוח.',
    'אין מה להגדיר, ואין סיסמה לזכור.',
    'הוסיפו את פרטי המשפחה ואת כל הרשומות שיש בידיכם, ואחד מעורכי הדין שלנו יתחיל לקרוא את התיק.',
  ],
  heroNote: 'ללא כרטיס אשראי וללא תשלום. הכול נשמר תוך כדי עבודה.',
  people1: 'עורכי דין מורשים, לא סוכנים.',
  people2: 'עורכי הדין והחוקרים שבודקים את זכאותכם הם אלה שמכינים את התיק, ואחד מהם חותם על ההגשה.',
  q1: 'אין לי מסמכים בכלל. אפשר בכל זאת להתחיל?',
  a1: [
    'כן, וכך עושות רוב המשפחות.',
    'אנשים מגיעים אלינו עם סיפור ולא עם תיק, ואיתור רשומות הלידה, הנישואין וההגירה בארכיונים הגרמניים והאוסטריים הוא התפקיד שלנו.',
  ],
  q2: 'כמה עולה לברר?',
  q3: 'מי באמת מטפל בתיק שלי?',
  closing: '{first}, התיק שלכם מחכה לכם.',
  closingNote: 'כשתים עשרה דקות, ואפשר לעצור ולחזור מתי שנוח לכם.',
};

export const welcome1 = define('welcome', { en, he }, (k, c) => {
  const cm = common(k);
  const v = k.vars;
  return {
    subject: c.subject,
    preheader: c.preheader,
    rows: [
      top(k),
      hero(k, {
        kicker: c.kicker,
        h1: k.r(c.h1, v),
        ledes: c.ledes.map((l) => k.r(l)),
        cta: { href: k.ctx.links.portal, label: cm.goPortal },
        note: k.r(c.heroNote),
      }),
      photoRow(k, cm.teamAlt),
      section(
        k,
        { bg: 'paper', pad: '24px 44px 36px 44px', cls: 'px pb' },
        eyebrow(k, k.r(cm.peopleEyebrow), { mb: 10 }),
        para(k, k.r(c.people1), { mb: 8 }),
        para(k, k.r(c.people2), { margin: '0' }),
      ),
      ...reviews(k),
      section(
        k,
        { bg: 'stone', pad: '34px 44px 32px 44px' },
        eyebrow(k, k.r(cm.faqEyebrow), { mb: 20 }),
        ...faq(k, c.q1, c.a1, 26),
        ...faq(k, c.q2, cm.faqCost, 26),
        ...faq(k, c.q3, cm.faqWho, null),
      ),
      section(
        k,
        { bg: 'paper', pad: '36px 44px 40px 44px', center: true },
        h2(k, k.r(c.closing, v), { mb: 20, size: 22 }),
        cta(k, { href: k.ctx.links.portal, label: cm.goPortal, variant: 'ink', center: true }),
        note(k, k.r(c.closingNote), { mt: 16, color: '#6f7a85' }),
      ),
      bottom(k),
    ],
  };
});
