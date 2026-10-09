import { describe, expect, it } from 'vitest';
import {
  applicationPercent,
  buildChecklist,
  dashboardHeadline,
  docsSubmitLine,
  firstOpenSection,
  momentum,
  nextLine,
  portalPercent,
  SECTIONS_TOTAL,
} from './progress';

const aboutDone = { fullName: 'Anna Reinhardt', dob: '12/03/1988', birthPlace: 'Boston', citizenship: 'US' };
const ancestorDone = { anName: 'Ruth Weiss', anRel: 'grandmother', anDob: '1911', anBirthPlace: 'Vienna', anLeft: '1938' };
const lineDone = { nameChanges: 'None' };
const contactDone = { email: 'a@b.co', phone: '+4915112345678', address: 'Berlin' };

describe('progress', () => {
  it('counts five sections in the wording but four that collect answers', () => {
    expect(SECTIONS_TOTAL).toBe(5);
    expect(applicationPercent(0)).toBe(0);
    expect(applicationPercent(1)).toBe(25);
    expect(applicationPercent(4)).toBe(100);
  });

  it('weighs the application 70% and the documents 30%', () => {
    expect(portalPercent(0, 0, 8)).toBe(0);
    expect(portalPercent(2, 4, 8)).toBe(50); // 50% of 70% + 50% of 30% = 35 + 15
    expect(portalPercent(2, 8, 8)).toBe(65);
    expect(portalPercent(4, 0, 8)).toBe(70);
    expect(portalPercent(4, 8, 8)).toBe(100);
    expect(portalPercent(4, 3, 0)).toBe(70);
  });

  it('finds the first section that still needs answers', () => {
    expect(firstOpenSection({})).toBe(0);
    expect(firstOpenSection(aboutDone)).toBe(1);
    expect(firstOpenSection({ ...aboutDone, ...lineDone })).toBe(1);
    expect(firstOpenSection({ ...aboutDone, ...ancestorDone, ...lineDone })).toBe(3);
    expect(firstOpenSection({ ...aboutDone, ...ancestorDone, ...lineDone, ...contactDone })).toBeNull();
    // the optional generation lines do not block the family-line section
    expect(firstOpenSection({ ...aboutDone, ...ancestorDone, nameChanges: 'None', line1: '' })).toBe(3);
  });

  it('builds the five-step checklist', () => {
    expect(buildChecklist({ applicationComplete: false, docsReceived: 0, docsTotal: 8 }).map((c) => c.state)).toEqual([
      'done',
      'done',
      'current',
      'next',
      'next',
    ]);
    expect(buildChecklist({ applicationComplete: true, docsReceived: 2, docsTotal: 8 }).map((c) => c.state)).toEqual([
      'done',
      'done',
      'done',
      'current',
      'next',
    ]);
    expect(buildChecklist({ applicationComplete: true, docsReceived: 8, docsTotal: 8 }).map((c) => c.state)).toEqual([
      'done',
      'done',
      'done',
      'done',
      'next',
    ]);
  });

  it('words the momentum line like the prototype', () => {
    expect(momentum(0)).toEqual({ kind: 'start' });
    expect(momentum(1)).toEqual({ kind: 'toGo', left: 4 });
    expect(momentum(2)).toEqual({ kind: 'pastHalf', left: 3 });
    expect(momentum(3)).toEqual({ kind: 'pastHalf', left: 2 });
    expect(momentum(4)).toEqual({ kind: 'almost' });
  });

  it('picks the dashboard headline', () => {
    expect(dashboardHeadline({ started: false, applicationComplete: false })).toBe('start');
    expect(dashboardHeadline({ started: true, applicationComplete: false })).toBe('back');
    expect(dashboardHeadline({ started: true, applicationComplete: true })).toBe('ready');
  });

  it('says what comes next', () => {
    expect(nextLine({ data: {}, docsReceived: 0, docsTotal: 8 })).toEqual({ kind: 'section', index: 0 });
    expect(nextLine({ data: aboutDone, docsReceived: 0, docsTotal: 8 })).toEqual({ kind: 'section', index: 1 });
    const all = { ...aboutDone, ...ancestorDone, ...lineDone, ...contactDone };
    expect(nextLine({ data: all, docsReceived: 4, docsTotal: 8 })).toEqual({ kind: 'docsLeft', count: 4 });
    expect(nextLine({ data: all, docsReceived: 8, docsTotal: 8 })).toEqual({ kind: 'allIn' });
  });

  it('chooses the sentence above the submit button', () => {
    const line = (p: Partial<Parameters<typeof docsSubmitLine>[0]>) =>
      docsSubmitLine({ applicationComplete: true, hasReupload: false, docsReceived: 3, docsTotal: 8, ...p });
    expect(line({ applicationComplete: false })).toBe('finishApplication');
    expect(line({ applicationComplete: false, hasReupload: true })).toBe('finishApplication');
    expect(line({ hasReupload: true })).toBe('unreadable');
    expect(line({ docsReceived: 8 })).toBe('allIn');
    expect(line({})).toBe('canSubmit');
  });
});
