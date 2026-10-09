import { define } from '../doc';
import { eyebrow, hero, items, para, section } from '../kit';
import { bottom, common, personalAreaCta, top } from './common';

/** Email 4 of 15 · day 5 · if your family kept nothing (skipped when every document is in). */
const en = {
  subject: 'If your family kept nothing',
  preheader: 'The records survive in places families never thought to look.',
  kicker: 'Records',
  h1: '{first}, missing papers are not the end of it.',
  lede: '“We have nothing. No papers at all.” We hear that in most first conversations.',
  whereEyebrow: 'Where the records survive',
  where: [
    'European civil registries kept duplicates.',
    'State archives kept emigration files.<br>Communities kept their own records, and much of it survived in places families never thought to look.',
  ],
  usefulEyebrow: 'What is genuinely useful to us',
  useful: [
    {
      title: 'A name and a place',
      body: 'Even a spelling that changed at a border.<br>Archives are searched by place first, and one town narrows years of work into weeks.',
    },
    {
      title: 'An approximate date',
      body: 'A decade is enough to begin.<br>We refine it from what the registry returns.',
    },
    {
      title: 'Anything at all on paper',
      body: 'A single certificate, a ship manifest, a naturalisation card, a letter.<br>One document usually leads to the next.',
    },
  ],
  area1: 'Whatever you already hold can go straight into your personal area, and we search for the rest.',
  area2: 'Your current stage is shown there as well.',
};

const he: typeof en = {
  subject: 'אם המשפחה שלכם לא שמרה דבר',
  preheader: 'הרשומות שורדות במקומות שמשפחות לא חשבו לחפש בהם.',
  kicker: 'רשומות',
  h1: '{first}, מסמכים חסרים אינם סוף הדרך.',
  lede: '„אין לנו כלום. אין בכלל מסמכים.” את זה אנחנו שומעים ברוב השיחות הראשונות.',
  whereEyebrow: 'היכן הרשומות שורדות',
  where: [
    'מרשמי האוכלוסין באירופה שמרו העתקים.',
    'ארכיוני המדינה שמרו תיקי הגירה.<br>גם הקהילות שמרו רשומות משלהן, וחלק גדול מהן שרד במקומות שמשפחות לא חשבו לחפש בהם.',
  ],
  usefulEyebrow: 'מה באמת עוזר לנו',
  useful: [
    {
      title: 'שם ומקום',
      body: 'גם איות ששונה בגבול.<br>הארכיונים נסרקים קודם כול לפי מקום, ועיר אחת מצמצמת שנים של עבודה לשבועות.',
    },
    { title: 'תאריך משוער', body: 'עשור מספיק כדי להתחיל.<br>אנחנו מדייקים אותו לפי מה שהמרשם מחזיר.' },
    {
      title: 'כל דבר שנכתב על נייר',
      body: 'תעודה אחת, רשימת נוסעים בספינה, כרטיס התאזרחות, מכתב.<br>מסמך אחד מוביל בדרך כלל לבא אחריו.',
    },
  ],
  area1: 'כל מה שכבר יש בידיכם אפשר להעלות ישר לאזור האישי, ואת השאר אנחנו מחפשים.',
  area2: 'השלב הנוכחי שלכם מוצג שם גם הוא.',
};

export const welcome4 = define('welcome', { en, he }, (k, c) => {
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
        eyebrow(k, k.r(c.whereEyebrow), { mb: 20 }),
        para(k, k.r(c.where[0]!), { mb: 16 }),
        para(k, k.r(c.where[1]!), { mb: '0px' }),
      ),
      section(
        k,
        { bg: 'paper', pad: '32px 44px 32px 44px' },
        eyebrow(k, k.r(c.usefulEyebrow), { mb: 18 }),
        items(
          k,
          c.useful.map((u) => ({ title: k.r(u.title), body: k.r(u.body) })),
        ),
      ),
      personalAreaCta(k, { bg: 'stone', p1: c.area1, p2: c.area2, label: cm.addDocs, noteCls: '' }),
      bottom(k),
    ],
  };
});
