import { describe, expect, it } from 'vitest';
import { capitalizeName, isEmail, multiLine, nameText, oneLine, phoneText } from './format';
import { callbackInputSchema, contactSubmissionSchema, leadInputSchema } from './schemas';

const LEAD = { fullName: 'Anna Reinhardt', email: 'anna@example.com', phone: '+49 30 5550 0100' };

describe('oneLine / multiLine', () => {
  it('turns control characters into a space and drops invisible format characters', () => {
    expect(oneLine('Anna\r\nBcc: someone@example.com\r\nX-Injected: yes')).toBe('Anna Bcc: someone@example.com X-Injected: yes');
    expect(oneLine('a\tb\u0000c\u0085d e')).toBe('a b c d e');
    expect(oneLine('Dav​id‮ ‏ Cohen⁦')).toBe('David Cohen');
    expect(oneLine('  many   spaces   here ')).toBe('many spaces here');
    expect(oneLine(null)).toBe('');
  });

  it('leaves real names alone, in every script', () => {
    for (const name of ['Anna Reinhardt', "O'Neil-Smith", 'דוד כהן', 'Müller Åström', 'José María', 'Фёдор Иванов', 'محمد علي']) expect(oneLine(name)).toBe(name);
  });

  it('keeps the line breaks of a message and nothing else dangerous', () => {
    expect(multiLine('first\r\nsecond\rthird fourth')).toBe('first\nsecond\nthird\nfourth');
    expect(multiLine('a\u0000b\tc​d')).toBe('a b cd');
    expect(multiLine('one\n\n\n\n\ntwo \n  three')).toBe('one\n\ntwo\nthree');
  });

  it('capitalizeName cleans as well (it also handles names that came from Google)', () => {
    expect(capitalizeName('anna\r\nreinhardt')).toBe('Anna Reinhardt');
    expect(capitalizeName('o​\'neil-smith')).toBe("O'Neil-Smith");
  });
});

describe('what the form schemas let through', () => {
  it('a name cannot carry a line break (mail header injection) into the lead or its e-mail', () => {
    const lead = leadInputSchema.parse({ ...LEAD, fullName: 'Anna\r\nBcc: someone-else@example.com\r\nX-Injected: yes Reinhardt' });
    expect(lead.fullName).toBe('Anna Bcc: someone-else@example.com X-Injected: yes Reinhardt');
    expect(lead.fullName).not.toMatch(/[\r\n]/);
  });

  it('a name made only of control characters is no name', () => {
    expect(leadInputSchema.safeParse({ ...LEAD, fullName: '\r\n\t ​' }).success).toBe(false);
    expect(leadInputSchema.safeParse({ ...LEAD, fullName: 'A\r\n' }).success).toBe(false);
  });

  it('phone, source, utm and the other one-line fields are cleaned the same way', () => {
    const lead = leadInputSchema.parse({ ...LEAD, phone: '+49 30\n5550\r0100', source: 'campaign\r\nX: y', utm: { 'utm_source\n': 'goo\u0000gle' } });
    expect(lead.phone).toBe('+49 30 5550 0100');
    expect(lead.source).toBe('campaign X: y');
    expect(lead.utm).toEqual({ 'utm_source': 'goo gle' });
    const callback = callbackInputSchema.parse({ phone: '+1 555 000 1234', name: 'Ben\nBcc: x' });
    expect(callback.name).toBe('Ben Bcc: x');
  });

  it('a message keeps its paragraphs but loses control characters', () => {
    const c = contactSubmissionSchema.parse({
      kind: 'contact',
      name: 'Dana\nLevi',
      email: 'dana@example.com',
      phone: '03-3724722',
      matter: 'German\ncitizenship',
      note: 'Hello,\r\n\r\n\r\n\r\nI have a question\u0000.',
      consent: true,
    });
    expect(c.name).toBe('Dana Levi');
    expect(c.matter).toBe('German citizenship');
    expect(c.note).toBe('Hello,\n\nI have a question .');
  });
});

describe('names, phone numbers and addresses from a form', () => {
  it('a name loses the characters that make it look like markup or an address header', () => {
    expect(nameText('Tom & Jerry <tom@evil.com>')).toBe('Tom & Jerry tom@evil.com');
    expect(nameText('"><script>alert(1)</script>')).toBe('scriptalert(1)/script');
    expect(nameText('Anna \\ Reinhardt\u202E')).toBe('Anna Reinhardt');
    for (const name of ['Anna Reinhardt', "O'Neil-Smith", 'דוד כהן', 'José María']) expect(nameText(name)).toBe(name);
    expect(leadInputSchema.parse({ ...LEAD, fullName: 'Tom <tom@evil.com>' }).fullName).toBe('Tom tom@evil.com');
    expect(leadInputSchema.safeParse({ ...LEAD, fullName: '<>' }).success).toBe(false);
  });

  it('a phone number keeps digits and the usual separators only', () => {
    expect(phoneText('<script>1234567</script>')).toBe('1234567');
    expect(phoneText('+49 (30) 5550-0100')).toBe('+49 (30) 5550-0100');
    expect(phoneText('03.372.4722\n')).toBe('03.372.4722');
    expect(leadInputSchema.parse({ ...LEAD, phone: '<b>+49 30 5550 0100</b>' }).phone).toBe('+49 30 5550 0100');
    expect(leadInputSchema.safeParse({ ...LEAD, phone: '<b>12</b>' }).success).toBe(false);
  });

  it('an address is what a mail provider takes: ASCII, no quoted local part, a dotted domain', () => {
    for (const ok of ['anna@example.com', 'anna.reinhardt+case@mail.example.co.il', "o'neil@example.org", 'a_b-c@sub.example.de', 'x@xn--p1ai.xn--p1ai']) expect(isEmail(ok), ok).toBe(true);
    for (const bad of ['"quoted"@example.com', 'üser@exämple.com', 'שם@דוגמה.קום', 'a@b', 'a@b.c', 'a b@example.com', '@example.com', 'a@@example.com', 'a..b@example.com', '.a@example.com', 'a.@example.com', 'a@example..com', 'a@-.com'.replace('-.', '.')]) expect(isEmail(bad), bad).toBe(false);
  });
});
