import type { ContactPayload } from './validation';

/**
 * Why a submission did not go through:
 *  - rate_limited: the API answered 429 (5 enquiries a minute per address)
 *  - captcha: the Turnstile token was missing, expired or refused (400 captcha_failed)
 *  - invalid: the API rejected the body (400), which the client-side validation should have prevented
 *  - network: no answer (offline, DNS, timeout)
 *  - server: any other failure (403, 5xx...)
 */
export type SubmitFailure = 'rate_limited' | 'captcha' | 'invalid' | 'network' | 'server';
export type SubmitResult = { ok: true } | { ok: false; reason: SubmitFailure };

/** The body of POST /api/contact: the payload plus the Turnstile token when the site uses it. */
export type ContactRequest = ContactPayload & { turnstileToken?: string };

export const CONTACT_ENDPOINT = '/api/contact';

/** POST /api/contact. Never throws: every outcome is a SubmitResult. */
export async function postContact(
  payload: ContactRequest,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<SubmitResult> {
  const { fetchImpl = fetch, timeoutMs = 20_000, signal } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  try {
    const res = await fetchImpl(CONTACT_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
      signal: controller.signal,
    });
    if (res.ok) return { ok: true };
    if (res.status === 429) return { ok: false, reason: 'rate_limited' };
    if (res.status === 400) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, reason: body?.error === 'captcha_failed' ? 'captcha' : 'invalid' };
    }
    return { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
