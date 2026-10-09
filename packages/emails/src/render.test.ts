import type { Locale } from '@dpl/core';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { sampleContext } from './fixtures';
import { renderEmail } from './render';
import {
  ALL_TEMPLATES,
  isNurtureTemplate,
  TRANSACTIONAL_TEMPLATES,
  WELCOME_TEMPLATES,
  type EmailTemplateId,
} from './types';

const LOCALES: Locale[] = ['en', 'he'];
const HEBREW = /[\u{0590}-\u{05ff}]/u;
const BODY = (html: string) => html.slice(html.indexOf('</style>'));

/** every href / src value of the document */
const urls = (html: string): string[] =>
  [...html.matchAll(/\b(?:href|src)="([^"]*)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'));

describe('the registry', () => {
  it('has the fifteen welcome emails and every transactional one', () => {
    expect(WELCOME_TEMPLATES).toHaveLength(15);
    expect(ALL_TEMPLATES).toHaveLength(WELCOME_TEMPLATES.length + TRANSACTIONAL_TEMPLATES.length);
    for (const id of ALL_TEMPLATES) expect(() => renderEmail(id, sampleContext(id, 'en'))).not.toThrow();
  });

  it('throws for an unknown template instead of sending an empty email', () => {
    expect(() => renderEmail('nope' as EmailTemplateId, sampleContext('welcome-1', 'en'))).toThrow(
      /Unknown email template/,
    );
  });
});

describe.each(ALL_TEMPLATES.flatMap((id) => LOCALES.map((locale) => [id, locale] as const)))(
  '%s [%s]',
  (id, locale) => {
    const ctx = sampleContext(id, locale);
    const r = renderEmail(id, ctx);

    it('has a subject, a preheader and a plain-text version', () => {
      expect(r.subject.trim().length).toBeGreaterThan(3);
      expect(r.preheader.trim().length).toBeGreaterThan(3);
      expect(r.text.trim().length).toBeGreaterThan(50);
      expect(r.subject).not.toMatch(/[<>{}]/);
      expect(r.preheader).not.toMatch(/[<>{}]/);
    });

    it('leaves no placeholder, "undefined" or "[object" behind', () => {
      for (const s of [r.subject, r.preheader, r.html, r.text]) {
        expect(s).not.toContain('{{');
        expect(s).not.toContain('}}');
        expect(s).not.toMatch(/undefined|\[object|NaN|\bnull\b/);
      }
      expect(BODY(r.html)).not.toMatch(/\{[A-Za-z0-9_]+\}/);
      expect(r.text).not.toMatch(/\{[A-Za-z0-9_]+\}/);
      expect(r.text).not.toMatch(/<\/?[a-z][^>]*>/i);
    });

    it('declares the language and direction', () => {
      expect(r.html.startsWith('<!DOCTYPE html>')).toBe(true);
      if (locale === 'he') {
        expect(r.html).toContain('<html lang="he" dir="rtl">');
        expect(r.html).toContain('<body');
        expect(/<body[^>]*dir="rtl"/.test(r.html)).toBe(true);
      } else {
        expect(r.html).toContain('<html lang="en">');
        expect(r.html).not.toContain('dir="rtl"');
      }
    });

    it('is in the right language', () => {
      const visible = r.html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
      if (locale === 'he') {
        expect(HEBREW.test(r.subject)).toBe(true);
        expect(HEBREW.test(r.preheader)).toBe(true);
        expect(HEBREW.test(r.text)).toBe(true);
        expect(HEBREW.test(visible)).toBe(true);
      } else {
        expect(HEBREW.test(r.subject + r.preheader + visible + r.text)).toBe(false);
      }
    });

    it('only links to absolute https addresses (plus mailto: and tel:)', () => {
      const list = urls(r.html);
      expect(list.length).toBeGreaterThan(2);
      for (const u of list) expect(u).toMatch(/^(https:\/\/|mailto:|tel:)/);
      expect(r.html).not.toMatch(/<script|<link |<iframe|javascript:/i);
    });

    it('is well-formed: every tag is closed in the right order', () => {
      const stack: string[] = [];
      const VOID = new Set(['meta', 'br', 'img', 'link', 'hr', 'input']);
      const withoutComments = r.html.replace(/<!--[\s\S]*?-->/g, '').replace(/<!DOCTYPE[^>]*>/i, '');
      for (const m of withoutComments.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g)) {
        const [, closing, name] = m;
        const tag = name!.toLowerCase();
        if (VOID.has(tag)) continue;
        if (closing) expect(stack.pop(), `unexpected </${tag}>`).toBe(tag);
        else stack.push(tag);
      }
      expect(stack).toEqual([]);
    });

    it('is a plain table layout with inline styles and the mobile rules', () => {
      expect(r.html).toContain('<meta name="viewport"');
      expect(r.html).toContain('role="presentation"');
      expect(r.html).toContain('@media only screen and (max-width: 600px)');
      expect(r.html.length).toBeLessThan(90_000); // Gmail clips messages above ~102 KB
    });

    it('carries the unsubscribe link on the nurture emails and never on the transactional ones', () => {
      if (isNurtureTemplate(id)) {
        expect(urls(r.html)).toContain(ctx.links.unsubscribe);
        expect(r.text).toContain(ctx.links.unsubscribe!);
      } else {
        expect(r.html).not.toMatch(/unsubscribe|הסרה מרשימת התפוצה/i);
        expect(r.text).not.toMatch(/unsubscribe|הסרה מרשימת התפוצה/i);
      }
    });

    it('shows the portal link', () => {
      if (
        id === 'password-reset' ||
        id === 'booking-cancelled' ||
        id === 'contact-received' ||
        id === 'auth-link'
      )
        return;
      expect(urls(r.html)).toContain(ctx.links.portal);
    });
  },
);

describe('Welcome 3 books through the landing page', () => {
  it('points "Book my free call" at links.booking', () => {
    const ctx = sampleContext('welcome-3', 'en');
    const r = renderEmail('welcome-3', ctx);
    expect(r.html).toMatch(
      new RegExp(
        `<a href="${ctx.links.booking.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}"[^>]*>Book my free call</a>`,
      ),
    );
    expect(renderEmail('welcome-3', sampleContext('welcome-3', 'he')).html).toContain('קביעת שיחה חינם');
  });
});

describe('Welcome 15 follows the lead’s route', () => {
  const render = (route: 'germany' | 'austria' | 'both' | 'unsure' | null, locale: Locale = 'en') =>
    renderEmail('welcome-15', sampleContext('welcome-15', locale, { route }));

  it('shows only Germany for a German lead', () => {
    const r = render('germany');
    expect(r.html).toContain('Article 116');
    expect(r.html).not.toContain('Section 58c');
    expect(r.subject).toBe('The German route, in plain terms');
    expect(r.text).toContain('Germany');
    expect(r.text).not.toContain('58c');
  });

  it('shows only Austria for an Austrian lead', () => {
    const r = render('austria');
    expect(r.html).toContain('Section 58c');
    expect(r.html).not.toContain('Article 116');
    expect(r.subject).toBe('The Austrian route, in plain terms');
  });

  it('shows both side by side for "both", "unsure" and no route', () => {
    for (const route of ['both', 'unsure', null] as const) {
      const r = render(route);
      expect(r.html).toContain('Article 116');
      expect(r.html).toContain('Section 58c');
      expect(r.subject).toBe('The two routes, side by side');
      expect(r.html.match(/class="stack"/g)).toHaveLength(2);
    }
  });

  it('has the same three variants in Hebrew', () => {
    expect(render('germany', 'he').html).toContain('גרמניה');
    expect(render('germany', 'he').html).not.toContain('58c');
    expect(render('austria', 'he').html).toContain('58c');
    expect(render('austria', 'he').html).not.toContain('116');
    expect(render('both', 'he').html).toContain('58c');
    expect(render('both', 'he').html).toContain('116');
  });
});

describe('booking emails format the call in the recipient’s time zone', () => {
  const at = '2026-10-14T13:30:00.000Z';
  const booking = (timezone: string, locale: Locale = 'en') =>
    renderEmail(
      'booking-confirmation',
      sampleContext('booking-confirmation', locale, { data: { startsAt: at, timezone, minutes: 20 } }),
    );

  it('shows 9:30 AM for New York and 4:30 PM for Jerusalem (same instant)', () => {
    const ny = booking('America/New_York');
    const il = booking('Asia/Jerusalem');
    expect(ny.html).toContain('Wednesday, October 14, 2026');
    expect(ny.html).toContain('9:30 AM EDT');
    expect(ny.html).not.toContain('4:30 PM');
    expect(il.html).toContain('4:30 PM GMT+3');
    expect(il.html).not.toContain('9:30 AM');
    expect(ny.text).toContain('9:30 AM EDT');
    expect(il.text).toContain('4:30 PM GMT+3');
    expect(ny.preheader).toContain('9:30 AM EDT');
  });

  it('formats Hebrew emails with Hebrew dates and 24-hour times', () => {
    const il = booking('Asia/Jerusalem', 'he');
    expect(il.html).toContain('יום רביעי, 14 באוקטובר 2026');
    expect(il.html).toContain('16:30 GMT+3');
    const ny = booking('America/New_York', 'he');
    expect(ny.html).toContain('09:30 GMT-4');
  });

  it('follows daylight saving: Jerusalem is GMT+2 once the clocks change on 25 October 2026', () => {
    const r = renderEmail(
      'booking-confirmation',
      sampleContext('booking-confirmation', 'en', {
        data: { startsAt: '2026-10-28T13:30:00.000Z', timezone: 'Asia/Jerusalem', minutes: 20 },
      }),
    );
    expect(r.html).toContain('3:30 PM GMT+2');
  });

  it('falls back to the firm’s time zone for a missing or invalid zone, and never throws on a bad date', () => {
    expect(booking('Not/AZone').html).toContain('4:30 PM GMT+3');
    expect(booking('').html).toContain('4:30 PM GMT+3');
    const bad = renderEmail(
      'booking-cancelled',
      sampleContext('booking-cancelled', 'en', { data: { startsAt: 'garbage', timezone: 'Asia/Jerusalem' } }),
    );
    expect(bad.html).not.toContain('Invalid');
    expect(bad.html).toContain('garbage');
  });

  it('names the number it will call, and falls back when there is none', () => {
    const ctx = sampleContext('booking-confirmation', 'en');
    expect(renderEmail('booking-confirmation', ctx).html).toContain(
      'We will call +1 212 555 0142 and ask for David.',
    );
    const noPhone = { ...ctx, lead: { ...ctx.lead, phone: null } };
    expect(renderEmail('booking-confirmation', noPhone).html).toContain(
      'We will call your number and ask for David.',
    );
  });
});

describe('dynamic content', () => {
  it('names the status in the subject and the plate', () => {
    const r = renderEmail(
      'status-update',
      sampleContext('status-update', 'en', { data: { status: 'info_required' } }),
    );
    expect(r.subject).toBe('Your case status: Additional Information Required');
    expect(r.html).toContain('Additional Information Required');
    const he = renderEmail(
      'status-update',
      sampleContext('status-update', 'he', { data: { status: 'info_required' } }),
    );
    expect(he.subject).toBe('סטטוס התיק שלכם: נדרש מידע נוסף');
  });

  it('falls back to a safe status for unknown data', () => {
    const r = renderEmail(
      'status-update',
      sampleContext('status-update', 'en', { data: { status: 'hacked' } }),
    );
    expect(r.subject).toBe('Your case status: Under Review');
  });

  it('lists the requested documents with the portal’s wording', () => {
    const r = renderEmail(
      'document-requested',
      sampleContext('document-requested', 'en', {
        data: { docTypes: ['birth_certificate', 'photo_id', 'bogus' as never] },
      }),
    );
    expect(r.html).toContain('Ancestor&rsquo;s birth certificate');
    expect(r.html).toContain('Photo ID for each applicant');
    expect(r.html).not.toContain('bogus');
    expect(
      renderEmail(
        'document-requested',
        sampleContext('document-requested', 'he', { data: { docTypes: ['passport'] } }),
      ).html,
    ).toContain('הדרכון שלכם');
  });

  it('shows the file plate state of the Lead Email', () => {
    const base = sampleContext('file-open', 'en', { route: 'austria' });
    const fresh = renderEmail('file-open', {
      ...base,
      data: { applicationState: 'not_started', docsReceived: 0, docsTotal: 8 },
    });
    expect(fresh.html).toContain('Austria');
    expect(fresh.html).toContain('Not yet started');
    expect(fresh.html).toContain('None yet');
    expect(fresh.html).toContain('DPL-26-1487');
    const mid = renderEmail('file-open', {
      ...base,
      data: { applicationState: 'in_progress', docsReceived: 3, docsTotal: 8 },
    });
    expect(mid.html).toContain('In progress');
    expect(mid.html).toContain('3 of 8');
    const both = renderEmail('file-open', {
      ...base,
      lead: { ...base.lead, route: 'both' },
      data: undefined,
    });
    expect(both.html).toContain('Germany and Austria');
    expect(both.html).toContain('Not yet started');
  });

  it('uses the firm’s real Tel Aviv address in the Lead Email footer', () => {
    expect(renderEmail('file-open', sampleContext('file-open', 'en')).html).toContain(
      '11 Menachem Begin Road, Ramat Gan. Rogovin Tidhar Tower, 25th floor. P.O.B 1213, 5268104, Israel',
    );
    expect(renderEmail('file-open', sampleContext('file-open', 'en')).html).not.toContain('[Street address]');
    expect(renderEmail('file-open', sampleContext('file-open', 'he')).html).toContain('מנחם בגין 11, רמת גן');
  });

  it('keeps the placeholder marketing claims exactly as designed', () => {
    const w1 = renderEmail('welcome-1', sampleContext('welcome-1', 'en')).html;
    expect(w1).toContain('4.9 average, 380+ reviews');
    const lead = renderEmail('file-open', sampleContext('file-open', 'en')).html;
    expect(lead).toContain('Up to 30% off');
    expect(lead).toContain('4.9 average across 380+ reviews');
    expect(lead).toContain('Dun&rsquo;s 100, 2026');
  });

  it('uses the sender name Decker Pex Levi in the footers', () => {
    expect(renderEmail('welcome-2', sampleContext('welcome-2', 'en')).text).toContain('DECKER PEX LEVI');
    expect(renderEmail('welcome-2', sampleContext('welcome-2', 'he')).text).toContain('דקר פקס לוי');
  });

  it('wraps Latin names and numbers in Hebrew emails so punctuation does not reorder', () => {
    const r = renderEmail('welcome-1', sampleContext('welcome-1', 'he', { name: 'David Cohen' }));
    expect(r.html).toContain('<span dir="auto" style="unicode-bidi:isolate;">David</span>');
    const q = renderEmail('welcome-1', sampleContext('welcome-1', 'he'));
    expect(q.html).toContain('<span dir="ltr" style="unicode-bidi:isolate;">380+</span>');
    const lead = renderEmail('file-open', sampleContext('file-open', 'he'));
    expect(lead.html).toContain('<span dir="ltr" style="unicode-bidi:isolate;">DPL-26-1487</span>');
    expect(lead.html).toContain('<span dir="ltr" style="unicode-bidi:isolate;">Dun&rsquo;s 100, 2026</span>');
    // plain text: every Hebrew line starts with a right-to-left mark
    for (const line of r.text.split('\n').filter((l) => HEBREW.test(l)))
      expect(line.startsWith('\u{200f}')).toBe(true);
  });

  it('mirrors the layout in Hebrew: right-aligned text, mirrored paddings, no tracked capitals', () => {
    const he = renderEmail('welcome-5', sampleContext('welcome-5', 'he')).html;
    expect(he).toContain('text-align:right');
    expect(he).toContain('padding:14px 0 14px 16px'); // the fee label cell: the 16px gap moves to the other side
    expect(he).not.toMatch(/letter-spacing:0\.2em|text-transform:uppercase/);
    expect(he).toContain('Assistant,Arial');
    const en = renderEmail('welcome-5', sampleContext('welcome-5', 'en')).html;
    expect(en).toContain('padding:14px 16px 14px 0');
    expect(en).toContain('letter-spacing:0.2em; text-transform:uppercase');
    // Hebrew buttons are aligned through a cell, never with a floating table
    expect(renderEmail('welcome-1', sampleContext('welcome-1', 'he')).html).not.toContain(
      'class="cta" align="right"',
    );
  });
});

describe('escaping', () => {
  const HOSTILE = '<script>alert(1)</script>"><img src=x onerror=alert(1)>{{x}}';

  it.each(ALL_TEMPLATES.flatMap((id) => LOCALES.map((locale) => [id, locale] as const)))(
    '%s [%s] escapes a hostile first name',
    (id, locale) => {
      const base = sampleContext(id, locale);
      const ctx = {
        ...base,
        lead: { ...base.lead, firstName: HOSTILE, fullName: HOSTILE },
        data: id === 'contact-received' ? { name: HOSTILE } : base.data,
      };
      const r = renderEmail(id, ctx);
      const doc = new JSDOM(r.html).window.document;
      // nothing the name contained became markup: no script, no injected image, no event-handler attribute anywhere
      expect(doc.querySelectorAll('script').length).toBe(0);
      expect(doc.querySelectorAll('img[src="x"]').length).toBe(0);
      for (const el of Array.from(doc.querySelectorAll('*'))) {
        for (const a of Array.from(el.attributes)) expect(a.name.startsWith('on')).toBe(false);
      }
      // ... and it is shown as text
      // (the contact acknowledgement greets the first word of the name only)
      const shown = id === 'contact-received' ? HOSTILE.split(/\s+/)[0]! : HOSTILE;
      expect(r.html).toContain(
        shown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
      );
      expect(doc.body.textContent).toContain(shown);
      expect(r.subject).not.toContain('<script>');
    },
  );

  it('escapes a reviewer’s note, a case reference and every URL', () => {
    const doc = renderEmail(
      'document-rejected',
      sampleContext('document-rejected', 'en', {
        data: { docType: 'passport', note: '<b onmouseover=alert(1)>blurred</b>\nsecond line {first}' },
      }),
    );
    expect(doc.html).toContain('&lt;b onmouseover=alert(1)&gt;blurred&lt;/b&gt;<br>second line {first}');
    expect(doc.html).not.toContain('<b onmouseover');
    const ref = sampleContext('file-open', 'en');
    const r = renderEmail('file-open', { ...ref, lead: { ...ref.lead, caseRef: '"><svg onload=1>' } });
    expect(r.html).not.toContain('<svg');
    const evil = sampleContext('password-reset', 'en');
    const reset = renderEmail('password-reset', {
      ...evil,
      data: { resetUrl: 'https://euro-passports.com/x?a=1&b="onmouseover="alert(1)' },
    });
    expect(reset.html).not.toContain('"onmouseover="');
    expect(reset.html).toContain('a=1&amp;b=&quot;onmouseover=&quot;alert(1)');
    const js = renderEmail('password-reset', { ...evil, data: { resetUrl: 'javascript:alert(1)' } });
    expect(js.html).not.toContain('javascript:');
    expect(urls(js.html)).toContain(evil.links.portal);
  });

  it('ignores data of the wrong type instead of throwing', () => {
    const base = sampleContext('booking-confirmation', 'en');
    for (const data of [undefined, null, 'x', 42, [], { startsAt: 5, timezone: {}, minutes: 'a' }]) {
      expect(() => renderEmail('booking-confirmation', { ...base, data: data as never })).not.toThrow();
    }
  });
});

describe('auth emails', () => {
  it('password reset carries the link as a button and as plain text, valid for one hour', () => {
    const ctx = sampleContext('password-reset', 'en');
    const r = renderEmail('password-reset', ctx);
    const url = (ctx.data as { resetUrl: string }).resetUrl;
    expect(urls(r.html).filter((u) => u === url).length).toBeGreaterThanOrEqual(2);
    expect(r.text).toContain(url);
    expect(r.html).toContain('valid for one hour');
    expect(r.html).toContain('Set a new password');
  });

  it('auth-link adapts to the kind and shows the code when there is one', () => {
    const base = sampleContext('auth-link', 'en');
    const kinds = {
      magiclink: 'Your sign-in link',
      signup: 'Confirm your email address',
      email_change: 'Confirm your new email address',
      reauthentication: 'Your confirmation code',
    } as const;
    for (const [kind, subject] of Object.entries(kinds)) {
      const r = renderEmail('auth-link', {
        ...base,
        data: {
          kind,
          url: kind === 'reauthentication' ? '' : 'https://euro-passports.com/auth/callback?token_hash=abc',
          code: '123456',
        },
      });
      expect(r.subject).toBe(subject);
      expect(r.html).toContain('123456');
    }
  });
});

describe('contact acknowledgement', () => {
  it('addresses the visitor by first name, without a case reference or an unsubscribe link', () => {
    const ctx = sampleContext('contact-received', 'en', { name: 'Rachel Hoffman' });
    const r = renderEmail('contact-received', { ...ctx, data: { name: 'Rachel Hoffman' } });
    expect(r.html).toContain('Rachel, your enquiry is with us.');
    expect(r.html).not.toContain('DPL-');
    expect(r.html).toContain('03-372-4722');
    expect(r.html).toContain('Law Offices');
  });
});
