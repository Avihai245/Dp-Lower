import { describe, expect, it, vi } from 'vitest';
import { CONTACT_ENDPOINT, postContact } from './submit';
import { toPayload } from './validation';

const payload = toPayload(
  {
    name: 'Anna Reinhardt',
    email: 'anna@example.com',
    phone: '+972551234567',
    matter: 'Something else',
    note: '',
    consent: true,
  },
  { locale: 'en', page: '/contact' },
);

const respond = (status: number, error = 'x') =>
  vi.fn(async () => new Response(JSON.stringify(status < 300 ? { ok: true } : { error }), { status }));

describe('postContact', () => {
  it('posts the payload as JSON to /api/contact and succeeds on 201', async () => {
    const fetchImpl = respond(201);
    expect(await postContact(payload, { fetchImpl })).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(CONTACT_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(String(init.body))).toMatchObject({
      kind: 'contact',
      email: 'anna@example.com',
      consent: true,
      website: '',
    });
  });

  it('maps the API errors to a failure reason', async () => {
    expect(await postContact(payload, { fetchImpl: respond(429, 'rate_limited') })).toEqual({
      ok: false,
      reason: 'rate_limited',
    });
    expect(await postContact(payload, { fetchImpl: respond(400, 'invalid_body') })).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(await postContact(payload, { fetchImpl: respond(400, 'captcha_failed') })).toEqual({
      ok: false,
      reason: 'captcha',
    });
    expect(await postContact(payload, { fetchImpl: respond(403, 'bad_origin') })).toEqual({
      ok: false,
      reason: 'server',
    });
    expect(await postContact(payload, { fetchImpl: respond(500, 'internal_error') })).toEqual({
      ok: false,
      reason: 'server',
    });
  });

  it('treats a 400 without a readable body as invalid', async () => {
    const fetchImpl = vi.fn(async () => new Response('not json', { status: 400 }));
    expect(await postContact(payload, { fetchImpl })).toEqual({ ok: false, reason: 'invalid' });
  });

  it('sends the Turnstile token with the payload when there is one', async () => {
    const fetchImpl = respond(201);
    await postContact({ ...payload, turnstileToken: 'token-123' }, { fetchImpl });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ kind: 'contact', turnstileToken: 'token-123' });
  });

  it('reports a network failure when fetch rejects', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await postContact(payload, { fetchImpl })).toEqual({ ok: false, reason: 'network' });
  });

  it('gives up after the timeout', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    ) as unknown as typeof fetch;
    expect(await postContact(payload, { fetchImpl, timeoutMs: 20 })).toEqual({
      ok: false,
      reason: 'network',
    });
  });

  it('can be cancelled by the caller', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    ) as unknown as typeof fetch;
    const pending = postContact(payload, { fetchImpl, signal: controller.signal, timeoutMs: 5000 });
    controller.abort();
    expect(await pending).toEqual({ ok: false, reason: 'network' });
  });
});
