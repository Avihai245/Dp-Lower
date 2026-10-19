/** Small rules of the two-step verification screens, kept apart from the components so that they can be tested. */

/** What a person typed into the code box, reduced to digits and cut to six (authenticator apps show "123 456"). */
export const cleanCode = (raw: string): string => raw.replace(/\D/g, '').slice(0, 6);

export const codeComplete = (code: string): boolean => /^\d{6}$/.test(code);

/** The part of an auth error the screens need: GoTrue's HTTP status and machine-readable code. */
export interface AuthProblem {
  status?: number;
  code?: string;
}

/** Which message to show for a failed challenge/verify/enroll call. */
export function problemKind(error: AuthProblem | null | undefined): 'invalid' | 'rateLimited' | 'generic' {
  if (!error) return 'generic';
  if (error.status === 429 || /rate_limit/.test(error.code ?? '')) return 'rateLimited';
  if (/^mfa_(verification|challenge)/.test(error.code ?? '') || error.status === 400 || error.status === 422) return 'invalid';
  return 'generic';
}

/**
 * The picture for an <img>: GoTrue returns the QR code as SVG (sometimes already prefixed `data:image/svg+xml;utf-8,`).
 * It is turned into a percent-encoded data URL, which the CSP allows (`img-src data:`) and every browser reads.
 */
export function qrSource(qr: string): string {
  const svg = qr.replace(/^data:image\/svg\+xml;utf-?8,/i, '');
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
