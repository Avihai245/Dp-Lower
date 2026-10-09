import { describe, expect, it, vi } from 'vitest';

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
