import { describe, expect, it } from 'vitest';
import { splitLtr } from './ltr';

const ltr = (s: string) => splitLtr(s).filter((p) => p.ltr).map((p) => p.text);
const joined = (s: string) => splitLtr(s).map((p) => p.text).join('');

describe('splitLtr', () => {
  it('finds a web address and leaves the comma after it outside', () => {
    expect(joined('By using the website https://lawoffice.org.il, or by contacting the firm')).toBe(
      'By using the website https://lawoffice.org.il, or by contacting the firm',
    );
    expect(ltr('By using the website https://lawoffice.org.il, or by')).toEqual(['https://lawoffice.org.il']);
  });

  it('finds telephone numbers and e-mail addresses, keeping the final full stop outside', () => {
    expect(ltr('telephone 055-978-1688, email office@lawoffice.org.il.')).toEqual(['055-978-1688', 'office@lawoffice.org.il']);
    expect(splitLtr('email office@lawoffice.org.il.').at(-1)).toEqual({ text: '.', ltr: false });
  });

  it('finds the two-digit area code form used by the Tel Aviv office', () => {
    expect(ltr('on 03-372-4722.')).toEqual(['03-372-4722']);
  });

  it('leaves ordinary words, numbers and statute references alone in English', () => {
    expect(ltr('Protection of Privacy Law, 5741-1981, Amendment 13, floor 25')).toEqual([]);
    expect(ltr('Google Analytics 4 and Meta pixels')).toEqual([]);
    expect(splitLtr('plain text')).toEqual([{ text: 'plain text', ltr: false }]);
  });

  it('in Hebrew text it also isolates contact tokens', () => {
    expect(ltr('לענייני פרטיות: טלפון 055-978-1688, דוא"ל office@lawoffice.org.il.')).toEqual(['055-978-1688', 'office@lawoffice.org.il']);
  });

  it('in Hebrew text it isolates runs of Latin words, with the Hebrew prefix and punctuation outside', () => {
    expect(ltr('מערכות דיוור, Google Analytics ו-Meta Ads')).toEqual(['Google Analytics', 'Meta Ads']);
    expect(ltr('העברות: AWS, Google Cloud או Microsoft Azure.')).toEqual(['AWS', 'Google Cloud', 'Microsoft Azure']);
    expect(ltr('כלי analytics (Google Analytics 4) ופיקסלים של Meta.')).toEqual(['analytics', 'Google Analytics 4', 'Meta']);
    expect(ltr('כתובת IP, סוג המכשיר')).toEqual(['IP']);
    expect(splitLtr('רוב Meta.').at(-1)).toEqual({ text: '.', ltr: false });
  });

  it('in Hebrew text it isolates a figure with a plus sign, so it reads 380+ and not +380', () => {
    expect(ltr('380+ ביקורות בגוגל')).toEqual(['380+']);
    expect(ltr('380+ Google reviews')).toEqual([]);
  });

  it('round-trips the input', () => {
    for (const input of [
      'a office@x.co b 03-372-4722 c https://a.b/c?d=1 e',
      'מערכות דיוור, Google Analytics ו-Meta Ads. עוד טקסט 5741-1981',
      'כל פרט (cookies), PCI DSS; IP.',
    ]) {
      expect(joined(input)).toBe(input);
    }
  });
});
