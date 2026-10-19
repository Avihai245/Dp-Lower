import { createHmac } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(text: string): Buffer {
  let bits = '';
  for (const ch of text.replace(/[\s=]+/g, '').toUpperCase()) bits += ALPHABET.indexOf(ch).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/**
 * The 6-digit code an authenticator app shows for a base32 secret (RFC 6238: HMAC-SHA1, 30-second steps). `stepOffset`
 * picks a neighbouring step: the auth server accepts one step either way, and a test that needs a second, different code
 * within the same half minute takes the next or the previous one.
 */
export function totpCode(secret: string, stepOffset = 0, now = Date.now()): string {
  const counter = Math.floor(now / 1000 / 30) + stepOffset;
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac('sha1', base32Decode(secret)).update(message).digest();
  const at = hash[hash.length - 1]! & 0xf;
  const value = ((hash[at]! & 0x7f) << 24) | (hash[at + 1]! << 16) | (hash[at + 2]! << 8) | hash[at + 3]!;
  return String(value % 1_000_000).padStart(6, '0');
}
