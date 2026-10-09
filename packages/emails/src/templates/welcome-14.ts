import { define } from '../doc';
import { bullets, eyebrow, hero, para, section } from '../kit';
import { bottom, common, personalAreaCta, top } from './common';
import type { Frag } from '../text';

/** Email 14 of 15 · day 42 · most families think their records are gone. */
const en = {
  subject: 'Most families think their records are gone',
  preheader: 'Missing papers are the normal starting point, not a dead end.',
  kicker: 'What we do with a thin file',
  h1: '{first}, missing records are the normal starting point.',
  ledes: [
    'Families tell us the papers were lost, burned, or left behind in a hurry.',
    'That is where the work begins, not where it stops.',
  ],
  spellingsEyebrow: 'One family, three spellings',
  spellingsNote:
    'The same family, written three ways across two borders.<br>This is what an archive search has to see through.',
  whereEyebrow: 'Where the records still are',
  where: [
    'Birth and marriage entries in municipal registries',
    'Emigration and residency files',
    'Community and congregation records',
    'Naturalisation papers from the country the family reached',
  ],
  digitised: [
    'Much of this has never been digitised, which is why it feels like nothing exists.',
    'Give us the little you know and we follow it from there.',
  ],
  area1:
    'If your application or your documents are only part done, everything you entered is saved in your personal area.',
  area2: 'Open it to finish a section, add a record, or check where your case stands.',
};

const he: typeof en = {
  subject: 'רוב המשפחות חושבות שהרשומות שלהן אבדו',
  preheader: 'מסמכים חסרים הם נקודת פתיחה רגילה, לא מבוי סתום.',
  kicker: 'מה עושים עם תיק דל',
  h1: '{first}, רשומות חסרות הן נקודת הפתיחה הרגילה.',
  ledes: ['משפחות מספרות לנו שהניירות אבדו, נשרפו או הושארו מאחור בחופזה.', 'שם העבודה מתחילה, לא נעצרת.'],
  spellingsEyebrow: 'משפחה אחת, שלושה איותים',
  spellingsNote: 'אותה משפחה, כתובה בשלוש דרכים משני עברי הגבול.<br>את זה חיפוש בארכיון צריך לדעת לפענח.',
  whereEyebrow: 'היכן הרשומות עדיין נמצאות',
  where: [
    'רישומי לידה ונישואין במרשמים עירוניים',
    'תיקי הגירה ומגורים',
    'רשומות של קהילות וקהילות דתיות',
    'מסמכי התאזרחות מהמדינה שאליה הגיעה המשפחה',
  ],
  digitised: [
    'חלק גדול מזה מעולם לא עבר דיגיטציה, ולכן נדמה שלא קיים דבר.',
    'תנו לנו את המעט שאתם יודעים, ואנחנו נמשיך משם.',
  ],
  area1: 'אם הבקשה או המסמכים שלכם הושלמו רק בחלקם, כל מה שהזנתם שמור באזור האישי שלכם.',
  area2: 'היכנסו אליו כדי להשלים פרק, להוסיף רשומה או לבדוק איפה התיק שלכם עומד.',
};

export const welcome14 = define('welcome', { en, he }, (k, c) => {
  const cm = common(k);
  const spelling = (name: string, color: string, mb: number): Frag => {
    const f = k.r(`<ltr>${name}</ltr>`);
    return {
      html: `<p class="display" style="margin:0 0 ${mb}px 0; font-family:${k.SERIF}; font-size:32px; line-height:40px; color:${color}; text-align:center;">${f.html}</p>`,
      text: name,
    };
  };
  const spellNote = k.r(c.spellingsNote);
  const spellings = [
    eyebrow(k, k.r(c.spellingsEyebrow), { mb: 20, center: true }),
    spelling('Grünbaum', '#14202b', 6),
    spelling('Gruenbaum', '#a07a3c', 6),
    spelling('Greenbaum', '#14202b', 18),
    {
      html: `<p style="margin:0; font-family:${k.SANS}; font-size:15px; line-height:25px; color:#55606b; text-align:center;">${spellNote.html}</p>`,
      text: spellNote.text,
    },
  ];
  return {
    subject: c.subject,
    preheader: c.preheader,
    rows: [
      top(k),
      hero(k, { kicker: c.kicker, h1: k.r(c.h1, k.vars), ledes: c.ledes.map((l) => k.r(l)) }),
      section(k, { bg: 'stone', pad: '36px 44px 34px 44px', cls: 'px pt' }, ...spellings),
      section(
        k,
        { bg: 'paper', pad: '34px 44px 32px 44px' },
        eyebrow(k, k.r(c.whereEyebrow), { mb: 18 }),
        bullets(
          k,
          c.where.map((w) => k.r(w)),
          { mb: 22, gap: 8 },
        ),
        para(k, k.r(c.digitised[0]!), { mb: 8 }),
        para(k, k.r(c.digitised[1]!), { mb: '0px' }),
      ),
      personalAreaCta(k, { bg: 'stone', p1: c.area1, p2: c.area2, label: cm.openPortal }),
      bottom(k),
    ],
  };
});
