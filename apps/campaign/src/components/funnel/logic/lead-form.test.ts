import { capitalizeName } from '@dpl/core';
import { describe, expect, it } from 'vitest';
import { capitalizeAsTyped, validateLead } from './lead-form';

describe('capitalizeAsTyped', () => {
  it('capitalises every word as it is typed', () => {
    expect(capitalizeAsTyped('david cohen')).toBe('David Cohen');
    expect(capitalizeAsTyped("o'neil-smith")).toBe("O'Neil-Smith");
    expect(capitalizeAsTyped('émile zola')).toBe('Émile Zola');
  });
  it('keeps what is mid-typing: no trimming, so the space after the first name can be typed', () => {
    expect(capitalizeAsTyped('anna ')).toBe('Anna ');
    expect(capitalizeAsTyped(' anna')).toBe(' Anna');
    expect(capitalizeAsTyped('')).toBe('');
  });
  it('leaves uncased scripts and existing capitals alone', () => {
    expect(capitalizeAsTyped('מיכל כהן')).toBe('מיכל כהן');
    expect(capitalizeAsTyped('Anna McDonald')).toBe('Anna McDonald');
    expect(capitalizeAsTyped('ANNA')).toBe('ANNA');
  });
  it('agrees with the server-side capitalisation once trimmed', () => {
    for (const v of ['anna reinhardt', "mary o'neil-smith", '  jean-luc  picard ']) {
      expect(capitalizeAsTyped(v).trim()).toBe(capitalizeName(v));
    }
  });
});

describe('validateLead', () => {
  const ok = { fullName: 'Anna Reinhardt', email: 'anna@example.com', phone: '+1 555 000 0000' };
  it('accepts a complete lead', () => {
    expect(validateLead(ok)).toEqual({ name: true, email: true, phone: true, ok: true });
  });
  it('flags each field on its own', () => {
    expect(validateLead({ ...ok, fullName: 'A' })).toMatchObject({ name: false, email: true, phone: true, ok: false });
    expect(validateLead({ ...ok, email: 'anna@example' })).toMatchObject({ name: true, email: false, ok: false });
    expect(validateLead({ ...ok, phone: '12345' })).toMatchObject({ phone: false, ok: false });
  });
  it('uses digits only for the phone, as the prototype does', () => {
    expect(validateLead({ ...ok, phone: '(718) 555-0142' }).phone).toBe(true);
    expect(validateLead({ ...ok, phone: 'abcdefgh' }).phone).toBe(false);
  });
  it('ignores surrounding spaces', () => {
    expect(validateLead({ fullName: '  Anna  ', email: ' anna@example.com ', phone: ' 0521234567 ' }).ok).toBe(true);
  });
});
