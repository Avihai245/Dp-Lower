import { define } from '../doc';
import { eyebrow, hero, items, para, section } from '../kit';
import { bottom, common, personalAreaCta, top } from './common';

/** Email 10 of 15 · day 26 · what a European passport actually is. */
const en = {
  subject: 'What a European passport actually is',
  preheader: 'Recognition rather than purchase, and what that means for you.',
  kicker: 'The passport itself',
  h1: '{first}, what this actually is.',
  ledes: ['There is a lot of noise online about European passports.', 'Here is the plain version.'],
  eyebrow: 'What it is, and what it is not',
  points: [
    {
      title: 'It is recognition, not a purchase',
      body: 'No European country sells citizenship by descent.<br>The state is recognising a status your family already held.',
    },
    {
      title: 'It is full citizenship',
      body: 'Not a residence permit and not a visa.<br>You hold the same rights as anyone born there, including the right to vote.',
    },
    {
      title: 'It usually sits alongside your own',
      body: 'Most of our clients keep their existing nationality.<br>Whether that applies to you depends on the law of your own country, and we will tell you plainly.',
    },
    {
      title: 'It is inherited, not earned',
      body: 'There is no language test, no residence requirement and no interview about your intentions.<br>The question is only what the records show.',
    },
  ],
  surprise: [
    'This is the part that surprises people most.',
    'The process is demanding on paperwork and undemanding on everything else.',
  ],
  area2: 'You can see the current stage of your case there as well.',
};

const he: typeof en = {
  subject: 'מהו דרכון אירופי באמת',
  preheader: 'הכרה ולא רכישה, ומה זה אומר עבורכם.',
  kicker: 'הדרכון עצמו',
  h1: '{first}, מה זה באמת.',
  ledes: ['יש המון רעש ברשת על דרכונים אירופיים.', 'הנה הגרסה הפשוטה.'],
  eyebrow: 'מה זה, ומה זה לא',
  points: [
    {
      title: 'זו הכרה, לא רכישה',
      body: 'אף מדינה באירופה לא מוכרת אזרחות מכוח מוצא.<br>המדינה מכירה במעמד שהמשפחה שלכם כבר החזיקה בו.',
    },
    {
      title: 'זו אזרחות מלאה',
      body: 'לא אישור שהייה ולא ויזה.<br>יש לכם אותן זכויות כמו לכל מי שנולד שם, כולל הזכות לבחור.',
    },
    {
      title: 'היא בדרך כלל מצטרפת לאזרחות שלכם',
      body: 'רוב הלקוחות שלנו שומרים על אזרחותם הקיימת.<br>אם זה חל גם עליכם, זה תלוי בחוק של המדינה שלכם, ונאמר לכם זאת בבירור.',
    },
    {
      title: 'זו ירושה, לא הישג',
      body: 'אין מבחן שפה, אין דרישת מגורים ואין ראיון על הכוונות שלכם.<br>השאלה היחידה היא מה הרשומות מראות.',
    },
  ],
  surprise: ['זה החלק שמפתיע אנשים יותר מכול.', 'התהליך תובעני בניירת, ולא תובעני בשום דבר אחר.'],
  area2: 'אפשר לראות שם גם את השלב הנוכחי של התיק שלכם.',
};

export const welcome10 = define('welcome', { en, he }, (k, c) => {
  const cm = common(k);
  return {
    subject: c.subject,
    preheader: c.preheader,
    rows: [
      top(k),
      hero(k, { kicker: c.kicker, h1: k.r(c.h1, k.vars), ledes: c.ledes.map((l) => k.r(l)) }),
      section(
        k,
        { bg: 'stone', pad: '34px 44px 34px 44px' },
        eyebrow(k, k.r(c.eyebrow), { mb: 20 }),
        items(
          k,
          c.points.map((p) => ({ title: k.r(p.title), body: k.r(p.body) })),
        ),
      ),
      section(
        k,
        { bg: 'paper', pad: '30px 44px 30px 44px' },
        para(k, k.r(c.surprise[0]!), { mb: 8 }),
        para(k, k.r(c.surprise[1]!), { mb: '0px' }),
      ),
      personalAreaCta(k, { bg: 'stone', p1: cm.areaSaved, p2: c.area2, label: cm.openPortal, noteCls: '' }),
      bottom(k),
    ],
  };
});
