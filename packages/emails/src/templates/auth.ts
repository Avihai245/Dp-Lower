import { authLinkData, resetData } from '../data';
import { define } from '../doc';
import { hero, section } from '../kit';
import type { AuthLinkKind } from '../types';
import type { Frag } from '../text';
import { ltr } from '../text';
import { top } from './common';
import { fallbackLink, txFooter } from './tx';

/** password-reset: the recovery link from Supabase Auth (wording of the prototype's "Forgot it?" flow). */
const resetEn = {
  subject: 'Set a new password',
  preheader: 'Use the link below to set a new password. It is valid for one hour.',
  kicker: 'Password reset',
  h1: 'Set a new password.',
  ledes: ['{first}, we received a request to set a new password for your portal.', 'Use the secure link below. It is valid for one hour.'],
  cta: 'Set a new password',
  heroNote: 'If you did not ask for this, you can ignore this email. Nothing will change.',
  fallback: 'If the button does not work, copy this address into your browser:',
  reason: 'You received this because a password reset was requested for this email address.',
};

const resetHe: typeof resetEn = {
  subject: 'הגדרת סיסמה חדשה',
  preheader: 'השתמשו בקישור שלהלן כדי להגדיר סיסמה חדשה. הוא תקף לשעה אחת.',
  kicker: 'איפוס סיסמה',
  h1: 'הגדרת סיסמה חדשה.',
  ledes: ['{first}, קיבלנו בקשה להגדיר סיסמה חדשה לפורטל שלכם.', 'השתמשו בקישור המאובטח שלהלן. הוא תקף לשעה אחת.'],
  cta: 'הגדרת סיסמה חדשה',
  heroNote: 'אם לא ביקשתם זאת, אפשר להתעלם מהודעה זו. שום דבר לא ישתנה.',
  fallback: 'אם הכפתור לא עובד, העתיקו את הכתובת הזו לדפדפן:',
  reason: 'קיבלתם הודעה זו מפני שהתבקש איפוס סיסמה עבור כתובת המייל הזו.',
};

export const passwordReset = define('welcome', { en: resetEn, he: resetHe }, (k, c) => {
  const { resetUrl } = resetData(k.ctx);
  return {
    subject: c.subject,
    preheader: c.preheader,
    rows: [
      top(k),
      hero(k, {
        kicker: c.kicker,
        h1: k.r(c.h1),
        ledes: c.ledes.map((l) => k.r(l, k.vars)),
        cta: { href: resetUrl, label: c.cta },
        note: k.r(c.heroNote),
      }),
      section(k, { bg: 'paper', pad: '30px 44px 32px 44px' }, fallbackLink(k, c.fallback, resetUrl)),
      txFooter(k, { reason: c.reason }),
    ],
  };
});

/** auth-link: the other Supabase Auth emails (sign-in link, confirmation of signup / email change, one-time code). */
interface AuthCopy {
  subject: string;
  kicker: string;
  h1: string;
  lede: string;
  cta: string;
  reason: string;
}

const NOTE_IGNORE = {
  en: 'If you did not ask for this, you can ignore this email. Nothing will change.',
  he: 'אם לא ביקשתם זאת, אפשר להתעלם מהודעה זו. שום דבר לא ישתנה.',
};

const AUTH = {
  en: {
    signIn: {
      subject: 'Your sign-in link',
      kicker: 'Sign in',
      h1: 'Sign in to your portal.',
      lede: '{first}, use the secure link below to sign in. It is valid for one hour.',
      cta: 'Sign in',
      reason: 'You received this because someone asked to sign in to the portal with this email address.',
    },
    confirm: {
      subject: 'Confirm your email address',
      kicker: 'Confirm your email',
      h1: 'Confirm your email address.',
      lede: '{first}, confirm this address to finish setting up your portal.',
      cta: 'Confirm my email',
      reason: 'You received this because this email address was used to set up a portal.',
    },
    change: {
      subject: 'Confirm your new email address',
      kicker: 'Email change',
      h1: 'Confirm your new email address.',
      lede: '{first}, confirm this address to use it for your portal from now on.',
      cta: 'Confirm my new email',
      reason: 'You received this because a change of email address was requested for your portal.',
    },
    code: {
      subject: 'Your confirmation code',
      kicker: 'Confirmation code',
      h1: 'Your confirmation code.',
      lede: '{first}, enter this code to confirm that it is you.',
      cta: '',
      reason: 'You received this because a confirmation was requested for your portal.',
    },
    codeIntro: 'Or enter this code:',
    fallback: 'If the button does not work, copy this address into your browser:',
  },
  he: {
    signIn: {
      subject: 'קישור הכניסה שלכם',
      kicker: 'כניסה',
      h1: 'כניסה לפורטל שלכם.',
      lede: '{first}, השתמשו בקישור המאובטח שלהלן כדי להיכנס. הוא תקף לשעה אחת.',
      cta: 'כניסה',
      reason: 'קיבלתם הודעה זו מפני שהתבקשה כניסה לפורטל עם כתובת המייל הזו.',
    },
    confirm: {
      subject: 'אישור כתובת המייל',
      kicker: 'אישור כתובת מייל',
      h1: 'אשרו את כתובת המייל שלכם.',
      lede: '{first}, אשרו את הכתובת הזו כדי להשלים את הגדרת הפורטל שלכם.',
      cta: 'אישור כתובת המייל שלי',
      reason: 'קיבלתם הודעה זו מפני שכתובת המייל הזו שימשה להגדרת פורטל.',
    },
    change: {
      subject: 'אישור כתובת המייל החדשה',
      kicker: 'שינוי כתובת מייל',
      h1: 'אשרו את כתובת המייל החדשה שלכם.',
      lede: '{first}, אשרו את הכתובת הזו כדי להשתמש בה בפורטל מעתה והלאה.',
      cta: 'אישור כתובת המייל החדשה',
      reason: 'קיבלתם הודעה זו מפני שהתבקש שינוי כתובת מייל בפורטל שלכם.',
    },
    code: {
      subject: 'קוד האישור שלכם',
      kicker: 'קוד אישור',
      h1: 'קוד האישור שלכם.',
      lede: '{first}, הזינו את הקוד הזה כדי לאשר שזה אתם.',
      cta: '',
      reason: 'קיבלתם הודעה זו מפני שהתבקש אישור בפורטל שלכם.',
    },
    codeIntro: 'או הזינו את הקוד הזה:',
    fallback: 'אם הכפתור לא עובד, העתיקו את הכתובת הזו לדפדפן:',
  },
};

const KIND_COPY: Record<AuthLinkKind, 'signIn' | 'confirm' | 'change' | 'code'> = {
  magiclink: 'signIn',
  email: 'signIn',
  signup: 'confirm',
  invite: 'confirm',
  email_change: 'change',
  reauthentication: 'code',
};

export const authLink = define('welcome', { en: AUTH.en, he: AUTH.he }, (k, c) => {
  const d = authLinkData(k.ctx);
  const copy: AuthCopy = c[KIND_COPY[d.kind]];
  const ignore = k.pick(NOTE_IGNORE);
  const hasLink = copy.cta !== '' && d.url !== '';
  const code: Frag | null = d.code
    ? {
        html: `<p style="margin:0 0 8px 0; font-family:${k.SANS}; font-size:16px; line-height:27px; color:#3f4b56;">${k.r(c.codeIntro).html}</p>
      <p style="margin:0; font-family:${k.SERIF}; font-size:34px; line-height:40px; ${k.track('0.18em')}color:#14202b;"><span dir="ltr" style="unicode-bidi:isolate;">${k.r('{code}', { code: ltr(d.code) }).html}</span></p>`,
        text: `${c.codeIntro}\n${d.code}`,
      }
    : null;
  return {
    subject: copy.subject,
    preheader: k.t(copy.lede, k.vars),
    rows: [
      top(k),
      hero(k, {
        kicker: copy.kicker,
        h1: k.r(copy.h1),
        ledes: [k.r(copy.lede, k.vars)],
        cta: hasLink ? { href: d.url, label: copy.cta } : undefined,
        note: k.r(ignore),
      }),
      ...(hasLink || code
        ? [section(k, { bg: 'paper', pad: '30px 44px 32px 44px' }, ...(hasLink ? [fallbackLink(k, c.fallback, d.url)] : []), ...(code ? [code] : []))]
        : []),
      txFooter(k, { reason: copy.reason }),
    ],
  };
});
