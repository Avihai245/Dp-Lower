import { define } from '../doc';
import { eyebrow, hero, items, para, section } from '../kit';
import { bottom, common, personalAreaLink, top } from './common';

/** Email 6 of 15 · day 11 · where the time actually goes. */
const en = {
  subject: 'Where the time actually goes',
  preheader: 'The four stages of a case, and which one is the long one.',
  kicker: 'Timing',
  h1: '{first}, where the time actually goes.',
  ledes: ['People expect the paperwork to be the slow part.', 'It is usually the archives.'],
  stagesEyebrow: 'The four stages',
  stages: [
    { title: 'Your part', body: 'A questionnaire and whatever documents you already hold.<br>Most people finish inside an evening.' },
    { title: 'Our research', body: 'Locating the birth, marriage and emigration records in European archives.<br>This is the long stretch, and it runs without you.' },
    { title: 'Translation and legalisation', body: 'Certified translations and apostilles on everything the authority will read.<br>Handled in parallel wherever possible.' },
    { title: 'Filing and waiting', body: 'The authority sets its own pace once the file is lodged.<br>We chase, you get told what changes.' },
  ],
  promise: ['We do not quote a total in months, because no honest firm can before reading your records.', 'What we can promise is that the clock only starts once your details are with us.'],
  area2: 'The current stage of your case is shown there too.',
};

const he: typeof en = {
  subject: 'לאן הזמן באמת הולך',
  preheader: 'ארבעת השלבים של תיק, ואיזה מהם הארוך.',
  kicker: 'לוחות זמנים',
  h1: '{first}, לאן הזמן באמת הולך.',
  ledes: ['אנשים מצפים שהניירת תהיה החלק האיטי.', 'בדרך כלל אלה הארכיונים.'],
  stagesEyebrow: 'ארבעת השלבים',
  stages: [
    { title: 'החלק שלכם', body: 'שאלון וכל המסמכים שכבר יש בידיכם.<br>רוב האנשים מסיימים תוך ערב אחד.' },
    { title: 'המחקר שלנו', body: 'איתור רשומות לידה, נישואין והגירה בארכיונים באירופה.<br>זה הקטע הארוך, והוא מתנהל בלעדיכם.' },
    { title: 'תרגום ואימות', body: 'תרגומים מאושרים ואפוסטיל על כל מה שהרשות תקרא.<br>מטופלים במקביל ככל האפשר.' },
    { title: 'הגשה והמתנה', body: 'הרשות קובעת את הקצב שלה מרגע שהתיק הוגש.<br>אנחנו עוקבים ומזרזים, ואתם מקבלים עדכון על כל שינוי.' },
  ],
  promise: ['אנחנו לא נותנים הערכה כוללת בחודשים, כי אף משרד הגון לא יכול לעשות זאת לפני שקרא את הרשומות שלכם.', 'מה שאנחנו כן יכולים להבטיח הוא שהשעון מתחיל לרוץ רק כשהפרטים שלכם אצלנו.'],
  area2: 'גם השלב הנוכחי של התיק שלכם מוצג שם.',
};

export const welcome6 = define('welcome', { en, he }, (k, c) => {
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
        eyebrow(k, k.r(c.stagesEyebrow), { mb: 20 }),
        items(k, c.stages.map((s) => ({ title: k.r(s.title), body: k.r(s.body) }))),
      ),
      section(
        k,
        { bg: 'stone', pad: '30px 44px 30px 44px' },
        para(k, k.r(c.promise[0]!), { mb: 8 }),
        para(k, k.r(c.promise[1]!), { mb: '0px' }),
      ),
      ...personalAreaLink(k, cm.areaOpen, c.area2),
      bottom(k),
    ],
  };
});
