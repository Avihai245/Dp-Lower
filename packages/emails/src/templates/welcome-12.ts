import { define } from '../doc';
import { hero, para, section } from '../kit';
import { bottom, common, personalAreaCta, top } from './common';
import type { Frag } from '../text';

/** Email 12 of 15 · day 34 · the generation after yours. */
const en = {
  subject: 'The generation after yours',
  preheader: 'Why most people start this for someone else.',
  kicker: 'Looking forward',
  h1: '{first}, who are you really doing this for?',
  lede: 'The answer, in almost every case we handle, is somebody else.',
  lines: [
    'A daughter who wants to study abroad.',
    'A son who may want to work somewhere his own passport does not reach easily.',
    'Or simply the option itself, so that somebody in the family can use it one day.',
    'Citizenship by descent passes down.<br>Once it is recognised in your generation, it is available to the next.',
    'That is why timing matters more than it appears to.<br>A case completed now sits in the family record permanently.',
  ],
  quote: '“I began this process because I wanted my grandchildren to have the opportunity to study and build a future in Europe if they choose to.”',
  by: '<ltr>Barbara Levine</ltr> · January 2026',
  area1: 'If your file is part finished, your personal area holds everything you have entered so far.',
  area2: 'Open it to complete a section, add a document, or check your status.',
};

const he: typeof en = {
  subject: 'הדור שאחריכם',
  preheader: 'למה רוב האנשים מתחילים את זה בשביל מישהו אחר.',
  kicker: 'מסתכלים קדימה',
  h1: '{first}, בשביל מי אתם באמת עושים את זה?',
  lede: 'התשובה, כמעט בכל תיק שאנחנו מטפלים בו, היא: מישהו אחר.',
  lines: [
    'בת שרוצה ללמוד בחו״ל.',
    'בן שאולי ירצה לעבוד במקום שהדרכון שלו לא מגיע אליו בקלות.',
    'או פשוט עצם האפשרות, כדי שמישהו במשפחה יוכל להשתמש בה יום אחד.',
    'אזרחות מכוח מוצא עוברת הלאה.<br>ברגע שהיא מוכרת בדור שלכם, היא זמינה לדור הבא.',
    'לכן העיתוי חשוב יותר ממה שנראה.<br>תיק שהושלם עכשיו נשאר ברישום המשפחתי לצמיתות.',
  ],
  quote: '„התחלתי את התהליך כי רציתי שלנכדים שלי תהיה הזדמנות ללמוד ולבנות עתיד באירופה, אם יבחרו בכך.”',
  by: '<ltr>Barbara Levine</ltr> · ינואר 2026',
  area1: 'אם התיק שלכם מולא חלקית, האזור האישי שלכם שומר את כל מה שהזנתם עד כה.',
  area2: 'היכנסו אליו כדי להשלים פרק, להוסיף מסמך או לבדוק את הסטטוס.',
};

export const welcome12 = define('welcome', { en, he }, (k, c) => {
  const cm = common(k);
  const quote = k.r(c.quote);
  const by = k.r(c.by);
  const pull: Frag[] = [
    {
      html: `<p style="margin:0 0 10px 0; font-family:${k.SERIF}; font-size:24px; line-height:33px; color:#f8f5f0;">${quote.html}</p>`,
      text: quote.text,
    },
    {
      html: `<p style="margin:0; font-family:${k.SANS}; font-size:13px; line-height:20px; ${k.track('0.04em')}color:#9aa3ad;">${by.html}</p>`,
      text: by.text,
    },
  ];
  return {
    subject: c.subject,
    preheader: c.preheader,
    rows: [
      top(k),
      hero(k, { kicker: c.kicker, h1: k.r(c.h1, k.vars), ledes: [k.r(c.lede)] }),
      section(
        k,
        { bg: 'paper', pad: '34px 44px 32px 44px' },
        ...c.lines.map((line, i) => para(k, k.r(line), { mb: i === c.lines.length - 1 ? '0px' : 16 })),
      ),
      section(k, { bg: 'ink', pad: '34px 44px 34px 44px' }, ...pull),
      personalAreaCta(k, { bg: 'paper', p1: c.area1, p2: c.area2, label: cm.continueApp, noteCls: '' }),
      bottom(k),
    ],
  };
});
