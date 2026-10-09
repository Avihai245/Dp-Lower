import { FIRM_TIMEZONE, isValidTimeZone, type DocType, type LeadRoute, type LeadStatus, type Locale } from '@dpl/core';

/** Names of the routes ("Family connection" row of the file plate). */
export const ROUTE_LABELS: Record<Locale, Record<LeadRoute, string>> = {
  en: { germany: 'Germany', austria: 'Austria', both: 'Germany and Austria', unsure: 'Not sure yet' },
  he: { germany: 'גרמניה', austria: 'אוסטריה', both: 'גרמניה ואוסטריה', unsure: 'עדיין לא ברור' },
};

export const routeLabel = (locale: Locale, route: LeadRoute | null): string => ROUTE_LABELS[locale][route ?? 'unsure'];

/**
 * Applicant-facing status labels. English is the wording of the prototype's status control and portal heading
 * ("Application Submitted", "Under Review", ...); Hebrew follows the Lead Flow HE statuses.
 */
export const STATUS_LABELS: Record<Locale, Record<LeadStatus, string>> = {
  en: {
    enquiry: 'Enquiry',
    account_created: 'Account Created',
    application_incomplete: 'Application Incomplete',
    application_submitted: 'Application Submitted',
    under_review: 'Under Review',
    info_required: 'Additional Information Required',
    review_completed: 'Review Completed',
    contacting: 'Contacting Applicant',
  },
  he: {
    enquiry: 'פנייה חדשה',
    account_created: 'נוצר חשבון',
    application_incomplete: 'בקשה חלקית',
    application_submitted: 'הבקשה הוגשה',
    under_review: 'בבדיקה',
    info_required: 'נדרש מידע נוסף',
    review_completed: 'הבדיקה הושלמה',
    contacting: 'יוצרים איתכם קשר',
  },
};

/** One line under the status (what it means for the applicant). Wording reuses the prototype's "what happens next" copy. */
export const STATUS_HELP: Record<Locale, Record<LeadStatus, string>> = {
  en: {
    enquiry: 'We have your details and your answers.',
    account_created: 'Your portal is open.',
    application_incomplete: 'Your application is saved and waiting in your portal.',
    application_submitted: 'A case manager confirms the records are readable and tells you if anything is missing.',
    under_review: 'A lawyer reviews the case. You receive a written assessment of your route and the records still needed.',
    info_required: 'We need something more from you before the review can continue. Your portal shows exactly what is outstanding.',
    review_completed: 'The review of your case is complete. Your portal has the details.',
    contacting: 'We are contacting you about your case, by email first, at the address you registered with.',
  },
  he: {
    enquiry: 'קיבלנו את הפרטים והתשובות שלכם.',
    account_created: 'הפורטל שלכם פתוח.',
    application_incomplete: 'הבקשה שלכם שמורה וממתינה בפורטל.',
    application_submitted: 'מנהל תיק מוודא שהרשומות קריאות ומודיע לכם אם משהו חסר.',
    under_review: 'עורך דין בוחן את התיק. אתם מקבלים הערכה בכתב של המסלול שלכם ושל הרשומות שעדיין נדרשות.',
    info_required: 'אנחנו זקוקים ממכם למידע נוסף כדי שהבדיקה תוכל להמשיך. הפורטל מראה בדיוק מה נותר.',
    review_completed: 'הבדיקה של התיק שלכם הושלמה. הפרטים בפורטל.',
    contacting: 'אנחנו יוצרים איתכם קשר בנוגע לתיק, קודם כול במייל, בכתובת שאיתה נרשמתם.',
  },
};

interface DocText {
  title: string;
  help: string;
}

/**
 * The eight document slots. English is the wording of the portal prototype (DOCS list); Hebrew is a translation of it.
 * Keep in step with the portal's document slot copy.
 */
export const DOC_TEXT: Record<Locale, Record<DocType, DocText>> = {
  en: {
    birth_certificate: {
      title: 'Ancestor’s birth certificate',
      help: 'Establishes their citizenship at birth. The single most important record in your case.',
    },
    marriage_certificates: { title: 'Marriage certificates', help: 'Connects surnames across generations where a name changed.' },
    emigration_naturalization: {
      title: 'Emigration or naturalization records',
      help: 'Shows when and how they left, and when they took a new citizenship.',
    },
    persecution_proof: {
      title: 'Proof of persecution or departure date',
      help: 'Any record placing them outside the country after 1933: a ship manifest, a visa, an affidavit.',
    },
    passport: { title: 'Your passport', help: 'Confirms your identity and current citizenship.' },
    family_tree: { title: 'Family tree or written account', help: 'Your own account of the line. A handwritten note or an email is fine.' },
    photo_id: { title: 'Photo ID for each applicant', help: 'Required for every family member included in the case.' },
    other: { title: 'Any other supporting record', help: 'Letters, photographs, property records, school registers.' },
  },
  he: {
    birth_certificate: { title: 'תעודת הלידה של האב הקדמון', help: 'מוכיחה את אזרחותו בלידה. הרשומה החשובה ביותר בתיק שלכם.' },
    marriage_certificates: { title: 'תעודות נישואין', help: 'מקשרות בין שמות משפחה לאורך הדורות כשהשם השתנה.' },
    emigration_naturalization: { title: 'רשומות הגירה או התאזרחות', help: 'מראות מתי ואיך עזבו, ומתי קיבלו אזרחות חדשה.' },
    persecution_proof: {
      title: 'הוכחת רדיפה או תאריך עזיבה',
      help: 'כל רשומה שממקמת אותם מחוץ למדינה אחרי 1933: רשימת נוסעים בספינה, ויזה, תצהיר.',
    },
    passport: { title: 'הדרכון שלכם', help: 'מאשר את זהותכם ואת אזרחותכם הנוכחית.' },
    family_tree: { title: 'אילן יוחסין או תיאור בכתב', help: 'התיאור שלכם של הקו המשפחתי. פתק בכתב יד או מייל מספיקים.' },
    photo_id: { title: 'תעודה מזהה עם תמונה לכל מבקש', help: 'נדרשת לכל בן משפחה הכלול בתיק.' },
    other: { title: 'כל רשומה תומכת אחרת', help: 'מכתבים, תצלומים, רשומות רכוש, רשומות בית ספר.' },
  },
};

const isDocType = (v: unknown): v is DocType => typeof v === 'string' && v in DOC_TEXT.en;

export const docText = (locale: Locale, type: unknown): DocText =>
  isDocType(type) ? DOC_TEXT[locale][type] : { title: String(type ?? ''), help: '' };

export interface When {
  /** "Wednesday, October 14, 2026" / "יום רביעי, 14 באוקטובר 2026" */
  date: string;
  /** "9:30 AM" / "09:30" */
  time: string;
  /** "EDT", "GMT+3" */
  zone: string;
  /** the zone that was used (invalid input falls back to the firm's) */
  timezone: string;
}

/** Formats an instant in the recipient's time zone and language with Intl. Invalid input never throws. */
export function formatWhen(iso: string, timezone: string | undefined, locale: Locale): When {
  const tz = timezone && isValidTimeZone(timezone) ? timezone : FIRM_TIMEZONE;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { date: iso, time: '', zone: '', timezone: tz };
  const tag = locale === 'he' ? 'he-IL' : 'en-US';
  const date = new Intl.DateTimeFormat(tag, { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(at);
  const timeFmt = new Intl.DateTimeFormat(tag, { timeZone: tz, hour: 'numeric', minute: '2-digit', hourCycle: locale === 'he' ? 'h23' : 'h12', timeZoneName: 'short' });
  const parts = timeFmt.formatToParts(at);
  const zone = (parts.find((p) => p.type === 'timeZoneName')?.value ?? '').replace(/[\u{200e}\u{200f}]/gu, '');
  const time = parts
    .filter((p) => p.type !== 'timeZoneName')
    .map((p) => p.value)
    .join('')
    .trim()
    .replace(/[\u{200e}\u{200f}]/gu, '')
    .replace(/[\u{202f}\u{a0}]/gu, ' ');
  return { date, time, zone, timezone: tz };
}
