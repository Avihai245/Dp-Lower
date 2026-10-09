import { eyebrow, ruleRow, section, type Kit } from '../kit';
import type { Frag } from '../text';

/** The three client reviews of Welcome 1 and 2 (placeholder claims, kept exactly as designed). */
interface ReviewsCopy {
  eyebrow: string;
  rating: string;
  list: Array<{ quote: string; by: string }>;
}

const REVIEWS: { en: ReviewsCopy; he: ReviewsCopy } = {
  en: {
    eyebrow: 'What our clients say',
    rating: '4.9 average, 380+ reviews',
    list: [
      {
        quote:
          '“I contacted them because my grandmother was born in Germany and I had no idea whether that could make me eligible for citizenship. They explained everything clearly and helped me understand the process from the very beginning. Excellent experience.”',
        by: '<ltr>Sarah Klein</ltr> · August 5, 2026',
      },
      {
        quote:
          '“My family had very limited information about my grandfather’s life in Germany, so I assumed the process would be almost impossible. They helped us understand what was missing and how to move forward. Their guidance made a huge difference.”',
        by: '<ltr>Rachel Hoffman</ltr> · May 18, 2026',
      },
      {
        quote:
          '“I began this process because I wanted my grandchildren to have the opportunity to study and build a future in Europe if they choose to. Patient, kind, and extremely professional throughout the entire process.”',
        by: '<ltr>Barbara Levine</ltr> · January 12, 2026',
      },
    ],
  },
  he: {
    eyebrow: 'מה אומרים הלקוחות שלנו',
    rating: 'ממוצע 4.9, <ltr>380+</ltr> ביקורות',
    list: [
      {
        quote:
          '„פניתי אליהם כי סבתי נולדה בגרמניה ולא היה לי מושג אם זה יכול לזכות אותי באזרחות. הם הסבירו הכול בבהירות ועזרו לי להבין את התהליך מההתחלה. חוויה מצוינת.”',
        by: '<ltr>Sarah Klein</ltr> · 5 באוגוסט 2026',
      },
      {
        quote:
          '„למשפחה שלי היה מעט מאוד מידע על חייו של סבי בגרמניה, ולכן הנחתי שהתהליך כמעט בלתי אפשרי. הם עזרו לנו להבין מה חסר ואיך מתקדמים. ההכוונה שלהם עשתה הבדל עצום.”',
        by: '<ltr>Rachel Hoffman</ltr> · 18 במאי 2026',
      },
      {
        quote:
          '„התחלתי את התהליך כי רציתי שלנכדים שלי תהיה הזדמנות ללמוד ולבנות עתיד באירופה, אם יבחרו בכך. סבלניים, אדיבים ומקצועיים ביותר לאורך כל התהליך.”',
        by: '<ltr>Barbara Levine</ltr> · 12 בינואר 2026',
      },
    ],
  },
};

/** Welcome 1 and 2: rating line and the three review quotes. */
export function reviews(k: Kit): Frag[] {
  const c = k.pick(REVIEWS);
  const rows = c.list
    .map((r, i) => {
      const last = i === c.list.length - 1;
      return `
        <tr>
          <td class="hair" style="padding:18px 0 ${last ? 22 : 18}px 0; border-top:1px solid #e0d8ca;${k.ds}">
            <p class="quote t-ink" style="margin:0 0 10px 0; font-family:${k.SERIF}; font-size:17px; line-height:28px; color:#14202b; mso-line-height-rule:exactly;">${k.r(r.quote).html}</p>
            <p class="t-mute" style="margin:0; font-family:${k.SANS}; font-size:13px; line-height:20px; color:#6f7a85;">${k.r(r.by).html}</p>
          </td>
        </tr>`;
    })
    .join('');
  const list: Frag = {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr}>${rows}
      </table>`,
    text: c.list.map((r) => `${k.r(r.quote).text}\n${k.r(r.by).text}`).join('\n\n'),
  };
  const rating = k.r(c.rating);
  const stars: Frag = {
    html: `<p class="t-ink" style="margin:0; font-family:${k.SERIF}; font-size:17px; line-height:26px; color:#14202b;"><span class="t-brass" style="color:#c9a45c; letter-spacing:0.08em;">&#9733;&#9733;&#9733;&#9733;&#9733;</span> &nbsp;${rating.html}</p>`,
    text: `★★★★★ ${rating.text}`,
  };
  return [
    ruleRow(1),
    section(k, { bg: 'paper', pad: '34px 44px 14px 44px', cls: 'px pt' }, eyebrow(k, k.r(c.eyebrow), { mb: 6 }), stars),
    section(k, { bg: 'paper', pad: '12px 44px 4px 44px', cls: 'px' }, list),
  ];
}
