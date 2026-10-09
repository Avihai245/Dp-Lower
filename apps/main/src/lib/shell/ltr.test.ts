import { describe, expect, it } from 'vitest';
import { isNumberLike } from './ltr';

describe('isNumberLike', () => {
  it('recognises phone numbers in the shapes the site and its visitors use', () => {
    for (const n of ['03-372-4722', '+972-3-372-4722', '+972 54 123 4567', '054-1234567', '(03) 372 4722', ' 0541234567 ']) expect(isNumberLike(n), n).toBe(true);
  });
  it('leaves words, emails and empty text alone', () => {
    for (const n of ['', 'office@lawoffice.org.il', 'Tel Aviv', '4.9★', 'ext. 12', '-']) expect(isNumberLike(n), n).toBe(false);
  });
});
