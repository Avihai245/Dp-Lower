import { define } from '../doc';
import { bullets, cta, eyebrow, h2, hero, note, para, photoRow, section } from '../kit';
import { bottom, common, faq, top } from './common';
import { reviews } from './reviews';

/** Email 2 of 15 · day 2 · your documents are the last piece. */
const en = {
  subject: 'Your documents are the last piece',
  preheader:
    'Your file is open and waiting on the records. Upload them and a lawyer can review your eligibility.',
  kicker: 'Waiting on your documents',
  h1: '{first}, your file is still open.',
  ledes: [
    'Following your enquiry, your answers are saved and your portal is ready.',
    'Only the documents are missing.',
    'Upload the records you have and we can check your eligibility for you.',
  ],
  heroNote: 'A few minutes, and you can add more later.',
  waitingEyebrow: 'What we are waiting for',
  waiting: [
    'Your ancestor’s birth certificate',
    'Marriage certificates in the family line',
    'Emigration or naturalisation records',
    'Anything showing when and why they left',
    'Your own passport or photo ID',
  ],
  partial: [
    'Partial is fine, and a phone photograph of a document works.',
    'Whatever is missing, we look for in the German and Austrian archives.',
  ],
  q1: 'I only have some of the documents.',
  a1: [
    'Send what you have.',
    'Every record you send narrows the archive search, and the search only starts once something is in your file.',
  ],
  q2: 'Does the review cost anything?',
  q3: 'Who reads what I upload?',
  closing: 'One upload and the review can begin.',
  closingNote: 'Anything you cannot find, we search the archives for.',
};

const he: typeof en = {
  subject: 'המסמכים שלכם הם החלק האחרון',
  preheader: 'התיק שלכם פתוח וממתין לרשומות. העלו אותן ועורך דין יוכל לבדוק את זכאותכם.',
  kicker: 'ממתינים למסמכים שלכם',
  h1: '{first}, התיק שלכם עדיין פתוח.',
  ledes: [
    'בעקבות הפנייה שלכם, התשובות נשמרו והפורטל שלכם מוכן.',
    'חסרים רק המסמכים.',
    'העלו את הרשומות שיש בידיכם ונוכל לבדוק עבורכם את הזכאות.',
  ],
  heroNote: 'כמה דקות בלבד, ואפשר להוסיף עוד בהמשך.',
  waitingEyebrow: 'מה אנחנו מחכים לקבל',
  waiting: [
    'תעודת הלידה של אב קדמון',
    'תעודות נישואין לאורך הקו המשפחתי',
    'רשומות הגירה או התאזרחות',
    'כל דבר שמראה מתי ומדוע עזבו',
    'הדרכון שלכם או תעודה מזהה עם תמונה',
  ],
  partial: [
    'גם חלקי זה בסדר, ותצלום של מסמך בטלפון מספיק.',
    'מה שחסר, אנחנו מחפשים בארכיונים הגרמניים והאוסטריים.',
  ],
  q1: 'יש לי רק חלק מהמסמכים.',
  a1: [
    'שלחו את מה שיש לכם.',
    'כל רשומה שתשלחו מצמצמת את החיפוש בארכיונים, והחיפוש מתחיל רק כשיש משהו בתיק שלכם.',
  ],
  q2: 'האם הבדיקה עולה כסף?',
  q3: 'מי קורא את מה שאני מעלה?',
  closing: 'העלאה אחת והבדיקה יכולה להתחיל.',
  closingNote: 'מה שלא תצליחו למצוא, נחפש בארכיונים.',
};

export const welcome2 = define('welcome', { en, he }, (k, c) => {
  const cm = common(k);
  return {
    subject: c.subject,
    preheader: c.preheader,
    rows: [
      top(k),
      hero(k, {
        kicker: c.kicker,
        h1: k.r(c.h1, k.vars),
        ledes: c.ledes.map((l) => k.r(l)),
        cta: { href: k.ctx.links.portal, label: cm.uploadDocs },
        note: k.r(c.heroNote),
      }),
      photoRow(k, cm.teamAlt),
      section(
        k,
        { bg: 'paper', pad: '24px 44px 36px 44px', cls: 'px pb' },
        eyebrow(k, k.r(cm.peopleEyebrow), { mb: 10 }),
        para(k, k.r(cm.peopleLine), { mb: 26 }),
        eyebrow(k, k.r(c.waitingEyebrow), { mb: 14 }),
        bullets(
          k,
          c.waiting.map((w) => k.r(w)),
          { mb: 20, gap: 7 },
        ),
        para(k, k.r(c.partial[0]!), { mb: 8 }),
        para(k, k.r(c.partial[1]!), { margin: '0' }),
      ),
      ...reviews(k),
      section(
        k,
        { bg: 'stone', pad: '34px 44px 32px 44px' },
        eyebrow(k, k.r(cm.faqEyebrow), { mb: 20 }),
        ...faq(k, c.q1, c.a1, 26),
        ...faq(k, c.q2, cm.faqCost, 26),
        ...faq(k, c.q3, cm.faqWho, null),
      ),
      section(
        k,
        { bg: 'paper', pad: '36px 44px 40px 44px', center: true },
        h2(k, k.r(c.closing), { mb: 20, size: 22 }),
        cta(k, { href: k.ctx.links.portal, label: cm.uploadDocs, variant: 'ink', center: true }),
        note(k, k.r(c.closingNote), { mt: 16, color: '#6f7a85' }),
      ),
      bottom(k),
    ],
  };
});
