import { capitalizeName, contactSubmissionSchema, isEmail, isName, isPhone } from '@dpl/core';
import { describe, expect, it } from 'vitest';
import {
  capitalizeNameInput,
  firstInvalidField,
  firstNameOf,
  isValidEmail,
  isValidName,
  isValidPhone,
  toPayload,
  validateContact,
  type ContactValues,
} from './validation';

const valid: ContactValues = {
  name: 'Anna Reinhardt',
  email: 'anna@example.com',
  phone: '+972 55 123 4567',
  matter: 'German or Austrian passport',
  note: '',
  consent: true,
};

describe('validateContact', () => {
  it('accepts a complete form', () => {
    expect(validateContact(valid)).toEqual({});
  });

  it('requires a name of at least 2 characters (after trimming)', () => {
    expect(isValidName('A')).toBe(false);
    expect(isValidName('  A ')).toBe(false);
    expect(isValidName('Al')).toBe(true);
    expect(isValidName('עד')).toBe(true);
    expect(isValidName('x'.repeat(121))).toBe(false);
    expect(validateContact({ ...valid, name: ' ' })).toEqual({ name: true });
  });

  it('requires an email with a name, an @ and a dotted domain', () => {
    for (const bad of [
      '',
      'anna',
      'anna@',
      '@example.com',
      'anna@example',
      'a b@example.com',
      'anna@exa mple.com',
    ]) {
      expect(isValidEmail(bad), bad).toBe(false);
    }
    for (const good of ['anna@example.com', ' anna@example.com ', 'a.b+c@sub.example.co.il']) {
      expect(isValidEmail(good), good).toBe(true);
    }
    expect(isValidEmail(`${'a'.repeat(250)}@b.co`)).toBe(false);
  });

  it('requires at least 7 digits in the phone number, whatever the punctuation', () => {
    expect(isValidPhone('123456')).toBe(false);
    expect(isValidPhone('1234567')).toBe(true);
    expect(isValidPhone('+972 (0)3-372-4722')).toBe(true);
    expect(isValidPhone('03-372')).toBe(false);
    expect(isValidPhone('abc')).toBe(false);
    expect(isValidPhone(`${'1'.repeat(41)}`)).toBe(false);
  });

  it('requires consent', () => {
    expect(validateContact({ ...valid, consent: false })).toEqual({ consent: true });
  });

  it('reports every invalid field and focuses the first one in page order', () => {
    const errors = validateContact({ ...valid, name: '', email: 'nope', phone: '1', consent: false });
    expect(errors).toEqual({ name: true, email: true, phone: true, consent: true });
    expect(firstInvalidField(errors)).toBe('name');
    expect(firstInvalidField({ phone: true, consent: true })).toBe('phone');
    expect(firstInvalidField({})).toBeUndefined();
  });

  it('agrees with the API schema, so the browser never lets through what the server rejects (and the reverse)', () => {
    const names = ['', ' ', 'A', 'Al', 'Anna Reinhardt', 'עידו שקולניק', 'x'.repeat(120), 'x'.repeat(121)];
    const emails = [
      '',
      'anna',
      'anna@example.com',
      'ANNA@Example.COM',
      'a@b',
      ' a@b.co ',
      'a b@c.de',
      `${'a'.repeat(250)}@b.co`,
    ];
    const phones = ['', '123456', '1234567', '+972 55-123-4567', '(0)3 372 4722', 'phone', '1'.repeat(41)];
    for (const name of names) {
      for (const email of emails) {
        for (const phone of phones) {
          const values = { ...valid, name, email, phone };
          const client = Object.keys(validateContact(values)).length === 0;
          const server = contactSubmissionSchema.safeParse(
            toPayload(values, { locale: 'en', page: '/contact' }),
          ).success;
          expect(client, JSON.stringify({ name, email, phone })).toBe(server);
        }
      }
    }
  });

  it('uses the same predicates as @dpl/core for single fields', () => {
    for (const v of ['', 'A', 'Al', ' Anna ']) expect(isValidName(v)).toBe(isName(v));
    for (const v of ['', 'a@b.co', 'a@b', ' a@b.co ']) expect(isValidEmail(v)).toBe(isEmail(v));
    for (const v of ['', '123456', '1234567', '+972-3-372-4722']) expect(isValidPhone(v)).toBe(isPhone(v));
  });
});

describe('capitalizeNameInput', () => {
  it('capitalises the first letter of each word as the visitor types', () => {
    expect(capitalizeNameInput('anna reinhardt')).toBe('Anna Reinhardt');
    expect(capitalizeNameInput('a')).toBe('A');
    expect(capitalizeNameInput('anna ')).toBe('Anna ');
    expect(capitalizeNameInput('anna r')).toBe('Anna R');
  });

  it('capitalises after an apostrophe or a hyphen, and accented initials', () => {
    expect(capitalizeNameInput("o'neil-smith")).toBe("O'Neil-Smith");
    expect(capitalizeNameInput('élodie müller')).toBe('Élodie Müller');
  });

  it('leaves existing capitals, digits, Hebrew and other scripts alone', () => {
    expect(capitalizeNameInput('McDonald')).toBe('McDonald');
    expect(capitalizeNameInput('דוד כהן')).toBe('דוד כהן');
    expect(capitalizeNameInput('דוד smith')).toBe('דוד Smith');
    expect(capitalizeNameInput('')).toBe('');
  });

  it('does not trim (a trailing space typed mid-word must survive) but @dpl/core capitalizeName does, so both stay distinct', () => {
    expect(capitalizeNameInput('anna ')).toBe('Anna ');
    expect(capitalizeName('anna ')).toBe('Anna');
  });
});

describe('firstNameOf', () => {
  it('takes the first word', () => {
    expect(firstNameOf('Anna Reinhardt')).toBe('Anna');
    expect(firstNameOf('  Anna   Reinhardt ')).toBe('Anna');
    expect(firstNameOf('')).toBe('');
    expect(firstNameOf('עינת ש.')).toBe('עינת');
  });
});

describe('toPayload', () => {
  it('builds the body of POST /api/contact', () => {
    const body = toPayload(
      { ...valid, name: '  anna   reinhardt ', note: '  Hello  ' },
      { locale: 'he', page: '/he/contact' },
    );
    expect(body).toEqual({
      kind: 'contact',
      name: 'Anna Reinhardt',
      email: 'anna@example.com',
      phone: '+972 55 123 4567',
      matter: 'German or Austrian passport',
      note: 'Hello',
      consent: true,
      locale: 'he',
      page: '/he/contact',
      website: '',
    });
    expect(contactSubmissionSchema.safeParse(body).success).toBe(true);
  });

  it('carries the campaign parameters and the source of the visit when it has them', () => {
    const plain = toPayload(valid, { locale: 'en', page: '/contact' });
    expect(plain).not.toHaveProperty('utm');
    expect(plain).not.toHaveProperty('source');
    const body = toPayload(valid, { locale: 'en', page: '/contact', utm: { utm_source: 'news', utm_campaign: 'spring' }, source: 'news' });
    expect(body.utm).toEqual({ utm_source: 'news', utm_campaign: 'spring' });
    expect(body.source).toBe('news');
    expect(contactSubmissionSchema.safeParse(body).success).toBe(true);
  });

  it('omits an empty note and keeps the honeypot empty', () => {
    const body = toPayload(valid, { locale: 'en', page: '/contact' });
    expect(body.note).toBeUndefined();
    expect(body.website).toBe('');
    expect(JSON.parse(JSON.stringify(body))).not.toHaveProperty('note');
  });

  it('passes a filled honeypot on, which the API schema refuses (it then drops the enquiry silently)', () => {
    const body = toPayload(valid, { locale: 'en', page: '/contact', website: 'http://spam.example' });
    expect(body.website).toBe('http://spam.example');
    expect(contactSubmissionSchema.safeParse(body).success).toBe(false);
  });

  it('is accepted by the API schema for every matter and for a note at the limit', () => {
    const matters = [
      'German or Austrian passport',
      'Something else',
      'Romanian, French or Bulgarian passport',
    ];
    for (const matter of matters) {
      const body = toPayload(
        { ...valid, matter, note: 'n'.repeat(4000) },
        { locale: 'en', page: '/contact' },
      );
      expect(contactSubmissionSchema.safeParse(body).success, matter).toBe(true);
    }
  });
});
