import { define } from '../doc';
import { eyebrow, hero, para, section, type Kit } from '../kit';
import { bottom, common, personalAreaCta, top } from './common';
import type { Frag } from '../text';

type Variant = 'both' | 'germany' | 'austria';

interface Intro {
  subject: string;
  preheader: string;
  kicker: string;
  h1: string;
  ledes: string[];
  eyebrow: string;
}

interface Card {
  title: string;
  sub: string;
  points: string[];
}

/**
 * Email 15 of 15 · day 46 · Germany or Austria. The source shows both laws side by side ("both" and not sure);
 * a lead who chose one route sees just that law's card, with the introduction reduced to that law.
 */
const en = {
  intro: {
    both: {
      subject: 'The two routes, side by side',
      preheader: 'Two laws, two family histories. A short look at which one fits yours.',
      kicker: 'How the two laws differ',
      h1: '{first}, the two routes, side by side.',
      ledes: [
        'Germany and Austria each restored citizenship to the descendants of people who were driven out.',
        'The laws are separate, and they ask for different records.<br>Here is each one in plain terms, so you can see where your own family sits.',
      ],
      eyebrow: 'The difference in plain terms',
    },
    germany: {
      subject: 'The German route, in plain terms',
      preheader: 'A short look at how the German law applies to families like yours.',
      kicker: 'How the German law works',
      h1: '{first}, your route, in plain terms.',
      ledes: [
        'Germany restored citizenship to the descendants of people who were driven out.',
        'The law asks for specific records.<br>Here it is in plain terms, so you can see where your own family sits.',
      ],
      eyebrow: 'The law in plain terms',
    },
    austria: {
      subject: 'The Austrian route, in plain terms',
      preheader: 'A short look at how the Austrian law applies to families like yours.',
      kicker: 'How the Austrian law works',
      h1: '{first}, your route, in plain terms.',
      ledes: [
        'Austria restored citizenship to the descendants of people who were driven out.',
        'The law asks for specific records.<br>Here it is in plain terms, so you can see where your own family sits.',
      ],
      eyebrow: 'The law in plain terms',
    },
  } satisfies Record<Variant, Intro>,
  germany: {
    title: 'Germany',
    sub: 'Article 116 & <ltr>StAG</ltr>',
    points: ['An ancestor who lost citizenship between 1933 and 1945', 'Open across generations', 'No language test', 'No need to live in Germany'],
  } satisfies Card,
  austria: {
    title: 'Austria',
    sub: 'Section 58c',
    points: ['An ancestor who left because of persecution', 'Reaches direct descendants', 'Turns on when and why they left', 'Archive work matters most here'],
  } satisfies Card,
  both: ['Some families have a line on each side.', 'When that happens we look at both before recommending one, because the stronger claim is not always the one people expect.'],
  area1: 'If you started the questionnaire and stopped partway, or a form is still half finished, you can pick it up in your personal area.',
  area2: 'The current status of your case is shown there as well.',
};

const he: typeof en = {
  intro: {
    both: {
      subject: 'שני המסלולים, זה לצד זה',
      preheader: 'שני חוקים, שתי היסטוריות משפחתיות. מבט קצר על מה שמתאים לשלכם.',
      kicker: 'במה שני החוקים שונים',
      h1: '{first}, שני המסלולים, זה לצד זה.',
      ledes: [
        'גרמניה ואוסטריה השיבו כל אחת אזרחות לצאצאיהם של אנשים שגורשו.',
        'החוקים נפרדים, והם דורשים רשומות שונות.<br>הנה כל אחד מהם בפשטות, כדי שתוכלו לראות איפה המשפחה שלכם עומדת.',
      ],
      eyebrow: 'ההבדל בפשטות',
    },
    germany: {
      subject: 'המסלול הגרמני, בפשטות',
      preheader: 'מבט קצר על האופן שבו החוק הגרמני חל על משפחות כמו שלכם.',
      kicker: 'איך עובד החוק הגרמני',
      h1: '{first}, המסלול שלכם בפשטות.',
      ledes: [
        'גרמניה השיבה אזרחות לצאצאיהם של אנשים שגורשו.',
        'החוק דורש רשומות מסוימות.<br>הנה הוא בפשטות, כדי שתוכלו לראות איפה המשפחה שלכם עומדת.',
      ],
      eyebrow: 'החוק בפשטות',
    },
    austria: {
      subject: 'המסלול האוסטרי, בפשטות',
      preheader: 'מבט קצר על האופן שבו החוק האוסטרי חל על משפחות כמו שלכם.',
      kicker: 'איך עובד החוק האוסטרי',
      h1: '{first}, המסלול שלכם בפשטות.',
      ledes: [
        'אוסטריה השיבה אזרחות לצאצאיהם של אנשים שגורשו.',
        'החוק דורש רשומות מסוימות.<br>הנה הוא בפשטות, כדי שתוכלו לראות איפה המשפחה שלכם עומדת.',
      ],
      eyebrow: 'החוק בפשטות',
    },
  },
  germany: {
    title: 'גרמניה',
    sub: 'סעיף 116 ו‑<ltr>StAG</ltr>',
    points: ['אב קדמון שאזרחותו נשללה בין 1933 ל‑1945', 'פתוח לאורך דורות', 'אין מבחן שפה', 'אין צורך לגור בגרמניה'],
  },
  austria: {
    title: 'אוסטריה',
    sub: 'סעיף 58c',
    points: ['אב קדמון שעזב בשל רדיפה', 'מגיע לצאצאים ישירים', 'תלוי במועד ובסיבת העזיבה', 'העבודה בארכיונים חשובה כאן יותר מכול'],
  },
  both: ['יש משפחות שיש להן קו משפחתי משני הצדדים.', 'במקרה כזה אנחנו בוחנים את שניהם לפני שממליצים על אחד, כי הטענה החזקה יותר אינה תמיד זו שאנשים מצפים לה.'],
  area1: 'אם התחלתם את השאלון ועצרתם באמצע, או שטופס עדיין מולא רק בחציו, אפשר להמשיך מאותה נקודה באזור האישי שלכם.',
  area2: 'גם הסטטוס הנוכחי של התיק שלכם מוצג שם.',
};

/** Which law(s) the email shows: the lead's chosen route, "both" for both and for not sure. */
export const variantOf = (route: string | null): Variant => (route === 'germany' || route === 'austria' ? route : 'both');

/** One law's card. */
function lawCard(k: Kit, c: Card): Frag {
  const rows = c.points
    .map((p, i) => {
      const last = i === c.points.length - 1;
      return `                  <tr><td class="body t-body" style="padding:${last ? '0' : '0 0 7px 0'}; font-family:${k.SANS}; font-size:15.5px; line-height:25px; color:#3f4b56;${k.ds}"><span style="color:#a07a3c; font-size:11px;">&#9642;</span> &nbsp;${k.r(p).html}</td></tr>`;
    })
    .join('\n');
  const sub = k.r(c.sub);
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr} style="border:1px solid #e0d8ca;">
              <tr><td style="padding:20px 20px 22px 20px;${k.ds}">
                <p class="display t-ink" style="margin:0 0 4px 0; font-family:${k.SERIF}; font-size:30px; line-height:34px; color:#14202b;">${k.r(c.title).html}</p>
                <p style="margin:0 0 16px 0; font-family:${k.SANS}; font-size:10px; ${k.caps('0.18em')}color:#7a5c2c;">${sub.html}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr}>
${rows}
                </table>
              </td></tr>
            </table>`,
    text: `${k.r(c.title).text} (${sub.text})\n${c.points.map((p) => `- ${k.r(p).text}`).join('\n')}`,
  };
}

export const welcome15 = define('welcome', { en, he }, (k, c) => {
  const cm = common(k);
  const variant = variantOf(k.ctx.lead.route);
  const intro = c.intro[variant];
  const cards: Frag =
    variant === 'both'
      ? {
          html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr}>
        <tr>
          <td class="stack" width="50%" valign="top" style="${k.pad('0', '10px', '0', '0')}">
            ${lawCard(k, c.germany).html}
          </td>
          <td class="stack" width="50%" valign="top" style="${k.pad('0', '0', '0', '10px')}">
            ${lawCard(k, c.austria).html}
          </td>
        </tr>
      </table>`,
          text: `${lawCard(k, c.germany).text}\n\n${lawCard(k, c.austria).text}`,
        }
      : lawCard(k, variant === 'germany' ? c.germany : c.austria);
  return {
    subject: intro.subject,
    preheader: intro.preheader,
    rows: [
      top(k),
      hero(k, { kicker: intro.kicker, h1: k.r(intro.h1, k.vars), ledes: intro.ledes.map((l) => k.r(l)) }),
      section(k, { bg: 'paper', pad: '34px 44px 10px 44px', cls: 'px pt' }, eyebrow(k, k.r(intro.eyebrow), { mb: 18 })),
      section(k, { bg: 'paper', pad: '0 44px 10px 44px', cls: 'px' }, cards),
      section(
        k,
        { bg: 'paper', pad: '18px 44px 32px 44px', cls: 'px pb' },
        para(k, k.r(c.both[0]!), { mb: 8 }),
        para(k, k.r(c.both[1]!), { mb: '0px' }),
      ),
      personalAreaCta(k, { bg: 'stone', p1: c.area1, p2: c.area2, label: cm.openPortal }),
      bottom(k),
    ],
  };
});
