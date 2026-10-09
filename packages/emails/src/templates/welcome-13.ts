import { define } from '../doc';
import { eyebrow, hero, items, para, section } from '../kit';
import { bottom, common, personalAreaLink, top } from './common';

/** Email 13 of 15 · day 38 · the words you will hear, in plain English. */
const en = {
  subject: 'The words you will hear, in plain English',
  preheader: 'The terms that come up in every case, explained once.',
  kicker: 'A short glossary',
  h1: '{first}, five words worth knowing.',
  lede: 'Citizenship by descent comes with its own vocabulary.<br>Most of it is simpler than it sounds.',
  eyebrow: 'In plain English',
  words: [
    {
      title: 'Citizenship by descent',
      body: 'A right that passes down a family line.<br>You are not applying for something new, you are asking a state to recognise something that was already yours.',
    },
    {
      title: 'Restoration',
      body: 'The route for families whose citizenship was taken away during the Nazi era.<br>Both countries we work in have provisions for exactly these descendants.',
    },
    {
      title: 'The descent chain',
      body: 'The documented line from your ancestor to you.<br>Every birth and marriage in between has to be evidenced, which is the part that takes the work.',
    },
    { title: 'Certified translation', body: 'A translation an authority will accept.<br>It has to come from a recognised translator, never from you or from an app.' },
    { title: 'Apostille', body: 'A stamp that makes a document from one country valid in another.<br>We arrange these for you.' },
  ],
  closing: ['You will not be asked to know any of this.', 'It is here so that nothing in your file reads like a foreign language when it reaches you.'],
  area2: 'The status of your case is shown there as well.',
};

const he: typeof en = {
  subject: 'המילים שתשמעו, בשפה פשוטה',
  preheader: 'המונחים שעולים בכל תיק, מוסברים פעם אחת.',
  kicker: 'מילון קצר',
  h1: '{first}, חמש מילים ששווה להכיר.',
  lede: 'לאזרחות מכוח מוצא יש אוצר מילים משלה.<br>רובו פשוט יותר ממה שהוא נשמע.',
  eyebrow: 'בשפה פשוטה',
  words: [
    {
      title: 'אזרחות מכוח מוצא',
      body: 'זכות שעוברת במורד הקו המשפחתי.<br>אתם לא מבקשים משהו חדש, אתם מבקשים ממדינה להכיר במשהו שכבר היה שלכם.',
    },
    {
      title: 'השבת אזרחות',
      body: 'המסלול למשפחות שאזרחותן נשללה בתקופת המשטר הנאצי.<br>בשתי המדינות שבהן אנחנו עובדים יש הוראות שנועדו בדיוק לצאצאים האלה.',
    },
    {
      title: 'שרשרת המוצא',
      body: 'הקו המתועד מאב קדמון ועד אליכם.<br>כל לידה וכל נישואין בדרך צריכים להיות מגובים בראיות, וזה החלק שדורש את העבודה.',
    },
    { title: 'תרגום מאושר', body: 'תרגום שהרשות תקבל.<br>הוא חייב להגיע ממתרגם מוכר, לא מכם ולא מאפליקציה.' },
    { title: 'אפוסטיל', body: 'חותמת שהופכת מסמך ממדינה אחת לתקף במדינה אחרת.<br>אנחנו מסדירים אותה עבורכם.' },
  ],
  closing: ['לא ידרשו מכם להכיר שום דבר מזה.', 'זה כאן כדי ששום דבר בתיק שלכם לא יישמע כמו שפה זרה כשהוא מגיע אליכם.'],
  area2: 'גם הסטטוס של התיק שלכם מוצג שם.',
};

export const welcome13 = define('welcome', { en, he }, (k, c) => {
  const cm = common(k);
  return {
    subject: c.subject,
    preheader: c.preheader,
    rows: [
      top(k),
      hero(k, { kicker: c.kicker, h1: k.r(c.h1, k.vars), ledes: [k.r(c.lede)] }),
      section(
        k,
        { bg: 'stone', pad: '34px 44px 34px 44px' },
        eyebrow(k, k.r(c.eyebrow), { mb: 20 }),
        items(k, c.words.map((w) => ({ title: k.r(w.title), body: k.r(w.body) }))),
      ),
      section(
        k,
        { bg: 'paper', pad: '30px 44px 30px 44px' },
        para(k, k.r(c.closing[0]!), { mb: 8 }),
        para(k, k.r(c.closing[1]!), { mb: '0px' }),
      ),
      ...personalAreaLink(k, cm.areaOpen, c.area2),
      bottom(k),
    ],
  };
});
