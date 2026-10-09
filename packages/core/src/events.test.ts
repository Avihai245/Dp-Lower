import { describe, expect, it } from 'vitest';
import { CRM_EVENT_TYPES, type CrmEventType } from './events';

describe('CRM event types', () => {
  it('are unique, lower-case `noun.verb` keys (or a single word)', () => {
    expect(new Set(CRM_EVENT_TYPES).size).toBe(CRM_EVENT_TYPES.length);
    for (const t of CRM_EVENT_TYPES) expect(t).toMatch(/^[a-z]+(\.[a-z_]+)?$/);
  });

  it('cover the whole life of a booked call', () => {
    const booking: CrmEventType[] = ['booking.created', 'booking.cancelled', 'booking.no_show', 'booking.held'];
    expect(CRM_EVENT_TYPES).toEqual(expect.arrayContaining(booking));
  });

  it('keep the email channel apart', () => {
    expect(CRM_EVENT_TYPES as readonly string[]).not.toContain('email.send');
  });
});
