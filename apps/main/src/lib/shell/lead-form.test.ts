import { capitalizeName, contactSubmissionSchema, digitsOf as coreDigits, isEmail as coreIsEmail, isName as coreIsName, isPhone as corePhone } from '@dpl/core';
import { describe, expect, it, vi } from 'vitest';
import enSite from '../../../messages/en/site.json';
import heSite from '../../../messages/he/site.json';
import {
  autoCapitalize,
  buildChatPayload,
  buildLeadBandPayload,
  CHAT_TOPIC_VALUES,
  CONTACT_ENDPOINT,
  digitsOf,
  firstNameOf,
  isEmail,
  isLeadReady,
  isName,
  isPhone,
  leadErrors,
  MATTER_VALUES,
  parseUtm,
  postContact,
  type ContactPayload,
  type SubmitContext,
} from './lead-form';

const ctx: SubmitContext = { locale: 'en', page: '/services/german-citizenship', utm: {} };
const good = { name: 'Dana Levi', phone: '+972 54 123 4567', email: 'dana@example.com', consent: true, website: '' };

describe('validators stay identical to @dpl/core (which the API uses)', () => {
  const names = ['', ' ', 'a', 'ab', ' ab ', 'דנה', 'x'.repeat(120), 'x'.repeat(121), '  x  '];
  const emails = ['', 'a@b.c', 'a@b', '@b.c', 'a b@c.d', 'dana@example.com', ' dana@example.com ', 'a@b.c.d', `${'x'.repeat(250)}@b.cd`, 'שם@דוגמה.קום'];
  const phones = ['', '123456', '1234567', '03-372-4722', '+972 54 123 4567', 'abc', '(03) 372 47 22', '1'.repeat(41), ' 0501234567 ', '٠٥٠١٢٣٤٥٦٧'];

  it('name', () => {
    for (const n of names) expect(isName(n), JSON.stringify(n)).toBe(coreIsName(n));
  });
  it('email', () => {
    for (const e of emails) expect(isEmail(e), JSON.stringify(e)).toBe(coreIsEmail(e));
  });
  it('phone and digits', () => {
    for (const p of phones) {
      expect(isPhone(p), JSON.stringify(p)).toBe(corePhone(p));
      expect(digitsOf(p)).toBe(coreDigits(p));
    }
  });
  it('first-name capitalisation agrees with capitalizeName on finished input', () => {
    for (const n of ['anna reinhardt', "o'neil-smith", 'ÉMILE zola', 'דנה לוי', 'dana']) expect(autoCapitalize(n)).toBe(capitalizeName(n));
  });
});

describe('autoCapitalize (as the visitor types)', () => {
  it('capitalises each word, also after an apostrophe or a hyphen', () => {
    expect(autoCapitalize('anna reinhardt')).toBe('Anna Reinhardt');
    expect(autoCapitalize("o'neil-smith")).toBe("O'Neil-Smith");
  });
  it('keeps a trailing space so the next word can be typed', () => {
    expect(autoCapitalize('anna ')).toBe('Anna ');
    expect(autoCapitalize('')).toBe('');
  });
  it('leaves Hebrew and the rest of a word alone', () => {
    expect(autoCapitalize('דנה לוי')).toBe('דנה לוי');
    expect(autoCapitalize('McDonald')).toBe('McDonald');
  });
  it('firstNameOf takes the first word', () => {
    expect(firstNameOf('  Dana   Levi ')).toBe('Dana');
    expect(firstNameOf('Dana')).toBe('Dana');
    expect(firstNameOf('')).toBe('');
  });
});

describe('leadErrors', () => {
  it('accepts a complete form', () => {
    expect(leadErrors(good, { emailRequired: true })).toEqual([]);
    expect(isLeadReady(good, { emailRequired: true })).toBe(true);
  });

  it('lists every invalid field in form order', () => {
    expect(leadErrors({ name: 'a', phone: '12', email: 'nope', consent: false }, { emailRequired: true })).toEqual(['name', 'phone', 'email', 'consent']);
  });

  it('requires consent', () => {
    expect(leadErrors({ ...good, consent: false }, { emailRequired: true })).toEqual(['consent']);
  });

  it('lead band: email is required', () => {
    expect(leadErrors({ ...good, email: '' }, { emailRequired: true })).toEqual(['email']);
  });

  it('chat: email is optional but must be valid when given', () => {
    expect(leadErrors({ ...good, email: '' }, { emailRequired: false })).toEqual([]);
    expect(leadErrors({ ...good, email: '   ' }, { emailRequired: false })).toEqual([]);
    expect(leadErrors({ ...good, email: 'dana@' }, { emailRequired: false })).toEqual(['email']);
  });
});

describe('payloads match POST /api/contact', () => {
  const lead = { ...good, matterIndex: 3 };

  it('lead band payload passes the server schema', () => {
    const payload = buildLeadBandPayload(lead, ctx);
    expect(contactSubmissionSchema.safeParse(payload).success).toBe(true);
    expect(payload).toMatchObject({ kind: 'lead_band', name: 'Dana Levi', email: 'dana@example.com', locale: 'en', page: '/services/german-citizenship', consent: true });
  });

  it('chat payload passes the server schema, with and without an email', () => {
    const withEmail = buildChatPayload({ ...good, topicIndex: 1 }, ctx);
    expect(contactSubmissionSchema.safeParse(withEmail).success).toBe(true);
    const noEmail = buildChatPayload({ ...good, email: '  ', topicIndex: 1 }, ctx);
    expect(noEmail).not.toHaveProperty('email');
    expect(contactSubmissionSchema.safeParse(noEmail).success).toBe(true);
    expect(noEmail.kind).toBe('chat');
  });

  it('always sends the English label of the subject, whatever language the form was in', () => {
    expect(buildLeadBandPayload({ ...lead, matterIndex: 0 }, { ...ctx, locale: 'he' }).matter).toBe('German or Austrian passport');
    expect(buildLeadBandPayload({ ...lead, matterIndex: 9 }, ctx).matter).toBe('Something else');
    expect(buildChatPayload({ ...good, topicIndex: 4 }, { ...ctx, locale: 'he' }).matter).toBe('Something else');
    expect(buildLeadBandPayload({ ...lead, matterIndex: 99 }, ctx).matter).toBe('Something else');
  });

  it('trims the text fields, carries the locale and keeps the page within the limit', () => {
    const p = buildLeadBandPayload({ ...lead, name: '  Dana Levi ', phone: ' 0541234567 ', email: ' dana@example.com ' }, { ...ctx, locale: 'he', page: '/he/' + 'x'.repeat(400) });
    expect(p).toMatchObject({ name: 'Dana Levi', phone: '0541234567', email: 'dana@example.com', locale: 'he' });
    expect(p.page.length).toBe(300);
  });

  it('adds utm parameters and the honeypot only when present', () => {
    expect(buildLeadBandPayload(lead, ctx)).not.toHaveProperty('utm');
    expect(buildLeadBandPayload(lead, ctx)).not.toHaveProperty('website');
    const p = buildLeadBandPayload({ ...lead, website: 'http://spam' }, { ...ctx, utm: { utm_source: 'google' } });
    expect(p.utm).toEqual({ utm_source: 'google' });
    expect(p.website).toBe('http://spam');
    // a filled honeypot is rejected by the schema (the route answers it with a silent success)
    expect(contactSubmissionSchema.safeParse(p).success).toBe(false);
  });

  it('carries the source label and stays valid for the API schema', () => {
    expect(buildLeadBandPayload(lead, ctx)).not.toHaveProperty('source');
    const p = buildLeadBandPayload(lead, { ...ctx, utm: { utm_source: 'google' }, source: 'google' });
    expect(p.source).toBe('google');
    expect(contactSubmissionSchema.safeParse(p).success).toBe(true);
    expect(buildLeadBandPayload(lead, { ...ctx, source: 'x'.repeat(200) }).source).toHaveLength(80);
  });
});

describe('subject and topic lists', () => {
  it('have as many labels in each language as values', () => {
    expect(enSite.leadBand.matters).toHaveLength(MATTER_VALUES.length);
    expect(heSite.leadBand.matters).toHaveLength(MATTER_VALUES.length);
    expect(enSite.chat.topics).toHaveLength(CHAT_TOPIC_VALUES.length);
    expect(heSite.chat.topics).toHaveLength(CHAT_TOPIC_VALUES.length);
  });

  it('English labels are exactly the values sent to the CRM', () => {
    expect([...enSite.leadBand.matters]).toEqual([...MATTER_VALUES]);
    expect([...enSite.chat.topics]).toEqual([...CHAT_TOPIC_VALUES]);
  });

  it('every value fits the API limit', () => {
    for (const v of [...MATTER_VALUES, ...CHAT_TOPIC_VALUES]) expect(v.length).toBeLessThanOrEqual(120);
  });
});

describe('parseUtm', () => {
  it('keeps utm_ parameters only, lower-cased', () => {
    expect(parseUtm('?utm_source=google&utm_medium=cpc&gclid=abc&ref=x&UTM_Campaign=Spring')).toEqual({ utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'Spring' });
    expect(parseUtm('')).toEqual({});
  });
  it('respects the limits of the schema', () => {
    const many = Array.from({ length: 20 }, (_, i) => `utm_k${i}=v`).join('&');
    expect(Object.keys(parseUtm(many))).toHaveLength(12);
    expect(parseUtm(`utm_x=${'a'.repeat(500)}`).utm_x).toHaveLength(300);
    expect(parseUtm(`utm_${'k'.repeat(40)}=v`)).toEqual({});
  });
  it('skips empty values', () => {
    expect(parseUtm('?utm_source=&utm_medium=cpc')).toEqual({ utm_medium: 'cpc' });
  });
});

describe('postContact', () => {
  const body: ContactPayload = buildLeadBandPayload({ ...good, matterIndex: 0 }, ctx);
  const res = (status: number) => vi.fn(async () => new Response('{}', { status })) as unknown as typeof fetch;

  it('posts JSON to the contact endpoint', async () => {
    const f = res(201);
    expect(await postContact(body, f)).toEqual({ ok: true });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(CONTACT_ENDPOINT);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it('maps 429 to the rate-limit message and everything else to a plain failure', async () => {
    expect(await postContact(body, res(429))).toEqual({ ok: false, reason: 'rate' });
    for (const status of [400, 403, 500, 503]) expect(await postContact(body, res(status))).toEqual({ ok: false, reason: 'failed' });
  });

  it('treats a network error as a failure', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await postContact(body, f)).toEqual({ ok: false, reason: 'failed' });
  });
});

describe('postContact result mapping (captcha)', () => {
  const body = { kind: 'lead_band', name: 'Ana', phone: '5551234567', matter: 'x', consent: true, locale: 'en', page: '/' } as const;
  const respond = (status: number, json?: unknown) => (async () => new Response(json === undefined ? null : JSON.stringify(json), { status })) as unknown as typeof fetch;

  it('maps a refused Turnstile check to "captcha", the rate limit to "rate", anything else to "failed"', async () => {
    const { postContact } = await import('./lead-form');
    expect(await postContact(body, respond(201, { ok: true }))).toEqual({ ok: true });
    expect(await postContact(body, respond(400, { error: 'captcha_failed' }))).toEqual({ ok: false, reason: 'captcha' });
    expect(await postContact(body, respond(400, { error: 'invalid_body' }))).toEqual({ ok: false, reason: 'failed' });
    expect(await postContact(body, respond(429, { error: 'rate_limited' }))).toEqual({ ok: false, reason: 'rate' });
    expect(await postContact(body, respond(500))).toEqual({ ok: false, reason: 'failed' });
    expect(await postContact(body, (async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toEqual({ ok: false, reason: 'failed' });
  });
});
