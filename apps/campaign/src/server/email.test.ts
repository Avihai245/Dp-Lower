import { createAdminSupabase } from '@dpl/db/admin';
import type { Db, EventRow } from '@dpl/db/types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanupLeads, loadLocalEnv, makeLead } from './test-env';

vi.mock('server-only', () => ({}));

const hasDb = loadLocalEnv();

type Payload = {
  template: string;
  category: string;
  listUnsubscribe?: string;
  locale: string;
  to: { email: string; name: string };
  from: { email: string; name: string };
  replyTo: string;
  subject: string;
  preheader: string;
  html: string;
  text: string;
};

describe.skipIf(!hasDb)('queueEmail (local Supabase)', () => {
  let db: Db;
  let mail: typeof import('./email');
  const created: string[] = [];
  const keys: string[] = [];

  beforeAll(async () => {
    db = createAdminSupabase();
    mail = await import('./email');
  });
  afterAll(async () => {
    await cleanupLeads(db, created);
    if (keys.length) await db.from('events').delete().in('dedupe_key', keys);
  });

  const lead = async (o: Parameters<typeof makeLead>[1] = { createdAt: new Date() }) => {
    const l = await makeLead(db, o);
    created.push(l.id);
    return l;
  };
  const event = async (key: string): Promise<EventRow | null> => {
    const { data } = await db.from('events').select('*').eq('dedupe_key', key).maybeSingle();
    return data;
  };

  it('writes a rendered transactional email to the outbox, with the sender and the signed portal link', async () => {
    const l = await lead({ createdAt: new Date(), name: 'rachel hoffman' });
    await mail.queueEmail({
      template: 'booking-confirmation',
      lead: l,
      data: { startsAt: '2026-10-14T13:30:00.000Z', timezone: 'America/New_York', minutes: 20 },
      dedupeKey: `booking.created:${l.id}`,
    });
    const e = await event(`booking.created:${l.id}`);
    expect(e).toMatchObject({ type: 'email.send', channel: 'email', status: 'pending', lead_id: l.id });
    const p = e!.payload as Payload;
    expect(p).toMatchObject({
      template: 'booking-confirmation',
      category: 'transactional',
      locale: 'en',
      to: { email: l.email, name: 'rachel hoffman' },
    });
    expect(p.from).toEqual({
      email: process.env.EMAIL_FROM_ADDRESS ?? 'cases@euro-passports.com',
      name: process.env.EMAIL_FROM_NAME ?? 'Decker Pex Levi',
    });
    expect(p.replyTo).toBe(process.env.EMAIL_REPLY_TO ?? 'office@lawoffice.org.il');
    expect(p.subject).toBe('Your free call is booked');
    expect(p.html).toContain('Rachel, your call is booked.');
    expect(p.html).toContain('9:30 AM EDT');
    expect(p.html).toContain('We will call +1 212 555 0142 and ask for Rachel.');
    expect(p.html).toMatch(/\/go\/[\w.-]+"/);
    expect(p.html).not.toMatch(/unsubscribe/i);
    expect(p.text.length).toBeGreaterThan(100);
  });

  it('never queues the same dedupe key twice, and can be told when to send', async () => {
    const l = await lead();
    const key = `test:dedupe:${l.id}`;
    keys.push(key);
    const at = new Date(Date.now() + 3_600_000);
    await mail.queueEmail({
      template: 'status-update',
      lead: l,
      data: { status: 'under_review' },
      dedupeKey: key,
      at,
    });
    await mail.queueEmail({
      template: 'status-update',
      lead: l,
      data: { status: 'info_required' },
      dedupeKey: key,
    });
    const { data } = await db.from('events').select('*').eq('dedupe_key', key);
    expect(data).toHaveLength(1);
    expect((data![0]!.payload as Payload).subject).toBe('Your case status: Under Review');
    expect(new Date(data![0]!.next_attempt_at).getTime()).toBe(at.getTime());
  });

  it('defaults the dedupe key to template, lead and hour', async () => {
    const l = await lead();
    await mail.queueEmail({ template: 'application-received', lead: l });
    await mail.queueEmail({ template: 'application-received', lead: l });
    const { data } = await db.from('events').select('*').eq('lead_id', l.id);
    expect(data).toHaveLength(1);
    expect(data![0]!.dedupe_key).toMatch(
      new RegExp(`^email:application-received:${l.id}:\\d{4}-\\d{2}-\\d{2}T\\d{2}$`),
    );
  });

  it('adds an unsubscribe link to nurture emails and skips unsubscribed leads', async () => {
    const l = await lead();
    const unsub = await lead({ createdAt: new Date(), unsubscribedAt: new Date() });
    await mail.queueEmail({ template: 'welcome-4', lead: l, dedupeKey: `welcome:${l.id}:4` });
    await mail.queueEmail({ template: 'welcome-4', lead: unsub, dedupeKey: `welcome:${unsub.id}:4` });
    const p = (await event(`welcome:${l.id}:4`))!.payload as Payload;
    expect(p.category).toBe('nurture');
    expect(p.html).toMatch(/\/unsubscribe\?t=/);
    // the same signed address, for the List-Unsubscribe header of a sending app that can set one
    expect(p.listUnsubscribe).toMatch(/\/unsubscribe\?t=[\w.-]+$/);
    expect(p.html).toContain(p.listUnsubscribe!.replace(/&/g, '&amp;'));
    expect(await event(`welcome:${unsub.id}:4`)).toBeNull();
    // transactional emails still reach an unsubscribed lead
    await mail.queueEmail({
      template: 'booking-cancelled',
      lead: unsub,
      data: { startsAt: '2026-10-14T13:30:00.000Z', timezone: 'Asia/Jerusalem' },
      dedupeKey: `test:cancel:${unsub.id}`,
    });
    keys.push(`test:cancel:${unsub.id}`);
    expect(await event(`test:cancel:${unsub.id}`)).not.toBeNull();
  });

  it('renders the Lead Email from the lead’s own application and documents when no data is given', async () => {
    const l = await lead({ createdAt: new Date(), route: 'both' });
    await db.from('documents').insert([
      { lead_id: l.id, doc_type: 'passport', status: 'received' as const },
      { lead_id: l.id, doc_type: 'photo_id', status: 'received' as const },
      { lead_id: l.id, doc_type: 'other', status: 'missing' as const },
    ]);
    await db.from('applications').insert({ lead_id: l.id, data: {} });
    await mail.queueEmail({ template: 'file-open', lead: l, dedupeKey: `test:file-open:${l.id}` });
    keys.push(`test:file-open:${l.id}`);
    const p = (await event(`test:file-open:${l.id}`))!.payload as Payload;
    expect(p.html).toContain(l.case_ref);
    expect(p.html).toContain('Germany and Austria');
    expect(p.html).toContain('In progress');
    expect(p.html).toContain('2 of 8');
    expect(p.html).not.toMatch(/unsubscribe/i);
    expect(p.html).toContain('11 Menachem Begin Road');
  });

  it('writes Hebrew emails for Hebrew leads, with Hebrew links', async () => {
    const l = await lead({ createdAt: new Date(), locale: 'he', name: 'דוד כהן' });
    await mail.queueEmail({ template: 'application-received', lead: l, dedupeKey: `test:received:${l.id}` });
    keys.push(`test:received:${l.id}`);
    const p = (await event(`test:received:${l.id}`))!.payload as Payload;
    expect(p.locale).toBe('he');
    expect(p.html).toContain('<html lang="he" dir="rtl">');
    expect(p.html).toContain('/he/go/');
    expect(p.subject).toBe('הבקשה שלכם התקבלה אצלנו');
  });

  it('queueEmailToAddress writes an email for a person who is not a lead', async () => {
    const key = `test:address:${Date.now()}`;
    keys.push(key);
    const e = await mail.queueEmailToAddress({
      template: 'password-reset',
      to: { email: 'nobody@example.com', name: 'nobody', locale: 'en' },
      data: { resetUrl: 'https://euro-passports.com/auth/callback?token_hash=x&type=recovery' },
      dedupeKey: key,
    });
    expect(e.lead_id).toBeNull();
    expect((e.payload as Payload).subject).toBe('Set a new password');
    // the same key answers with the existing event instead of throwing
    expect(
      (
        await mail.queueEmailToAddress({
          template: 'password-reset',
          to: { email: 'nobody@example.com', name: 'nobody', locale: 'en' },
          dedupeKey: key,
        })
      ).id,
    ).toBe(e.id);
  });

  it('never throws, even for a lead it cannot render for', async () => {
    const l = await lead();
    await expect(mail.queueEmail({ template: 'nope' as never, lead: l })).resolves.toBeUndefined();
  });
});
