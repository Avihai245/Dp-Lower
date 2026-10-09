import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/** apps/main/.env.local (git-ignored) holds the keys of the shared local Supabase; without it the database tests are skipped. */
function loadLocalEnv(): boolean {
  try {
    for (const line of fs.readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').split('\n')) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, '');
    }
  } catch {
    /* skipped below */
  }
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
const hasDb = loadLocalEnv();

type Payload = { template: string; category: string; locale: string; to: { email: string; name: string }; subject: string; html: string; text: string; from: { name: string } };

describe.skipIf(!hasDb)('queueContactAck (local Supabase)', () => {
  const db = hasDb ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }) : null!;
  const ids: string[] = [];
  const newId = () => {
    const id = `test-${Date.now()}-${ids.length}`;
    ids.push(id);
    return id;
  };
  const event = async (submissionId: string) => (await db.from('events').select('*').eq('dedupe_key', `contact-ack:${submissionId}`)).data ?? [];

  afterAll(async () => {
    for (const id of ids) await db.from('events').delete().eq('dedupe_key', `contact-ack:${id}`);
  });

  it('queues the acknowledgement for a visitor: transactional, no case reference, no unsubscribe, main-site links', async () => {
    const { queueContactAck } = await import('./contact-ack');
    const id = newId();
    await queueContactAck({ submissionId: id, name: 'rachel hoffman', email: 'Rachel@Example.com ', locale: 'en' });
    const rows = await event(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'email.send', channel: 'email', status: 'pending', lead_id: null });
    const p = rows[0]!.payload as Payload;
    expect(p).toMatchObject({ template: 'contact-received', category: 'transactional', locale: 'en', to: { email: 'rachel@example.com', name: 'rachel hoffman' }, subject: 'We have your enquiry' });
    expect(p.from.name).toBe('Decker Pex Levi');
    expect(p.html).toContain('Rachel, your enquiry is with us.');
    expect(p.html).not.toMatch(/unsubscribe|DPL-\d/i);
    // links: the contact page and the privacy page of the firm's own site, images hosted by the campaign site
    const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.lawoffice.org.il').replace(/\/$/, '');
    expect(p.html).toContain(`href="${site}/contact"`);
    expect(p.html).toContain(`href="${site}/privacy"`);
    expect(p.html).toMatch(/src="[^"]+\/email\/dpl-logo\.png"/);
    expect(p.text).toContain('03-372-4722');
  });

  it('writes Hebrew for Hebrew visitors, linked to the Hebrew pages', async () => {
    const { queueContactAck } = await import('./contact-ack');
    const id = newId();
    await queueContactAck({ submissionId: id, name: 'דוד כהן', email: 'david@example.com', locale: 'he' });
    const p = (await event(id))[0]!.payload as Payload;
    expect(p.locale).toBe('he');
    expect(p.subject).toBe('הפנייה שלכם התקבלה');
    expect(p.html).toContain('<html lang="he" dir="rtl">');
    expect(p.html).toContain('/he/contact"');
  });

  it('is idempotent per submission and does nothing without an email address', async () => {
    const { queueContactAck } = await import('./contact-ack');
    const id = newId();
    await queueContactAck({ submissionId: id, name: 'Dana', email: 'dana@example.com', locale: 'en' });
    await queueContactAck({ submissionId: id, name: 'Dana', email: 'dana@example.com', locale: 'en' });
    expect(await event(id)).toHaveLength(1);

    const none = newId();
    await queueContactAck({ submissionId: none, name: 'Chat visitor', email: null, locale: 'en' });
    await queueContactAck({ submissionId: none, name: 'Chat visitor', email: '  ', locale: 'en' });
    expect(await event(none)).toHaveLength(0);
  });

  it('escapes a hostile name', async () => {
    const { queueContactAck } = await import('./contact-ack');
    const id = newId();
    await queueContactAck({ submissionId: id, name: '<script>alert(1)</script>', email: 'x@example.com', locale: 'en' });
    const p = (await event(id))[0]!.payload as Payload;
    expect(p.html).not.toContain('<script>');
    expect(p.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
