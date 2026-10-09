import { docRejectedData, docRequestData, statusData } from '../data';
import { define } from '../doc';
import { eyebrow, hero, items, para, plate, section, steps } from '../kit';
import { docText, routeLabel, STATUS_HELP, STATUS_LABELS } from '../labels';
import { lit, ltr } from '../text';
import { common, top } from './common';
import { actionBand, noteQuote, txFooter } from './tx';

/** status-update: the team changed the status shown to the applicant (status labels as in the prototype and the portal). */
const statusEn = {
  subject: 'Your case status: {status}',
  kicker: 'Case update',
  h1: '{first}, there is an update on your case.',
  lede: 'Your case status is now {status}.',
  plateTitle: 'Your case, as it stands',
  plateRef: 'Ref {ref}',
  rowStatus: 'Status',
  rowRoute: 'Family connection',
  cta: 'Check my status',
  note: 'Your portal always shows the current stage of your case.',
  reason: 'You received this because the status of your case was updated.',
};

const statusHe: typeof statusEn = {
  subject: 'סטטוס התיק שלכם: {status}',
  kicker: 'עדכון בתיק',
  h1: '{first}, יש עדכון בתיק שלכם.',
  lede: 'סטטוס התיק שלכם הוא עכשיו: {status}.',
  plateTitle: 'התיק שלכם, כפי שהוא עומד',
  plateRef: 'תיק {ref}',
  rowStatus: 'סטטוס',
  rowRoute: 'קשר משפחתי',
  cta: 'בדיקת הסטטוס שלי',
  note: 'הפורטל מציג תמיד את השלב הנוכחי של התיק שלכם.',
  reason: 'קיבלתם הודעה זו מפני שהסטטוס של התיק שלכם עודכן.',
};

export const statusUpdate = define('welcome', { en: statusEn, he: statusHe }, (k, c) => {
  const { status } = statusData(k.ctx);
  const label = STATUS_LABELS[k.locale][status];
  const help = STATUS_HELP[k.locale][status];
  const ref = k.ctx.lead.caseRef;
  return {
    subject: k.t(c.subject, { status: label }),
    preheader: help,
    rows: [
      top(k),
      hero(k, { kicker: c.kicker, h1: k.r(c.h1, k.vars), ledes: [k.r(c.lede, { status: label })] }),
      section(
        k,
        { bg: 'paper', pad: '34px 44px 8px 44px', cls: 'px pt' },
        plate(k, {
          title: k.r(c.plateTitle),
          right: ref ? k.r(c.plateRef, { ref: ltr(ref) }) : undefined,
          rows: [
            { label: k.r(c.rowStatus), value: k.r(label), tone: 'brass' },
            { label: k.r(c.rowRoute), value: k.r(routeLabel(k.locale, k.ctx.lead.route)) },
          ],
        }),
      ),
      section(k, { bg: 'paper', pad: '24px 44px 0 44px', cls: 'px' }, para(k, k.r(help), { mb: '0px' })),
      actionBand(k, { href: k.ctx.links.portal, label: c.cta, note: c.note }),
      txFooter(k, { reason: c.reason, legal: true }),
    ],
  };
});

/** document-requested: the team asked for specific documents (titles and explanations are the portal's document slots). */
const requestedEn = {
  subject: 'Documents we need for your case',
  preheader: 'Upload them from your portal. A phone photograph of a document works.',
  kicker: 'Documents',
  h1: '{first}, we need a few documents.',
  ledes: [
    'Your file is open and waiting on the records below.',
    'Partial is fine, and a phone photograph of a document works.',
  ],
  eyebrow: 'What we are waiting for',
  none: 'Open your portal to see exactly what is outstanding.',
  cta: 'Upload my documents',
  note: 'Anything you cannot find, we search the archives for.',
  reason: 'You received this because we asked for documents for your case.',
};

const requestedHe: typeof requestedEn = {
  subject: 'מסמכים שאנחנו צריכים עבור התיק שלכם',
  preheader: 'העלו אותם מהפורטל. תצלום של מסמך בטלפון מספיק.',
  kicker: 'מסמכים',
  h1: '{first}, אנחנו צריכים כמה מסמכים.',
  ledes: ['התיק שלכם פתוח וממתין לרשומות שלהלן.', 'גם חלקי זה בסדר, ותצלום של מסמך בטלפון מספיק.'],
  eyebrow: 'מה אנחנו מחכים לקבל',
  none: 'היכנסו לפורטל כדי לראות בדיוק מה נותר.',
  cta: 'העלאת המסמכים שלי',
  note: 'מה שלא תצליחו למצוא, נחפש בארכיונים.',
  reason: 'קיבלתם הודעה זו מפני שביקשנו מסמכים עבור התיק שלכם.',
};

export const documentRequested = define('welcome', { en: requestedEn, he: requestedHe }, (k, c) => {
  const { docTypes } = docRequestData(k.ctx);
  const list = docTypes.map((t) => docText(k.locale, t));
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
        list.length > 0
          ? items(
              k,
              list.map((d) => ({ title: lit(d.title), body: lit(d.help) })),
            )
          : para(k, k.r(c.none), { mb: '0px' }),
      ),
      actionBand(k, { href: k.ctx.links.portal, label: c.cta, note: c.note }),
      txFooter(k, { reason: c.reason, legal: true }),
    ],
  };
});

/** document-rejected: one uploaded file needs another look; the reviewer's note (free text) is shown escaped. */
const rejectedEn = {
  subject: 'One document needs another look',
  preheader: 'A new copy is needed: {doc}.',
  kicker: 'Document review',
  h1: '{first}, one document needs another look.',
  ledes: [
    'We reviewed the document below and need a new copy of it.',
    'Partial is fine, and a phone photograph of a document works.',
  ],
  docEyebrow: 'The document',
  noteEyebrow: 'A note from our team',
  cta: 'Upload a new copy',
  note: 'Anything you cannot find, we search the archives for.',
  reason: 'You received this because a document you uploaded needs another look.',
};

const rejectedHe: typeof rejectedEn = {
  subject: 'מסמך אחד דורש בדיקה נוספת',
  preheader: 'נדרש עותק חדש של: {doc}.',
  kicker: 'בדיקת מסמכים',
  h1: '{first}, מסמך אחד דורש בדיקה נוספת.',
  ledes: [
    'בדקנו את המסמך שלהלן ואנחנו זקוקים לעותק חדש שלו.',
    'גם חלקי זה בסדר, ותצלום של מסמך בטלפון מספיק.',
  ],
  docEyebrow: 'המסמך',
  noteEyebrow: 'הערה מהצוות שלנו',
  cta: 'העלאת עותק חדש',
  note: 'מה שלא תצליחו למצוא, נחפש בארכיונים.',
  reason: 'קיבלתם הודעה זו מפני שמסמך שהעליתם דורש בדיקה נוספת.',
};

export const documentRejected = define('welcome', { en: rejectedEn, he: rejectedHe }, (k, c) => {
  const { docType, note: reviewNote } = docRejectedData(k.ctx);
  const doc = docText(k.locale, docType);
  return {
    subject: c.subject,
    preheader: k.t(c.preheader, { doc: doc.title }),
    rows: [
      top(k),
      hero(k, { kicker: c.kicker, h1: k.r(c.h1, k.vars), ledes: c.ledes.map((l) => k.r(l)) }),
      section(
        k,
        {
          bg: 'stone',
          pad: reviewNote ? '34px 44px 26px 44px' : '34px 44px 34px 44px',
          cls: reviewNote ? 'px pt' : 'px pt pb',
        },
        eyebrow(k, k.r(c.docEyebrow), { mb: 20 }),
        items(k, [{ title: lit(doc.title), body: lit(doc.help) }]),
      ),
      ...(reviewNote
        ? [
            section(
              k,
              { bg: 'stone', pad: '0px 44px 34px 44px', cls: 'px pb' },
              eyebrow(k, k.r(c.noteEyebrow), { mb: 14 }),
              noteQuote(k, lit(reviewNote)),
            ),
          ]
        : []),
      actionBand(k, { href: k.ctx.links.portal, label: c.cta, note: c.note }),
      txFooter(k, { reason: c.reason, legal: true }),
    ],
  };
});

/** application-received: confirmation after the application is submitted (what happens next: the prototype's "after submit" copy). */
const receivedEn = {
  subject: 'We have your application',
  preheader: 'Here is what happens next, and where you can follow it.',
  kicker: 'Application submitted',
  h1: '{first}, your application is with us.',
  ledes: [
    'Case {ref} · Decker Pex Levi is handling your application.',
    'You can follow every stage yourself.',
  ],
  eyebrow: 'What happens next',
  steps: [
    '<b>We check what you sent.</b> A case manager confirms the records are readable and tells you if anything is missing.',
    '<b>A lawyer reviews the case.</b> You get a written assessment of your route and the records still needed.',
    '<b>We contact you.</b> By email first, at the address you registered with. Replies within two business days.',
  ],
  cta: 'Check my status',
  note: 'Status updates for this case are emailed to you, and your portal always shows the current stage.',
  reason: 'You received this because you submitted your application.',
};

const receivedHe: typeof receivedEn = {
  subject: 'הבקשה שלכם התקבלה אצלנו',
  preheader: 'הנה מה שקורה בהמשך, והמקום שבו אפשר לעקוב.',
  kicker: 'הבקשה הוגשה',
  h1: '{first}, הבקשה שלכם אצלנו.',
  ledes: ['תיק {ref} · דקר פקס לוי מטפל בבקשה שלכם.', 'אתם יכולים לעקוב בעצמכם אחרי כל שלב.'],
  eyebrow: 'מה קורה בהמשך',
  steps: [
    '<b>אנחנו בודקים את מה ששלחתם.</b> מנהל תיק מוודא שהרשומות קריאות ומודיע לכם אם משהו חסר.',
    '<b>עורך דין בוחן את התיק.</b> אתם מקבלים הערכה בכתב של המסלול שלכם ושל הרשומות שעדיין נדרשות.',
    '<b>אנחנו יוצרים איתכם קשר.</b> קודם כול במייל, בכתובת שאיתה נרשמתם. מענה תוך שני ימי עסקים.',
  ],
  cta: 'בדיקת הסטטוס שלי',
  note: 'עדכוני סטטוס על התיק הזה נשלחים אליכם במייל, והפורטל מציג תמיד את השלב הנוכחי.',
  reason: 'קיבלתם הודעה זו מפני שהגשתם את הבקשה שלכם.',
};

export const applicationReceived = define('welcome', { en: receivedEn, he: receivedHe }, (k, c) => {
  const ref = k.ctx.lead.caseRef ?? '';
  const vars = { ref: ltr(ref) };
  const ledes = ref ? c.ledes.map((l) => k.r(l, vars)) : [k.r(c.ledes[1]!)];
  return {
    subject: c.subject,
    preheader: c.preheader,
    rows: [
      top(k),
      hero(k, { kicker: c.kicker, h1: k.r(c.h1, k.vars), ledes }),
      section(
        k,
        { bg: 'paper', pad: '34px 44px 32px 44px' },
        eyebrow(k, k.r(c.eyebrow), { mb: 22 }),
        steps(
          k,
          c.steps.map((s) => k.r(s)),
        ),
      ),
      actionBand(k, { href: k.ctx.links.portal, label: c.cta, note: c.note }),
      txFooter(k, { reason: c.reason, legal: true }),
    ],
  };
});
