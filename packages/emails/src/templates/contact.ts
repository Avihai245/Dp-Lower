import { getContent } from '@dpl/i18n';
import { contactData } from '../data';
import { define } from '../doc';
import { eyebrow, hero, para, section, steps, textLink } from '../kit';
import { firstNameOf } from '@dpl/core';
import { ltr } from '../text';
import { generalTop, txFooter } from './tx';

/**
 * contact-received: acknowledgement for a visitor who sent an enquiry through the firm's website (no lead, no case
 * reference, no unsubscribe). Wording from the main-site prototype's confirmation ("Your enquiry is with us").
 */
const en = {
  subject: 'We have your enquiry',
  preheader: 'An attorney will call you within one business day.',
  kicker: 'Your enquiry',
  h1: '{first}, your enquiry is with us.',
  lede: 'An attorney will call the number you gave within one business day, and this email is your confirmation.',
  eyebrow: 'What happens next',
  steps: [
    '<b>An attorney, not an intake clerk,</b> calls you back within one business day.',
    '<b>You tell the story once.</b> We say plainly whether there is a case, and what it would need.',
    '<b>If we take it on,</b> you know the fee before any work starts.',
  ],
  urgent: 'If your matter is urgent, you can also call us on {tel}.',
  link: 'Contact and offices',
  reason: 'You received this because you sent us an enquiry through our website.',
};

const he: typeof en = {
  subject: 'הפנייה שלכם התקבלה',
  preheader: 'עורך דין יתקשר אליכם בתוך יום עסקים אחד.',
  kicker: 'הפנייה שלכם',
  h1: '{first}, הפנייה שלכם אצלנו.',
  lede: 'עורך דין יתקשר למספר שמסרתם בתוך יום עסקים אחד, והודעה זו היא האישור שלכם.',
  eyebrow: 'מה קורה בהמשך',
  steps: [
    '<b>עורך דין, לא פקיד קבלה,</b> חוזר אליכם בטלפון בתוך יום עסקים אחד.',
    '<b>אתם מספרים את הסיפור פעם אחת.</b> אנחנו אומרים בבירור אם יש תיק, ומה הוא ידרוש.',
    '<b>אם נקבל את התיק,</b> תדעו מה השכר לפני שמתחילה כל עבודה.',
  ],
  urgent: 'אם העניין דחוף, אפשר גם להתקשר אלינו למספר {tel}.',
  link: 'יצירת קשר ומשרדים',
  reason: 'קיבלתם הודעה זו מפני ששלחתם לנו פנייה דרך האתר שלנו.',
};

export const contactReceived = define('welcome', { en, he }, (k, c) => {
  const { name } = contactData(k.ctx);
  const first = firstNameOf(name) || k.first;
  const tel = getContent(k.locale).offices[0]?.tel ?? '';
  return {
    subject: c.subject,
    preheader: c.preheader,
    rows: [
      generalTop(k),
      hero(k, { kicker: c.kicker, h1: k.r(c.h1, { first }), ledes: [k.r(c.lede)] }),
      section(
        k,
        { bg: 'paper', pad: '34px 44px 32px 44px' },
        eyebrow(k, k.r(c.eyebrow), { mb: 22 }),
        steps(k, c.steps.map((s) => k.r(s))),
      ),
      section(
        k,
        { bg: 'stone', pad: '30px 44px 30px 44px' },
        ...(tel ? [para(k, k.r(c.urgent, { tel: ltr(tel) }), { mb: 10 })] : []),
        textLink(k, k.r(c.link), k.ctx.links.portal),
      ),
      txFooter(k, { reason: c.reason, general: true }),
    ],
  };
});
