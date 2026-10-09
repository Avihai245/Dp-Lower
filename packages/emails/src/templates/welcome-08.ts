import { define } from '../doc';
import { hero, para, section } from '../kit';
import { bottom, common, personalAreaCta, top } from './common';
import type { Frag } from '../text';

/** Email 8 of 15 · day 18 · a note from the team. */
const en = {
  subject: 'A note from our team',
  preheader: 'Most people who write to us assume the door closed years ago.',
  kicker: 'From the team',
  h1: '{first}, a short note from our desk.',
  lede: 'We read every case that comes through this practice.<br>One sentence repeats more than any other.',
  letter: [
    'People ask us whether it is too late.',
    'Their grandparents are gone.',
    'The papers went with them.',
    'The family stopped talking about Europe two generations ago, and so everyone assumed the door closed.',
    'In most of the cases we read, it had not.',
    'The rules in both countries were widened for exactly these families, whose records ended up scattered across archives and borders.',
    'Finding those records is our job, not yours.',
    'What we ask of you is small.',
    'Tell us what you know, even if it is only a city and a surname, and let one of our lawyers look at it properly.',
    'If the answer turns out to be no, you will hear that from us just as plainly.',
  ],
  signed: 'The citizenship team',
  firm: 'Decker Pex Levi · Tel Aviv',
  area2: 'You can also see the current stage of your case there.',
};

const he: typeof en = {
  subject: 'הערה קצרה מהצוות שלנו',
  preheader: 'רוב האנשים שפונים אלינו מניחים שהדלת נסגרה לפני שנים.',
  kicker: 'מהצוות',
  h1: '{first}, הערה קצרה משולחננו.',
  lede: 'אנחנו קוראים כל תיק שמגיע לתחום שלנו.<br>משפט אחד חוזר יותר מכל משפט אחר.',
  letter: [
    'אנשים שואלים אותנו אם זה כבר מאוחר מדי.',
    'סבא וסבתא כבר אינם.',
    'והניירות הלכו איתם.',
    'המשפחה הפסיקה לדבר על אירופה לפני שני דורות, ולכן כולם הניחו שהדלת נסגרה.',
    'ברוב התיקים שקראנו, היא לא נסגרה.',
    'הכללים בשתי המדינות הורחבו בדיוק בשביל המשפחות האלה, שהרשומות שלהן התפזרו בין ארכיונים וגבולות.',
    'לאתר את הרשומות האלה זו העבודה שלנו, לא שלכם.',
    'מה שאנחנו מבקשים מכם הוא מועט.',
    'ספרו לנו מה שאתם יודעים, גם אם זה רק עיר ושם משפחה, ותנו לאחד מעורכי הדין שלנו לבחון את זה כראוי.',
    'ואם התשובה תתברר כשלילית, תשמעו זאת מאיתנו באותה בהירות.',
  ],
  signed: 'צוות האזרחות',
  firm: 'דקר פקס לוי · תל אביב',
  area2: 'אפשר לראות שם גם את השלב הנוכחי של התיק שלכם.',
};

export const welcome8 = define('welcome', { en, he }, (k, c) => {
  const cm = common(k);
  const signature: Frag = {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr} style="border-top:1px solid #e0d8ca;">
        <tr><td style="padding:18px 0 0 0;${k.ds}">
          <p class="t-ink" style="margin:0 0 2px 0; font-family:${k.SERIF}; font-size:19px; line-height:26px; color:#14202b;">${k.r(c.signed).html}</p>
          <p style="margin:0; font-family:${k.SANS}; font-size:13px; line-height:20px; color:#55606b;">${k.r(c.firm).html}</p>
        </td></tr>
      </table>`,
    text: `${c.signed}\n${c.firm}`,
  };
  return {
    subject: c.subject,
    preheader: c.preheader,
    rows: [
      top(k),
      hero(k, { kicker: c.kicker, h1: k.r(c.h1, k.vars), ledes: [k.r(c.lede)] }),
      section(
        k,
        { bg: 'paper', pad: '36px 44px 34px 44px' },
        ...c.letter.map((line, i) => para(k, k.r(line), { mb: i === c.letter.length - 1 ? 24 : 16 })),
        signature,
      ),
      personalAreaCta(k, { bg: 'stone', p1: cm.areaSaved, p2: c.area2, label: cm.openPortal, noteCls: '' }),
      bottom(k),
    ],
  };
});
