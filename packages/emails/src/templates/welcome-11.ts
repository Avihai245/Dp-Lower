import { define } from '../doc';
import { eyebrow, hero, items, para, section } from '../kit';
import { bottom, common, personalAreaLink, top } from './common';

/** Email 11 of 15 · day 30 · what a European passport actually opens. */
const en = {
  subject: 'What a European passport actually opens',
  preheader: 'Live, work, study, travel, and the part that passes on.',
  kicker: 'For the next generation',
  h1: '{first}, this is rarely only about you.',
  ledes: [
    'Most people who start this process are thinking a generation ahead.',
    'Here is what the citizenship itself carries.',
  ],
  eyebrow: 'What a second citizenship opens',
  opens: [
    {
      title: 'Live',
      body: 'The right to reside in any European Union member state, not only in Germany or Austria.',
    },
    { title: 'Work', body: 'Employment across the union without a visa or a sponsor.' },
    {
      title: 'Study',
      body: 'University on the same terms as local students, which in much of Europe means little or no tuition.',
    },
    { title: 'Travel', body: 'A European passport and the border treatment that comes with it.' },
    {
      title: 'Pass it on',
      body: 'Citizenship by descent continues to your children, which is the part most families are really deciding about.',
    },
  ],
  caveat: [
    'None of it is automatic, and nothing here is a promise about your own case.',
    'It is what the citizenship itself carries, once a case is accepted.',
  ],
  area1: 'If your own application is still part finished, it is saved in your personal area.',
};

const he: typeof en = {
  subject: 'מה דרכון אירופי באמת פותח',
  preheader: 'לגור, לעבוד, ללמוד, לטייל, והחלק שעובר הלאה.',
  kicker: 'לדור הבא',
  h1: '{first}, זה כמעט אף פעם לא רק בשבילכם.',
  ledes: ['רוב האנשים שמתחילים את התהליך חושבים דור קדימה.', 'הנה מה שהאזרחות עצמה נושאת איתה.'],
  eyebrow: 'מה אזרחות שנייה פותחת',
  opens: [
    { title: 'לגור', body: 'הזכות להתגורר בכל מדינה חברה באיחוד האירופי, ולא רק בגרמניה או באוסטריה.' },
    { title: 'לעבוד', body: 'עבודה בכל רחבי האיחוד ללא ויזה וללא ספונסר.' },
    {
      title: 'ללמוד',
      body: 'לימודים באוניברסיטה בתנאים זהים לאלה של הסטודנטים המקומיים, ובחלק גדול מאירופה זה אומר שכר לימוד נמוך או אפסי.',
    },
    { title: 'לטייל', body: 'דרכון אירופי והיחס בגבולות שמגיע איתו.' },
    { title: 'להעביר הלאה', body: 'אזרחות מכוח מוצא ממשיכה לילדיכם, וזה החלק שבו רוב המשפחות באמת מחליטות.' },
  ],
  caveat: [
    'שום דבר מזה אינו אוטומטי, ושום דבר כאן אינו הבטחה לגבי התיק שלכם.',
    'זה מה שהאזרחות עצמה נושאת איתה, ברגע שתיק מתקבל.',
  ],
  area1: 'אם הבקשה שלכם עדיין מולאה רק בחלקה, היא שמורה באזור האישי שלכם.',
};

export const welcome11 = define('welcome', { en, he }, (k, c) => {
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
        eyebrow(k, k.r(c.eyebrow), { mb: 22 }),
        items(
          k,
          c.opens.map((o) => ({ title: k.r(o.title), body: k.r(o.body) })),
          { gap: 18, title: 'display' },
        ),
      ),
      section(
        k,
        { bg: 'stone', pad: '30px 44px 30px 44px' },
        para(k, k.r(c.caveat[0]!), { mb: 8 }),
        para(k, k.r(c.caveat[1]!), { mb: '0px' }),
      ),
      ...personalAreaLink(k, c.area1, cm.areaWhenever),
      bottom(k),
    ],
  };
});
