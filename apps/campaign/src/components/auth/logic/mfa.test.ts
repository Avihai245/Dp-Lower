import { describe, expect, it } from 'vitest';
import { cleanCode, codeComplete, problemKind, qrSource } from './mfa';

describe('cleanCode', () => {
  it('keeps the digits only and at most six of them', () => {
    expect(cleanCode('123 456')).toBe('123456');
    expect(cleanCode('12-34-56-78')).toBe('123456');
    expect(cleanCode(' ab1c2 ')).toBe('12');
    expect(cleanCode('')).toBe('');
  });
});

describe('codeComplete', () => {
  it('wants exactly six digits', () => {
    expect(codeComplete('123456')).toBe(true);
    expect(codeComplete('12345')).toBe(false);
    expect(codeComplete('1234567')).toBe(false);
    expect(codeComplete('12345a')).toBe(false);
  });
});

describe('problemKind', () => {
  it('tells a wrong code from a rate limit and from everything else', () => {
    expect(problemKind({ status: 400, code: 'mfa_verification_failed' })).toBe('invalid');
    expect(problemKind({ status: 400, code: 'mfa_challenge_expired' })).toBe('invalid');
    expect(problemKind({ status: 422, code: 'validation_failed' })).toBe('invalid');
    expect(problemKind({ status: 429, code: 'over_request_rate_limit' })).toBe('rateLimited');
    expect(problemKind({ code: 'over_email_send_rate_limit' })).toBe('rateLimited');
    expect(problemKind({ status: 500 })).toBe('generic');
    expect(problemKind(null)).toBe('generic');
  });
});

describe('qrSource', () => {
  it('turns the SVG, with or without the data prefix, into one percent-encoded data URL', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>';
    const want = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    expect(qrSource(svg)).toBe(want);
    expect(qrSource(`data:image/svg+xml;utf-8,${svg}`)).toBe(want);
    expect(qrSource(`data:image/svg+xml;utf8,${svg}`)).toBe(want);
  });
});
