/**
 * Pure logic of the consultation form: validation, typing-time name capitalisation and the API payload.
 *
 * The rules mirror `contactSubmissionSchema` in @dpl/core, which the API route enforces (validation.test.ts checks that
 * both agree). They are repeated here instead of imported so the browser bundle does not pull in the whole of
 * @dpl/core (zod and every schema) for three one-line predicates; only types are imported.
 */
import type { ContactSubmissionInput } from '@dpl/core';

export const LIMITS = { name: 120, email: 254, phone: 40, note: 4000 } as const;

export interface ContactValues {
  name: string;
  email: string;
  phone: string;
  /** the value of the selected matter: always the English label, so the firm's CRM reads one vocabulary */
  matter: string;
  note: string;
  consent: boolean;
}

export type ContactField = 'name' | 'email' | 'phone' | 'consent';
export type ContactErrors = Partial<Record<ContactField, true>>;

/** Order in which the fields appear on the page: the first invalid one receives focus after a failed attempt. */
export const FIELD_ORDER: readonly ContactField[] = ['name', 'email', 'phone', 'consent'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digitsOf = (value: string): number => value.replace(/[^0-9]/g, '').length;

export const isValidName = (value: string): boolean => {
  const n = value.trim().length;
  return n >= 2 && n <= LIMITS.name;
};
export const isValidEmail = (value: string): boolean => {
  const v = value.trim();
  return v.length <= LIMITS.email && EMAIL_RE.test(v);
};
export const isValidPhone = (value: string): boolean =>
  digitsOf(value) >= 7 && value.trim().length <= LIMITS.phone;

/** Which fields are invalid. `{}` means the form can be sent. */
export function validateContact(values: ContactValues): ContactErrors {
  const errors: ContactErrors = {};
  if (!isValidName(values.name)) errors.name = true;
  if (!isValidEmail(values.email)) errors.email = true;
  if (!isValidPhone(values.phone)) errors.phone = true;
  if (!values.consent) errors.consent = true;
  return errors;
}

export const firstInvalidField = (errors: ContactErrors): ContactField | undefined =>
  FIELD_ORDER.find((f) => errors[f]);

/**
 * Capitalises the first letter of every word while the visitor types ("anna o'neil-smith" -> "Anna O'Neil-Smith"): the
 * prototype's rule. Unlike `capitalizeName` in @dpl/core it does not trim, so a space typed at the end is kept.
 * Hebrew and other uncased scripts pass through untouched.
 */
export const capitalizeNameInput = (value: string): string =>
  value.replace(
    /(^|[\s'\-])([a-zà-ÿ])/g,
    (_m, before: string, letter: string) => before + letter.toUpperCase(),
  );

/** First word of the name, for "Anna, your enquiry is with us". */
export const firstNameOf = (name: string): string => name.trim().split(/\s+/)[0] ?? '';

export type ContactPayload = Extract<ContactSubmissionInput, { kind: 'contact' }>;

/**
 * The body of POST /api/contact. Call only for a valid form. `website` is the honeypot's value: empty for a person, so the
 * API accepts it; whatever a bot typed into the hidden field is sent as it is and makes the API discard the enquiry.
 */
export function toPayload(
  values: ContactValues,
  context: { locale: 'en' | 'he'; page: string; website?: string },
): ContactPayload {
  const note = values.note.trim();
  return {
    kind: 'contact',
    name: capitalizeNameInput(values.name.trim().replace(/\s+/g, ' ')),
    email: values.email.trim(),
    phone: values.phone.trim(),
    matter: values.matter,
    note: note || undefined,
    consent: true,
    locale: context.locale,
    page: context.page.slice(0, 300),
    website: context.website ?? '',
  };
}
