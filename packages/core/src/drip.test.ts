import { describe, expect, it } from 'vitest';
import { planDrip, WELCOME_DAYS, welcomeScheduledFor, type DripLeadState } from './drip';

const created = new Date('2026-10-01T10:00:00Z');
const day = (n: number, extraHours = 0) => new Date(created.getTime() + n * 86_400_000 + extraHours * 3_600_000);
const base: DripLeadState = {
  createdAt: created,
  unsubscribedAt: null,
  submittedAt: null,
  stage: 'account',
  hasBooking: false,
  docsReceived: 0,
  docsTotal: 8,
  route: 'germany',
};

describe('drip schedule', () => {
  it('has fifteen emails on the designed days', () => {
    expect(WELCOME_DAYS).toHaveLength(15);
    expect(WELCOME_DAYS.slice(0, 5)).toEqual([0, 2, 3, 5, 8]);
    expect(WELCOME_DAYS[14]).toBe(46);
    expect(welcomeScheduledFor(created, 3).toISOString()).toBe(day(3).toISOString());
  });
});

describe('planDrip', () => {
  it('sends email 1 immediately', () => {
    expect(planDrip(base, [], created)).toEqual([{ action: 'send', number: 1, scheduledFor: created }]);
  });

  it('does nothing before the next email is due', () => {
    expect(planDrip(base, [{ number: 1, status: 'sent', sentAt: created }], day(1))).toEqual([]);
  });

  it('sends email 2 on day 2', () => {
    const d = planDrip(base, [{ number: 1, status: 'sent', sentAt: created }], day(2, 1));
    expect(d).toEqual([{ action: 'send', number: 2, scheduledFor: day(2) }]);
  });

  it('skips email 3 when a call is booked, and sends the next due one', () => {
    const records = [
      { number: 1, status: 'sent' as const, sentAt: created },
      { number: 2, status: 'sent' as const, sentAt: day(2) },
    ];
    const d = planDrip({ ...base, hasBooking: true }, records, day(3, 1));
    expect(d).toEqual([{ action: 'skip', number: 3, scheduledFor: day(3), reason: 'already_booked' }]);
  });

  it('sends the document nudges (2 and 4) only while nothing has been uploaded', () => {
    const sentFirst = [{ number: 1, status: 'sent' as const, sentAt: created }];
    expect(planDrip({ ...base, docsReceived: 0 }, sentFirst, day(2, 1))).toEqual([{ action: 'send', number: 2, scheduledFor: day(2) }]);
    // one document is enough to skip, and so is a complete set
    for (const docsReceived of [1, 3, 8]) {
      const d = planDrip({ ...base, docsReceived }, sentFirst, day(2, 1));
      expect(d, `${docsReceived} documents`).toEqual([{ action: 'skip', number: 2, scheduledFor: day(2), reason: 'documents_started' }]);
    }
    const upToThree = [...sentFirst, { number: 2, status: 'sent' as const, sentAt: day(2) }, { number: 3, status: 'sent' as const, sentAt: day(3) }];
    expect(planDrip({ ...base, docsReceived: 2 }, upToThree, day(5, 1))).toEqual([{ action: 'skip', number: 4, scheduledFor: day(5), reason: 'documents_started' }]);
  });

  it('stops for good on unsubscribe, submission and once the case is past the application', () => {
    expect(planDrip({ ...base, unsubscribedAt: day(1) }, [], day(5))).toEqual([{ action: 'stop', reason: 'unsubscribed' }]);
    expect(planDrip({ ...base, submittedAt: day(1) }, [], day(5))).toEqual([{ action: 'stop', reason: 'submitted' }]);
    expect(planDrip({ ...base, stage: 'review' }, [], day(5))).toEqual([{ action: 'stop', reason: 'past_application' }]);
  });

  it('does not send a burst after downtime: old emails are skipped, one current email is sent', () => {
    // dispatcher was down; it is now day 12 and only email 1 went out
    const d = planDrip(base, [{ number: 1, status: 'sent', sentAt: created }], day(12));
    const sends = d.filter((x) => x.action === 'send');
    expect(sends).toHaveLength(1);
    // days 2, 3, 5, 8, 11 are due; only the ones inside the 36h window can be sent (day 11 = 25h ago)
    expect(sends[0]).toMatchObject({ number: 6 });
    const skipped = d.filter((x) => x.action === 'skip').map((x) => (x as { number: number }).number);
    expect(skipped).toEqual([2, 3, 4, 5]);
  });

  it('keeps a minimum gap between two sends', () => {
    const records = [
      { number: 1, status: 'sent' as const, sentAt: created },
      { number: 2, status: 'sent' as const, sentAt: day(2, 10) },
    ];
    // email 3 is due on day 3 10:00 but email 2 left only 14h earlier
    expect(planDrip(base, records, day(3, 1))).toEqual([]);
    expect(planDrip(base, records, day(3, 12))).toEqual([{ action: 'send', number: 3, scheduledFor: day(3) }]);
  });

  it('is idempotent for numbers already recorded', () => {
    const records = [1, 2, 3].map((number) => ({ number, status: 'sent' as const, sentAt: day(number) }));
    expect(planDrip(base, records, day(3, 2))).toEqual([]);
  });
});
