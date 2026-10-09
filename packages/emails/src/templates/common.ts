import {
  cta,
  eyebrow,
  footer,
  h2,
  letterhead,
  note,
  para,
  ruleRow,
  section,
  textLink,
  type Kit,
} from '../kit';
import type { Frag } from '../text';

/** Strings that several emails share (all of it verbatim from the Welcome sources; Hebrew is a translation). */
export const COMMON = {
  en: {
    tagline: 'German & Austrian Citizenship Practice',
    practice: 'German & Austrian citizenship practice · Tel Aviv',
    disclaimer:
      'This message is an initial indication based on the answers you gave, and is not legal advice.<br>Decker Pex Levi does not guarantee eligibility or the granting of citizenship.<br>Every case is assessed on its own records.',
    reason: 'You received this because you asked us to check your eligibility.',
    unsubscribe: 'Unsubscribe',
    teamAlt: "The Decker Pex Levi team at the firm's offices",
    personalArea: 'Your personal area',
    unfinished: 'Anything unfinished is waiting for you inside.',
    noPassword: 'No password needed from this link, and your progress is exactly where you left it.',
    portalLink: 'Open my portal and check my status',
    openPortal: 'Open my portal',
    goPortal: 'Go to my portal',
    continueApp: 'Continue my application',
    checkStatus: 'Check my status',
    uploadDocs: 'Upload my documents',
    addDocs: 'Add my documents',
    bookCall: 'Book my free call',
    peopleEyebrow: 'The people who will handle your case',
    peopleLine: 'Licensed attorneys of the firm, and one of them reads your file personally.',
    faqEyebrow: 'Questions people ask first',
    faqCost: [
      'Nothing at all.',
      'The eligibility check and the call with a lawyer are free, and you see the fee before any work begins.',
      'You pay nothing until we accept your case.',
    ],
    faqWho: [
      'A licensed attorney of the firm, registered with the Israel Bar Association.',
      'They read your file, tell you which route fits your family, and sign the filing.',
    ],
    areaSaved:
      'If your application or documents are part finished, everything you entered is saved in your personal area.',
    areaOpen:
      'If a section of your application is still open, it is saved and waiting in your personal area.',
    areaFile: 'If your file is part finished, your personal area holds everything you have entered so far.',
    areaComplete: 'Open it to complete a section, add a document, or check your status.',
    areaWhenever: 'You can add a document or check your status whenever you like.',
  },
  he: {
    tagline: 'תחום האזרחות הגרמנית והאוסטרית',
    practice: 'תחום האזרחות הגרמנית והאוסטרית · תל אביב',
    disclaimer:
      'הודעה זו היא אינדיקציה ראשונית על סמך התשובות שמסרתם, ואינה ייעוץ משפטי.<br>דקר פקס לוי אינו מתחייב לזכאות או להענקת אזרחות.<br>כל תיק נבחן לגופו, על סמך הרשומות שלו.',
    reason: 'קיבלתם הודעה זו מפני שביקשתם שנבדוק את זכאותכם.',
    unsubscribe: 'הסרה מרשימת התפוצה',
    teamAlt: 'צוות דקר פקס לוי במשרד',
    personalArea: 'האזור האישי שלכם',
    unfinished: 'כל מה שנשאר פתוח מחכה לכם בפנים.',
    noPassword: 'הקישור הזה לא דורש סיסמה, וההתקדמות שלכם ממתינה בדיוק במקום שבו עצרתם.',
    portalLink: 'פתיחת הפורטל ובדיקת הסטטוס שלי',
    openPortal: 'פתיחת הפורטל שלי',
    goPortal: 'לפורטל שלי',
    continueApp: 'להמשך הבקשה שלי',
    checkStatus: 'בדיקת הסטטוס שלי',
    uploadDocs: 'העלאת המסמכים שלי',
    addDocs: 'הוספת המסמכים שלי',
    bookCall: 'קביעת שיחה חינם',
    peopleEyebrow: 'האנשים שיטפלו בתיק שלכם',
    peopleLine: 'עורכי דין מורשים של המשרד, ואחד מהם קורא את התיק שלכם באופן אישי.',
    faqEyebrow: 'השאלות הראשונות שאנשים שואלים',
    faqCost: [
      'אין עלות כלל.',
      'בדיקת הזכאות והשיחה עם עורך דין הן ללא תשלום, ואתם רואים את שכר הטרחה לפני שהעבודה מתחילה.',
      'אתם לא משלמים דבר עד שנקבל את התיק שלכם.',
    ],
    faqWho: [
      'עורך דין מורשה מטעם המשרד, חבר בלשכת עורכי הדין בישראל.',
      'עורך הדין קורא את התיק, אומר לכם איזה מסלול מתאים למשפחה שלכם וחותם על ההגשה.',
    ],
    areaSaved: 'אם הבקשה או המסמכים שלכם מולאו רק בחלקם, כל מה שהזנתם שמור באזור האישי שלכם.',
    areaOpen: 'אם פרק בבקשה שלכם עדיין פתוח, הוא שמור וממתין באזור האישי שלכם.',
    areaFile: 'אם התיק שלכם מולא חלקית, האזור האישי שלכם שומר את כל מה שהזנתם עד כה.',
    areaComplete: 'היכנסו אליו כדי להשלים פרק, להוסיף מסמך או לבדוק את הסטטוס.',
    areaWhenever: 'אפשר להוסיף מסמך או לבדוק את הסטטוס מתי שנוח לכם.',
  },
};

type CommonCopy = (typeof COMMON)['en'];

export const common = (k: Kit): CommonCopy => k.pick(COMMON);

/** Letterhead + brass rule. */
export const top = (k: Kit, tagline?: string): Frag => letterhead(k, tagline ?? common(k).tagline);

/** The Welcome footer with the unsubscribe link. */
export function bottom(k: Kit): Frag {
  const c = common(k);
  return footer(k, {
    practice: c.practice,
    disclaimer: k.r(c.disclaimer),
    reason: k.r(c.reason),
    unsubscribeLabel: c.unsubscribe,
  });
}

/** A question (serif) with its answer lines; `gap` is the space after the last line (26 between questions, none at the end). */
export function faq(k: Kit, q: string, lines: string[], gap: number | null): Frag[] {
  return [
    h2(k, k.r(q), { mb: 8 }),
    ...lines.map((line, i) => {
      const last = i === lines.length - 1;
      return para(k, k.r(line), last ? (gap === null ? { margin: '0' } : { mb: gap }) : { mb: 8 });
    }),
  ];
}

/** "Your personal area" with a text link (Welcome 3, 6, 11, 13): preceded by a hairline, on paper. */
export function personalAreaLink(k: Kit, p1: string, p2: string): Frag[] {
  const c = common(k);
  return [
    ruleRow(1),
    section(
      k,
      { bg: 'paper', pad: '30px 44px 32px 44px' },
      eyebrow(k, k.r(c.personalArea), { mb: 14 }),
      para(k, k.r(p1), { mb: 8 }),
      para(k, k.r(p2), { mb: 10 }),
      textLink(k, k.r(c.portalLink), k.ctx.links.portal),
    ),
  ];
}

/** "Your personal area" with the framed button (most Welcome emails). */
export function personalAreaCta(
  k: Kit,
  o: { bg: 'paper' | 'stone'; p1: string; p2: string; label: string; noteCls?: string },
): Frag {
  const c = common(k);
  return section(
    k,
    { bg: o.bg, pad: '34px 44px 34px 44px' },
    eyebrow(k, k.r(c.personalArea), { mb: 16 }),
    h2(k, k.r(c.unfinished), { mb: 10 }),
    para(k, k.r(o.p1), { mb: 8 }),
    para(k, k.r(o.p2), { mb: 24 }),
    cta(k, { href: k.ctx.links.portal, label: o.label, variant: 'ink' }),
    note(k, k.r(c.noPassword), { mt: 14, cls: o.noteCls }),
  );
}
