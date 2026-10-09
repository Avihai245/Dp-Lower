/** Small HMAC-signed tokens (lead cookie, emailed portal links, unsubscribe links). Works in Node, Edge and browsers. */

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64urlDecode(str: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * What a token may be used for. Every token names its purpose (`p`) and is only accepted for that purpose: the
 * unsubscribe link in an email, which never expires, must not also work as the cookie that signs a browser in.
 */
export type TokenPurpose = 'lead' | 'portal' | 'unsub';

export async function signToken(
  payload: { p: TokenPurpose } & Record<string, unknown>,
  secret: string,
  ttlSeconds?: number,
): Promise<string> {
  const body = ttlSeconds ? { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds } : payload;
  const data = b64urlEncode(enc.encode(JSON.stringify(body)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), enc.encode(data));
  return `${data}.${b64urlEncode(new Uint8Array(sig))}`;
}

/** Returns the payload, or null when the token is malformed, tampered with, expired or signed for another purpose. */
export async function verifyToken<T extends Record<string, unknown>>(
  token: string | undefined | null,
  secret: string,
  purpose: TokenPurpose,
): Promise<T | null> {
  if (!token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), b64urlDecode(sig), enc.encode(data));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(b64urlDecode(data))) as T & { exp?: number; p?: string };
    if (payload.p !== purpose) return null;
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
