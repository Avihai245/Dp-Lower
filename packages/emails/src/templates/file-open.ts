import { getContent } from '@dpl/i18n';
import { fileOpenData } from '../data';
import { define } from '../doc';
import { alignEnd, eyebrow, pullQuote, plate, steps, type Kit } from '../kit';
import { routeLabel } from '../labels';
import { ea, esc, ltr, safeUrl, type Frag } from '../text';

/**
 * The "Lead Email" design: "your file is open". Sent when the visitor asks for their result by email and when a
 * returning lead needs a fresh link. Dynamic: first name, case reference, route, application and records state.
 */
const en = {
  subject: 'Your German or Austrian citizenship file is open',
  preheader:
    'Your answers are saved. Add your family records and a licensed lawyer starts reading your case, at no cost.',
  tagline: 'German & Austrian Citizenship Practice',
  kicker: 'File opened · awaiting your records',
  h1: 'The hardest part of your case is the part we do for you.',
  p1: '{first}, most families come to us with a story rather than a file. A grandmother’s city. A surname that changed at a border. A date nobody wrote down.',
  p2: 'That is where most people stop, because it feels like you need the documents before you can even ask the question. You do not. Finding birth, marriage and emigration records in German and Austrian archives is our work. Your part takes about twelve minutes.',
  openPortal: 'Open my portal',
  coverNote: 'No card, no fee, no obligation. Everything saves as you go.',
  plateTitle: 'Your file, as it stands',
  plateRef: 'Ref {ref}',
  rows: {
    eligibility: 'Eligibility check',
    family: 'Family connection',
    application: 'Application',
    records: 'Records received',
  },
  completed: 'Completed',
  application: { not_started: 'Not yet started', in_progress: 'In progress', complete: 'Completed' },
  recordsNone: 'None yet',
  recordsSome: '{n} of {total}',
  stepsEyebrow: 'What happens when you continue',
  steps: [
    '<b>Your family line, in fifteen short questions.</b> About twelve minutes, saved as you type.',
    '<b>Whatever records you already hold.</b> A photo of a certificate is enough. Anything you cannot find, we search for.',
    '<b>A licensed lawyer reads your case</b> and writes back with your route, the records it needs and a realistic timeline.',
  ],
  whyNow: [
    {
      title: 'Archives are the slow part, not you',
      body: 'A request to a German or Austrian registry takes weeks to come back. That clock starts the day your details reach us, not the day you decide.',
    },
    {
      title: 'Your discount stays reserved',
      body: 'Up to <ltr>30%</ltr> off the professional handling of your case is held while your application is open, and applies only if we take the case on.',
    },
  ],
  quote:
    '“My family had very limited information about my grandfather’s life in Germany, so I assumed the process would be almost impossible. They helped us understand what was missing and how to move forward.”',
  quoteBy: '<ltr>Rachel Hoffman</ltr> · ★★★★★ 4.9 average across <ltr>380+</ltr> reviews',
  teamEyebrow: 'Who reads your case',
  teamTitle: 'The people who will handle your file',
  teamText:
    'Licensed attorneys, not agents. Every case is prepared and signed by a lawyer registered with the Israel Bar Association.',
  teamAlt: "The Decker Pex Levi team at the firm's offices in Tel Aviv",
  teamNames: 'Anat Levi · Michael Decker · Yehoshua Pex',
  teamBody:
    'Decker Pex Levi, Tel Aviv. The citizenship practice sits inside a full-service firm, so a case that turns into a consular appeal stays in the same building. Ranked among Israel’s leading immigration firms, <ltr>Dun’s 100, 2026</ltr>.',
  faqEyebrow: 'Before you start',
  faqTitle: 'Questions people ask us first',
  faq: [
    {
      q: 'I have no documents at all. Is it worth continuing?',
      a: 'Yes. Most families start with nothing but a name and a country. We search the German and Austrian registries and state archives for the records, including files families believed were lost.',
    },
    {
      q: 'Does adding my information commit me to anything?',
      a: 'No. Completing the application and uploading records costs nothing and carries no obligation. You see the fee before any paid work begins, and you decide then.',
    },
    {
      q: 'We were told years ago that we did not qualify.',
      a: 'That may no longer hold. Both the German and Austrian provisions widened in recent years, and families refused under the older rules are often eligible now.',
    },
    {
      q: 'Who sees what I upload?',
      a: 'Only the lawyers and case managers working on your file. Your documents are held confidentially by the firm and removed on request.',
    },
    {
      q: 'How long does a case take?',
      a: 'It depends on the archives and the consulate, not on us. After reading your file, a lawyer gives you a realistic timeline for your route rather than an average.',
    },
  ],
  closing: 'Your file is already open.<br>It just needs you.',
  closingText: 'Twelve minutes now, and a lawyer can start reading your case this week.',
  continueApp: 'Continue my application',
  closingNote: 'Or reply to this email and a case manager will answer.',
  footerPractice:
    'German & Austrian citizenship practice. This email is an initial indication based on the answers you gave and is not legal advice. Decker Pex Levi does not guarantee eligibility or the granting of citizenship. Every case is assessed on its own records.',
  footerReason: 'You are receiving this because you checked your eligibility on our site.',
  unsubscribe: 'Unsubscribe',
  privacy: 'Privacy',
  credit: 'Site developed by {sabatier} · AI Digital Marketing Solutions',
};

const he: typeof en = {
  subject: 'תיק האזרחות הגרמנית או האוסטרית שלכם נפתח',
  preheader: 'התשובות שלכם נשמרו. הוסיפו את רשומות המשפחה ועורך דין מורשה יתחיל לקרוא את התיק, ללא עלות.',
  tagline: 'תחום האזרחות הגרמנית והאוסטרית',
  kicker: 'התיק נפתח · ממתינים לרשומות שלכם',
  h1: 'החלק הקשה ביותר בתיק שלכם הוא החלק שאנחנו עושים בשבילכם.',
  p1: '{first}, רוב המשפחות מגיעות אלינו עם סיפור ולא עם תיק. עיר של סבתא. שם משפחה ששונה בגבול. תאריך שאף אחד לא רשם.',
  p2: 'כאן רוב האנשים עוצרים, כי נדמה שצריך את המסמכים עוד לפני שאפשר בכלל לשאול את השאלה. אין צורך. לאתר רשומות לידה, נישואין והגירה בארכיונים גרמניים ואוסטריים זו העבודה שלנו. החלק שלכם לוקח כשתים עשרה דקות.',
  openPortal: 'פתיחת הפורטל שלי',
  coverNote: 'ללא כרטיס אשראי, ללא תשלום וללא התחייבות. הכול נשמר תוך כדי עבודה.',
  plateTitle: 'התיק שלכם, כפי שהוא עומד',
  plateRef: 'תיק {ref}',
  rows: { eligibility: 'בדיקת זכאות', family: 'קשר משפחתי', application: 'הבקשה', records: 'רשומות שהתקבלו' },
  completed: 'הושלמה',
  application: { not_started: 'טרם התחילה', in_progress: 'בתהליך', complete: 'הושלמה' },
  recordsNone: 'עדיין אין',
  recordsSome: '{n} מתוך {total}',
  stepsEyebrow: 'מה קורה כשממשיכים',
  steps: [
    '<b>הקו המשפחתי שלכם, בחמש עשרה שאלות קצרות.</b> כשתים עשרה דקות, והכול נשמר תוך כדי הקלדה.',
    '<b>כל הרשומות שכבר יש בידיכם.</b> תצלום של תעודה מספיק. מה שלא תמצאו, אנחנו נחפש.',
    '<b>עורך דין מורשה קורא את התיק שלכם</b> וכותב לכם בחזרה עם המסלול שלכם, הרשומות הנדרשות ולוח זמנים ריאלי.',
  ],
  whyNow: [
    {
      title: 'הארכיונים הם החלק האיטי, לא אתם',
      body: 'בקשה למרשם גרמני או אוסטרי חוזרת תוך שבועות. השעון הזה מתחיל ביום שבו הפרטים שלכם מגיעים אלינו, לא ביום שבו אתם מחליטים.',
    },
    {
      title: 'ההנחה שלכם שמורה',
      body: 'הנחה של עד <ltr>30%</ltr> על שכר הטיפול המקצועי בתיק שלכם נשמרת כל עוד הבקשה שלכם פתוחה, ותחול רק אם נקבל את התיק.',
    },
  ],
  quote:
    '„למשפחה שלי היה מעט מאוד מידע על חייו של סבי בגרמניה, ולכן הנחתי שהתהליך כמעט בלתי אפשרי. הם עזרו לנו להבין מה חסר ואיך מתקדמים.”',
  quoteBy: '<ltr>Rachel Hoffman</ltr> · ★★★★★ ממוצע 4.9 על פני <ltr>380+</ltr> ביקורות',
  teamEyebrow: 'מי קורא את התיק שלכם',
  teamTitle: 'האנשים שיטפלו בתיק שלכם',
  teamText: 'עורכי דין מורשים, לא סוכנים. כל תיק מוכן וחתום בידי עורך דין החבר בלשכת עורכי הדין בישראל.',
  teamAlt: 'צוות דקר פקס לוי במשרד בתל אביב',
  teamNames: 'ענת לוי · מיכאל דקר · יהושע פקס',
  teamBody:
    'דקר פקס לוי, תל אביב. תחום האזרחות פועל בתוך משרד מלא שירות, ולכן תיק שהופך לערעור קונסולרי נשאר באותו בניין. מדורג בין משרדי ההגירה המובילים בישראל, <ltr>Dun’s 100, 2026</ltr>.',
  faqEyebrow: 'לפני שמתחילים',
  faqTitle: 'שאלות שאנשים שואלים אותנו קודם',
  faq: [
    {
      q: 'אין לי מסמכים בכלל. האם כדאי להמשיך?',
      a: 'כן. רוב המשפחות מתחילות עם שם ומדינה בלבד. אנחנו מחפשים את הרשומות במרשמים ובארכיוני המדינה בגרמניה ובאוסטריה, כולל תיקים שמשפחות האמינו שאבדו.',
    },
    {
      q: 'האם הוספת המידע שלי מחייבת אותי במשהו?',
      a: 'לא. מילוי הבקשה והעלאת הרשומות אינם עולים כסף ואינם מחייבים. אתם רואים את שכר הטרחה לפני שמתחילה כל עבודה בתשלום, ואז אתם מחליטים.',
    },
    {
      q: 'נאמר לנו לפני שנים שאיננו זכאים.',
      a: 'ייתכן שזה כבר לא נכון. ההוראות הגרמניות והאוסטריות הורחבו בשנים האחרונות, ומשפחות שנדחו לפי הכללים הישנים זכאיות לעיתים קרובות כיום.',
    },
    {
      q: 'מי רואה את מה שאני מעלה?',
      a: 'רק עורכי הדין ומנהלי התיקים שעובדים על התיק שלכם. המסמכים שלכם נשמרים בסודיות במשרד ונמחקים לפי בקשה.',
    },
    {
      q: 'כמה זמן לוקח תיק?',
      a: 'זה תלוי בארכיונים ובקונסוליה, לא בנו. לאחר שקרא את התיק שלכם, עורך דין נותן לכם לוח זמנים ריאלי למסלול שלכם ולא ממוצע.',
    },
  ],
  closing: 'התיק שלכם כבר פתוח.<br>הוא רק צריך אתכם.',
  closingText: 'שתים עשרה דקות עכשיו, ועורך דין יכול להתחיל לקרוא את התיק כבר השבוע.',
  continueApp: 'להמשך הבקשה שלי',
  closingNote: 'או השיבו להודעה זו, ומנהל תיק יענה.',
  footerPractice:
    'תחום האזרחות הגרמנית והאוסטרית. הודעה זו היא אינדיקציה ראשונית על סמך התשובות שמסרתם ואינה ייעוץ משפטי. דקר פקס לוי אינו מתחייב לזכאות או להענקת אזרחות. כל תיק נבחן לגופו, על סמך הרשומות שלו.',
  footerReason: 'קיבלתם הודעה זו מפני שבדקתם את זכאותכם באתר שלנו.',
  unsubscribe: 'הסרה מרשימת התפוצה',
  privacy: 'פרטיות',
  credit: 'האתר פותח על ידי {sabatier} · פתרונות שיווק דיגיטלי מבוססי AI',
};

const LINK = 'color:#7a5c2c; text-decoration:underline;';

/** One band of the sheet: `px` padding, no background. */
function band(k: Kit, pad: string, ...children: Frag[]): Frag {
  const [t, r, b, l] = pad.split(' ') as [string, string, string, string];
  return {
    html: `
  <tr>
    <td${k.dirAttr} class="px" style="${k.pad(t, r, b, l)}${k.ds}">
      ${children.map((c) => c.html).join('\n      ')}
    </td>
  </tr>
`,
    text: children
      .map((c) => c.text)
      .filter(Boolean)
      .join('\n\n'),
  };
}

export const fileOpen = define('lead', { en, he }, (k, c) => {
  const links = k.ctx.links;
  const data = fileOpenData(k.ctx);
  const ref = k.ctx.lead.caseRef;
  const address = getContent(k.locale).offices[0]?.address.replace(/\.$/, '') ?? '';
  const host = (() => {
    try {
      return new URL(links.booking).host;
    } catch {
      return links.booking;
    }
  })();

  // ── letterhead
  const letterhead: Frag = {
    html: `
  <tr>
    <td align="center"${k.dirAttr} class="px" style="padding:30px 40px 24px 40px; background-color:#f8f5f0;">
      <img src="${esc(links.logo)}" width="210" alt="${esc(k.rtl ? 'דקר פקס לוי' : 'DECKER PEX LEVI')}" style="display:block; border:0; width:210px; max-width:210px; height:auto; font-family:${k.SERIF}; font-size:20px; ${k.track('0.14em')}color:#14202b;">
      <p style="margin:12px 0 0 0; font-family:${k.SANS}; font-size:10px; line-height:15px; ${k.caps('0.24em')}color:#7a5c2c;">${esc(c.tagline)}</p>
    </td>
  </tr>
  <tr><td style="height:2px; background-color:#a07a3c; line-height:2px; font-size:0;">&nbsp;</td></tr>
`,
    text: `${k.rtl ? 'דקר פקס לוי' : 'DECKER PEX LEVI'}\n${c.tagline}`,
  };

  // ── ink cover
  const p1 = k.r(c.p1, k.vars);
  const p2 = k.r(c.p2);
  const h1 = k.r(c.h1);
  const coverTable = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="cta">
        <tr>
          <td bgcolor="#c9a45c" style="padding:17px 36px; background-color:#c9a45c; border-radius:999px;">
            <a href="${ea(links.portal)}" style="display:block; font-family:${k.SANS}; font-size:16px; line-height:20px; font-weight:bold; ${k.caps('0.07em')}color:#14202b; text-decoration:none;">${esc(c.openPortal)}</a>
          </td>
        </tr>
      </table>`;
  const coverButton = k.rtl ? alignEnd(coverTable) : coverTable;
  const cover: Frag = {
    html: `
  <tr>
    <td bgcolor="#14202b"${k.dirAttr} class="px" style="padding:46px 46px 42px 46px; background-color:#14202b;${k.ds}">
      <p style="margin:0 0 22px 0; font-family:${k.SANS}; font-size:10px; line-height:15px; ${k.caps('0.24em')}color:#c9a45c;">${k.r(c.kicker).html}</p>
      <h1 class="h1" style="margin:0 0 22px 0; font-family:${k.SERIF}; font-weight:normal; font-size:40px; line-height:45px; color:#f8f5f0; mso-line-height-rule:exactly;">${h1.html}</h1>
      <p style="margin:0 0 16px 0; font-family:${k.SANS}; font-size:17px; line-height:28px; color:#c5cbd2; mso-line-height-rule:exactly;">${p1.html}</p>
      <p style="margin:0 0 32px 0; font-family:${k.SANS}; font-size:17px; line-height:28px; color:#c5cbd2; mso-line-height-rule:exactly;">${p2.html}</p>
      ${coverButton}
      <p style="margin:16px 0 0 0; font-family:${k.SANS}; font-size:13px; line-height:20px; color:#9aa3ad;">${k.r(c.coverNote).html}</p>
    </td>
  </tr>
`,
    text: [h1.text, p1.text, p2.text, `${c.openPortal}: ${safeUrl(links.portal)}`, c.coverNote].join('\n\n'),
  };

  // ── the file plate
  const appTone = data.applicationState === 'complete' ? 'ink' : 'brass';
  const records =
    data.docsReceived === 0
      ? c.recordsNone
      : k.r(c.recordsSome, { n: String(data.docsReceived), total: String(data.docsTotal) }).text;
  const plateBlock = plate(k, {
    title: k.r(c.plateTitle),
    right: ref ? k.r(c.plateRef, { ref: ltr(ref) }) : undefined,
    rows: [
      { label: k.r(c.rows.eligibility), value: k.r(c.completed) },
      { label: k.r(c.rows.family), value: k.r(routeLabel(k.locale, k.ctx.lead.route)) },
      { label: k.r(c.rows.application), value: k.r(c.application[data.applicationState]), tone: appTone },
      { label: k.r(c.rows.records), value: k.r(records), tone: data.docsReceived === 0 ? 'brass' : 'ink' },
    ],
  });

  // ── what happens next
  const stepsBlock = [
    eyebrow(k, k.r(c.stepsEyebrow), { mb: 18, cls: '' }),
    steps(
      k,
      c.steps.map((s) => k.r(s)),
    ),
  ];

  // ── why now
  const why = c.whyNow.map((w) => ({ title: k.r(w.title), body: k.r(w.body) }));
  const whyBlock: Frag = {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr}>
        <tr>
          <td class="stack" width="50%" valign="top" style="${k.pad('26px', '20px', '0', '0')} border-top:1px solid #ece6dc; font-family:${k.SANS};${k.ds}">
            <p style="margin:0 0 8px 0; font-family:${k.SERIF}; font-size:20px; line-height:26px; color:#14202b;">${why[0]!.title.html}</p>
            <p style="margin:0; font-size:15px; line-height:24px; color:#3d4650;">${why[0]!.body.html}</p>
          </td>
          <td class="stack" width="50%" valign="top" style="${k.pad('26px', '0', '0', '20px')} border-top:1px solid #ece6dc; font-family:${k.SANS};${k.ds}">
            <p style="margin:0 0 8px 0; font-family:${k.SERIF}; font-size:20px; line-height:26px; color:#14202b;">${why[1]!.title.html}</p>
            <p style="margin:0; font-size:15px; line-height:24px; color:#3d4650;">${why[1]!.body.html}</p>
          </td>
        </tr>
      </table>`,
    text: why.map((w) => `${w.title.text}\n${w.body.text}`).join('\n\n'),
  };

  // ── quote
  const by = k.r(c.quoteBy);
  const quote = pullQuote(k, k.r(c.quote), by);

  // ── the team (dark band with the photograph)
  const team: Frag = {
    html: `
  <tr>
    <td style="padding:44px 0 0 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr} bgcolor="#14202b" style="background-color:#14202b;">
        <tr>
          <td class="px" style="padding:40px 46px 26px 46px;${k.ds}">
            <p style="margin:0 0 8px 0; font-family:${k.SANS}; font-size:10px; line-height:15px; ${k.caps('0.2em')}color:#c9a45c;">${k.r(c.teamEyebrow).html}</p>
            <h2 class="h2" style="margin:0 0 12px 0; font-family:${k.SERIF}; font-weight:normal; font-size:28px; line-height:34px; color:#f8f5f0;">${k.r(c.teamTitle).html}</h2>
            <p style="margin:0; font-family:${k.SANS}; font-size:15px; line-height:24px; color:#c5cbd2;">${k.r(c.teamText).html}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 0 0;">
            <img src="${esc(links.teamPhoto)}" width="600" alt="${esc(c.teamAlt)}" style="display:block; border:0; width:100%; max-width:600px; height:auto;">
          </td>
        </tr>
        <tr>
          <td class="px" style="padding:22px 46px 40px 46px;${k.ds}">
            <p style="margin:0 0 6px 0; font-family:${k.SERIF}; font-size:17px; line-height:25px; color:#f8f5f0;">${k.r(c.teamNames).html}</p>
            <p style="margin:0; font-family:${k.SANS}; font-size:14px; line-height:22px; color:#9aa3ad;">${k.r(c.teamBody).html}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
`,
    text: `${c.teamEyebrow.toUpperCase()}\n${c.teamTitle}\n${k.r(c.teamText).text}\n${c.teamNames}\n${k.r(c.teamBody).text}`,
  };

  // ── FAQ
  const faqRows = c.faq
    .map((f, i) => {
      const first = i === 0;
      const last = i === c.faq.length - 1;
      const pad = first ? '22px 0 18px 0' : last ? '18px 0 0 0' : '18px 0';
      return `
        <tr><td style="padding:${pad};${last ? '' : ' border-bottom:1px solid #ece6dc;'} font-family:${k.SANS};${k.ds}">
          <p style="margin:0 0 7px 0; font-family:${k.SERIF}; font-size:19px; line-height:25px; color:#14202b;">${k.r(f.q).html}</p>
          <p style="margin:0; font-size:15px; line-height:24px; color:#3d4650;">${k.r(f.a).html}</p>
        </td></tr>`;
    })
    .join('');
  const faq: Frag[] = [
    eyebrow(k, k.r(c.faqEyebrow), { mb: 8, cls: '' }),
    {
      html: `<h2 class="h2" style="margin:0 0 6px 0; font-family:${k.SERIF}; font-weight:normal; font-size:28px; line-height:34px; color:#14202b;">${k.r(c.faqTitle).html}</h2>`,
      text: c.faqTitle,
    },
    {
      html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr}>${faqRows}
      </table>`,
      text: c.faq.map((f) => `${f.q}\n${f.a}`).join('\n\n'),
    },
  ];

  // ── closing card
  const closing = k.r(c.closing);
  const closingBlock: Frag = {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${k.dirAttr} style="border:1px solid #d8cfc0; background-color:#ffffff;">
        <tr>
          <td align="center" style="padding:36px 30px 34px 30px;">
            <p style="margin:0 0 14px 0; font-family:${k.SERIF}; font-size:27px; line-height:34px; color:#14202b;">${closing.html}</p>
            <p style="margin:0 0 26px 0; font-family:${k.SANS}; font-size:15px; line-height:24px; color:#3d4650;">${k.r(c.closingText).html}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="cta">
              <tr>
                <td bgcolor="#14202b" style="padding:17px 36px; background-color:#14202b; border-radius:999px;">
                  <a href="${ea(links.portal)}" style="display:block; font-family:${k.SANS}; font-size:16px; line-height:20px; font-weight:bold; ${k.caps('0.07em')}color:#f8f5f0; text-decoration:none;">${esc(c.continueApp)}</a>
                </td>
              </tr>
            </table>
            <p style="margin:16px 0 0 0; font-family:${k.SANS}; font-size:13px; line-height:20px; color:#6b6459;">${k.r(c.closingNote).html}</p>
          </td>
        </tr>
      </table>`,
    text: `${closing.text}\n${c.closingText}\n${c.continueApp}: ${safeUrl(links.portal)}\n${c.closingNote}`,
  };

  // ── footer (centred, on a slightly darker paper)
  const unsub = links.unsubscribe
    ? `<a href="${ea(links.unsubscribe)}" style="${LINK}">${esc(c.unsubscribe)}</a> &middot; `
    : '';
  const sabatier =
    '<a href="https://www.instagram.com/sabatier_group_ai_marketing/" style="color:#7a5c2c; text-decoration:underline;">Sabatier Group LLC</a>';
  const credit = k.r(c.credit, { sabatier: 'SABATIER' });
  const footer: Frag = {
    html: `
  <tr>
    <td align="center"${k.dirAttr} class="px" style="padding:30px 46px 36px 46px; border-top:1px solid #ece6dc; background-color:#efe9e0;">
      <p style="margin:0 0 14px 0; font-family:${k.SERIF}; font-size:16px; line-height:22px; ${k.track('0.1em')}color:#14202b; text-align:center;">${k.rtl ? 'דקר פקס לוי' : 'DECKER PEX LEVI'}</p>
      <p style="margin:0 0 12px 0; font-family:${k.SANS}; font-size:12px; line-height:19px; color:#6b6459; text-align:center;">${k.r(c.footerPractice).html}</p>
      <p style="margin:0 0 12px 0; font-family:${k.SANS}; font-size:12px; line-height:19px; color:#6b6459; text-align:center;">${esc(address)} &middot; <a href="${ea(links.booking)}" style="${LINK} white-space:nowrap;">${esc(host)}</a></p>
      <p style="margin:0 0 14px 0; font-family:${k.SANS}; font-size:12px; line-height:19px; color:#6b6459; text-align:center;">${k.r(c.footerReason).html}<br>${unsub}<a href="${ea(links.privacy)}" style="${LINK}">${esc(c.privacy)}</a></p>
      <p style="margin:0; font-family:${k.SANS}; font-size:11px; line-height:18px; color:#6b6459; text-align:center;">${credit.html.replace('SABATIER', sabatier)}</p>
    </td>
  </tr>
`,
    text: [
      '--',
      k.rtl ? 'דקר פקס לוי' : 'DECKER PEX LEVI',
      k.r(c.footerPractice).text,
      `${address} · ${host}`,
      `${c.footerReason}${links.unsubscribe ? ` ${c.unsubscribe}: ${safeUrl(links.unsubscribe)}` : ''} ${c.privacy}: ${safeUrl(links.privacy)}`,
      credit.text.replace('SABATIER', 'Sabatier Group LLC'),
    ].join('\n'),
  };

  return {
    subject: c.subject,
    preheader: c.preheader,
    rows: [
      letterhead,
      cover,
      band(k, '44px 46px 0 46px', plateBlock),
      band(k, '40px 46px 0 46px', ...stepsBlock),
      band(k, '34px 46px 0 46px', whyBlock),
      band(k, '40px 46px 0 46px', quote),
      team,
      band(k, '42px 46px 0 46px', ...faq),
      band(k, '42px 46px 44px 46px', closingBlock),
      footer,
    ],
  };
});
