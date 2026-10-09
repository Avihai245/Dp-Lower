import { define } from '../doc';
import { eyebrow, hero, section, type Kit } from '../kit';
import { bottom, common, personalAreaCta, top } from './common';
import type { Frag } from '../text';

/** Email 9 of 15 · day 22 · what happens after you submit. */
const en = {
  subject: 'What happens after you submit',
  preheader: 'The stages of a case, and where you can watch them from.',
  kicker: 'From submission to decision',
  h1: '{first}, here is what happens next.',
  ledes: [
    'Once your information and records are in, the case moves through four clear stages.',
    'You can follow every one of them yourself.',
  ],
  stagesEyebrow: 'The stages of a case',
  stages: [
    {
      title: 'We check what you sent',
      body: 'A case manager confirms the records are readable and tells you if anything is missing.',
    },
    {
      title: 'A lawyer reviews the case',
      body: 'You receive a written assessment of your route and the records still needed.',
    },
    {
      title: 'We complete the file',
      body: 'Archive requests, translations and apostilles are handled by us, and third-party costs are shown at cost.',
    },
    {
      title: 'The filing',
      body: 'Your case goes to the relevant authority, and we stay with it until there is a decision.',
    },
  ],
  area1:
    'If a form is still unfinished or a document is missing, your personal area shows exactly what is outstanding.',
  area2: 'It also shows the current stage of your case, updated as the file moves.',
};

const he: typeof en = {
  subject: 'מה קורה אחרי ההגשה',
  preheader: 'שלבי התיק, והמקום שבו אפשר לעקוב אחריהם.',
  kicker: 'מההגשה ועד להחלטה',
  h1: '{first}, הנה מה שקורה בהמשך.',
  ledes: [
    'כשהמידע והרשומות שלכם מגיעים אלינו, התיק עובר ארבעה שלבים ברורים.',
    'אתם יכולים לעקוב בעצמכם אחרי כל אחד מהם.',
  ],
  stagesEyebrow: 'שלבי התיק',
  stages: [
    { title: 'אנחנו בודקים את מה ששלחתם', body: 'מנהל תיק מוודא שהרשומות קריאות ומודיע לכם אם משהו חסר.' },
    {
      title: 'עורך דין בוחן את התיק',
      body: 'אתם מקבלים הערכה בכתב של המסלול שלכם ושל הרשומות שעדיין נדרשות.',
    },
    {
      title: 'אנחנו משלימים את התיק',
      body: 'בקשות לארכיונים, תרגומים ואפוסטיל מטופלים על ידינו, ועלויות צד שלישי מוצגות לפי עלותן.',
    },
    { title: 'ההגשה', body: 'התיק שלכם מוגש לרשות המוסמכת, ואנחנו ממשיכים ללוות אותו עד שמתקבלת החלטה.' },
  ],
  area1: 'אם טופס עדיין לא הושלם או שחסר מסמך, האזור האישי שלכם מראה בדיוק מה נותר.',
  area2: 'הוא מציג גם את השלב הנוכחי של התיק שלכם, ומתעדכן ככל שהתיק מתקדם.',
};

/** 01-04 with a large brass numeral. */
function numbered(k: Kit, list: Array<{ title: string; body: string }>): Frag {
  const rows = list
    .map((s, i) => {
      const last = i === list.length - 1;
      const pad = last ? '0 0 0px 0' : '0 0 22px 0';
      return `
        <tr>
          <td width="64" valign="top" style="padding:${pad};${k.ds}">
            <p class="bignum" style="margin:0; font-family:${k.SERIF}; font-size:40px; line-height:40px; color:#a07a3c;">0${i + 1}</p>
          </td>
          <td valign="top" style="padding:${pad};${k.ds}">
            <p class="h2 t-ink" style="margin:0 0 6px 0; font-family:${k.SERIF}; font-size:21px; line-height:28px; color:#14202b;">${k.r(s.title).html}</p>
            <p class="body t-body" style="margin:0; font-family:${k.SANS}; font-size:16px; line-height:26px; color:#3f4b56;">${k.r(s.body).html}</p>
          </td>
        </tr>
`;
    })
    .join('');
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr}>
${rows}      </table>`,
    text: list.map((s, i) => `0${i + 1}  ${k.r(s.title).text}\n    ${k.r(s.body).text}`).join('\n'),
  };
}

export const welcome9 = define('welcome', { en, he }, (k, c) => {
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
        eyebrow(k, k.r(c.stagesEyebrow), { mb: 22 }),
        numbered(k, c.stages),
      ),
      personalAreaCta(k, { bg: 'stone', p1: c.area1, p2: c.area2, label: cm.checkStatus }),
      bottom(k),
    ],
  };
});
