import { define } from '../doc';
import { eyebrow, hero, para, section, type Kit } from '../kit';
import { bottom, common, personalAreaCta, top } from './common';
import type { Frag } from '../text';

/** Email 5 of 15 · day 8 · what you pay for, and when. */
const en = {
  subject: 'What you pay for, and when',
  preheader: 'The fee structure in five lines, with nothing hidden.',
  kicker: 'Costs, stated plainly',
  h1: '{first}, here is how the money works.',
  ledes: ['Nobody should have to ask twice what a legal process costs.', 'So here is the whole structure, in five lines.'],
  feesEyebrow: 'Fees and third-party costs',
  fees: [
    { title: 'The eligibility check', body: 'Free.<br>It is an indication based on your answers, not a legal opinion.' },
    { title: 'The consultation call', body: 'Free.<br>Twenty minutes with a lawyer, and no obligation afterwards.' },
    {
      title: 'Our professional fee',
      body: 'Quoted only after a lawyer has read your case, so the figure reflects your own records rather than an average.<br>You see it before any work starts.',
    },
    { title: 'Archive searches and translations', body: 'Charged at cost and listed for you in advance.<br>We never mark them up.' },
    { title: 'Consular and authority fees', body: 'Set by the authority rather than by us.<br>They are paid at the point of filing.' },
  ],
  nothing: 'You pay nothing until we accept your case.',
  area1: 'If your file is part finished, your personal area holds everything you have entered so far.',
  area2: 'Open it to complete a section, add a document, or check your status.',
};

const he: typeof en = {
  subject: 'על מה משלמים, ומתי',
  preheader: 'מבנה התשלומים בחמש שורות, בלי שום דבר מוסתר.',
  kicker: 'עלויות, בפשטות',
  h1: '{first}, כך עובד עניין הכסף.',
  ledes: ['אף אחד לא צריך לשאול פעמיים כמה עולה הליך משפטי.', 'אז הנה המבנה כולו, בחמש שורות.'],
  feesEyebrow: 'שכר טרחה ועלויות צד שלישי',
  fees: [
    { title: 'בדיקת הזכאות', body: 'ללא תשלום.<br>זו אינדיקציה על סמך התשובות שלכם, ולא חוות דעת משפטית.' },
    { title: 'שיחת הייעוץ', body: 'ללא תשלום.<br>עשרים דקות עם עורך דין, וללא התחייבות לאחר מכן.' },
    {
      title: 'שכר הטרחה שלנו',
      body: 'נקבע רק לאחר שעורך דין קרא את התיק שלכם, כך שהסכום משקף את הרשומות שלכם ולא ממוצע.<br>אתם רואים אותו לפני שמתחילה כל עבודה.',
    },
    { title: 'חיפושים בארכיונים ותרגומים', body: 'מחויבים לפי עלות ומפורטים לכם מראש.<br>אנחנו אף פעם לא מוסיפים עליהם רווח.' },
    { title: 'אגרות קונסולריות ואגרות הרשות', body: 'נקבעות על ידי הרשות ולא על ידינו.<br>הן משולמות בעת ההגשה.' },
  ],
  nothing: 'אתם לא משלמים דבר עד שנקבל את התיק שלכם.',
  area1: 'אם התיק שלכם מולא חלקית, האזור האישי שלכם שומר את כל מה שהזנתם עד כה.',
  area2: 'היכנסו אליו כדי להשלים פרק, להוסיף מסמך או לבדוק את הסטטוס.',
};

/** Two-column fee table: the label cell stacks above the text on phones. */
function feeTable(k: Kit, rows: Array<{ title: string; body: string }>): Frag {
  const html = rows
    .map(
      (r) => `
        <tr>
          <td width="46%" valign="top" class="stack" style="${k.pad('14px', '16px', '14px', '0')} border-top:1px solid #e0d8ca;${k.ds}">
            <p class="t-ink" style="margin:0; font-family:${k.SERIF}; font-size:18px; line-height:25px; color:#14202b;">${k.r(r.title).html}</p>
          </td>
          <td valign="top" class="stack" style="padding:14px 0 14px 0; border-top:1px solid #e0d8ca;${k.ds}">
            <p class="body t-body" style="margin:0; font-family:${k.SANS}; font-size:15.5px; line-height:25px; color:#3f4b56;">${k.r(r.body).html}</p>
          </td>
        </tr>
`,
    )
    .join('');
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr}>
${html}      </table>`,
    text: rows.map((r) => `${k.r(r.title).text}: ${k.r(r.body).text.replace(/\n/g, ' ')}`).join('\n'),
  };
}

export const welcome5 = define('welcome', { en, he }, (k, c) => {
  const cm = common(k);
  return {
    subject: c.subject,
    preheader: c.preheader,
    rows: [
      top(k),
      hero(k, { kicker: c.kicker, h1: k.r(c.h1, k.vars), ledes: c.ledes.map((l) => k.r(l)) }),
      section(
        k,
        { bg: 'paper', pad: '34px 44px 8px 44px', cls: 'px pt' },
        eyebrow(k, k.r(c.feesEyebrow), { mb: 14 }),
        feeTable(k, c.fees),
      ),
      section(k, { bg: 'paper', pad: '20px 44px 32px 44px', cls: 'px pb' }, para(k, k.r(c.nothing), { mb: '0px' })),
      personalAreaCta(k, { bg: 'stone', p1: c.area1, p2: c.area2, label: cm.continueApp, noteCls: '' }),
      bottom(k),
    ],
  };
});
