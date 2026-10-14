import { isEmail, isName, isPhone } from '@dpl/core';

export interface LeadDraft {
  fullName: string;
  email: string;
  phone: string;
}

/**
 * Capitalises every word of a name while it is typed ("david cohen" -> "David Cohen", "o'neil-smith" -> "O'Neil-Smith").
 * Unlike capitalizeName() from @dpl/core it must not trim, or the space after the first name could never be typed.
 */
export const capitalizeAsTyped = (value: string): string =>
  value.replace(/(^|[\s'\-])([a-zà-ÿ])/g, (_m, p: string, c: string) => p + c.toUpperCase());

export interface LeadValidity {
  name: boolean;
  email: boolean;
  phone: boolean;
  ok: boolean;
}

/** Same rules the server enforces (isName / isEmail / isPhone from @dpl/core). */
export function validateLead(d: LeadDraft): LeadValidity {
  const name = isName(d.fullName);
  const email = isEmail(d.email);
  const phone = isPhone(d.phone);
  return { name, email, phone, ok: name && email && phone };
}

export const EMPTY_DRAFT: LeadDraft = { fullName: '', email: '', phone: '' };

const DRAFT_KEY = 'dpl-lead-draft-v1';

/** The typed-in details survive a refresh, but only for the life of the tab (they are personal data). */
export function readDraft(): LeadDraft {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY_DRAFT;
    const v = JSON.parse(raw) as Partial<LeadDraft>;
    return {
      fullName: typeof v.fullName === 'string' ? v.fullName : '',
      email: typeof v.email === 'string' ? v.email : '',
      phone: typeof v.phone === 'string' ? v.phone : '',
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function writeDraft(d: LeadDraft): void {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* storage blocked: the form still works, it just forgets on refresh */
  }
}

export function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
