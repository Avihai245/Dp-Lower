import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { clientIp } = await import('./http');

const req = (headers: Record<string, string>) => new Request('http://localhost/x', { headers });

describe('clientIp (the rate-limit bucket)', () => {
  it('prefers what the platform sets over anything the visitor could send', () => {
    expect(clientIp(req({ 'x-vercel-forwarded-for': '203.0.113.7', 'x-real-ip': '198.51.100.1', 'x-forwarded-for': '6.6.6.6' }))).toBe('203.0.113.7');
    expect(clientIp(req({ 'x-real-ip': '198.51.100.1', 'x-forwarded-for': '6.6.6.6' }))).toBe('198.51.100.1');
  });
  it('takes the entry added by the closest proxy, not the first one, which a visitor can forge', () => {
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 203.0.113.7' }))).toBe('203.0.113.7');
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
  });
  it('has a bucket even without any header', () => {
    expect(clientIp(req({}))).toBe('unknown');
  });
});

describe('clientIp behind other proxies (AWS Amplify / CloudFront)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('xff: ignores the headers only Vercel guarantees, and the entries a visitor can write', () => {
    vi.stubEnv('CLIENT_IP_SOURCE', 'xff');
    // a visitor who sends x-real-ip / x-vercel-forwarded-for / a forged x-forwarded-for cannot choose their bucket
    expect(clientIp(req({ 'x-real-ip': '1.1.1.1', 'x-vercel-forwarded-for': '2.2.2.2', 'x-forwarded-for': '6.6.6.6, 203.0.113.7' }))).toBe('203.0.113.7');
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
    expect(clientIp(req({ 'x-real-ip': '1.1.1.1' }))).toBe('unknown');
  });

  it('xff with more than one trusted proxy counts from the right', () => {
    vi.stubEnv('CLIENT_IP_SOURCE', 'xff');
    vi.stubEnv('TRUSTED_PROXY_HOPS', '2');
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 203.0.113.7, 10.0.0.9' }))).toBe('203.0.113.7');
    // fewer entries than hops: the first one rather than nothing
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('cloudfront: the viewer address CloudFront sets, IPv4 or IPv6, else the xff rule', () => {
    vi.stubEnv('CLIENT_IP_SOURCE', 'cloudfront');
    expect(clientIp(req({ 'cloudfront-viewer-address': '203.0.113.7:51234', 'x-real-ip': '1.1.1.1' }))).toBe('203.0.113.7');
    expect(clientIp(req({ 'cloudfront-viewer-address': '[2001:db8::1]:51234' }))).toBe('2001:db8::1');
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 198.51.100.4' }))).toBe('198.51.100.4');
  });

  it('vercel (default) is unchanged', () => {
    expect(clientIp(req({ 'x-real-ip': '198.51.100.1' }))).toBe('198.51.100.1');
  });
});
