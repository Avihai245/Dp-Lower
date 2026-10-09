import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APPLICATION_SECTIONS, DOC_STATUSES, DOC_TYPES, LEAD_STAGES, LEAD_STATUSES } from '@dpl/core';
import { describe, expect, it } from 'vitest';
import { FILTER_KEYS, VIEW_KEYS } from './model';

/**
 * Guards the admin message files beyond the generic key-parity test: every message the CRM's code asks for exists in
 * English and Hebrew (static keys found in the source, and every dynamic family), and each Hebrew message uses the same
 * {placeholders} as its English original, so a translation can never drop or misspell a variable.
 */

const APP = join(__dirname, '../../..');
type Tree = { [k: string]: Tree | string | Tree[] | string[] };
const load = (locale: string): Tree => JSON.parse(readFileSync(join(APP, 'messages', locale, 'admin.json'), 'utf8')) as Tree;
const messages = { en: load('en'), he: load('he') };

const lookup = (tree: Tree, path: string): unknown => path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Tree)[k] : undefined), tree);

function leaves(tree: Tree, prefix = ''): Array<[string, string]> {
  return Object.entries(tree).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'string' ? [[path, v] as [string, string]] : leaves(v as Tree, path);
  });
}

const source = (dir: string, match: RegExp): string[] =>
  readdirSync(dir)
    .filter((f) => match.test(f) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
    .map((f) => readFileSync(join(dir, f), 'utf8'));
const componentSources = source(__dirname, /\.(ts|tsx)$/);
const serverSources = source(join(APP, 'src/server'), /^crm.*\.ts$/);

const TOP = ['a11y', 'nav', 'filters', 'search', 'stats', 'views', 'table', 'stage', 'route', 'status', 'waiting', 'board', 'time', 'lead', 'next', 'docs', 'app', 'answers', 'activity', 'contact', 'statusPanel', 'owner', 'notes', 'edit', 'help', 'inbox', 'availability', 'team', 'toast', 'meta', 'callPanel'];

describe('every message the code uses exists in both languages', () => {
  const used = new Set<string>();
  for (const src of componentSources) {
    for (const m of src.matchAll(/(['"])([A-Za-z]+(?:\.[A-Za-z_]+)+)\1/g)) {
      const key = m[2]!;
      if (TOP.includes(key.split('.')[0]!)) used.add(key);
    }
  }

  it('finds the static keys in the source (sanity check of the scan)', () => {
    expect(used.size).toBeGreaterThan(100);
    expect(used.has('lead.back')).toBe(true);
  });

  for (const locale of ['en', 'he'] as const) {
    it(`${locale}: all static keys resolve to a message`, () => {
      const missing = [...used].filter((k) => typeof lookup(messages[locale], k) !== 'string');
      expect(missing).toEqual([]);
    });
  }
});

describe('dynamic message families are complete', () => {
  const families: Array<[string, string[]]> = [
    ['stage', [...LEAD_STAGES]],
    ['status', [...LEAD_STATUSES]],
    ['filters', [...FILTER_KEYS]],
    ['views', [...VIEW_KEYS]],
    ['docs.name', [...DOC_TYPES]],
    ['docs.short', [...DOC_TYPES]],
    ['docs.chip', [...DOC_STATUSES]],
    ['app.sections', APPLICATION_SECTIONS.map((s) => s.id)],
    ['route', ['germany', 'austria', 'both', 'unsure', 'unknown', 'shortGermany', 'shortAustria', 'shortBoth', 'shortUnsure']],
    ['waiting', ['nothing', 'portal', 'application', 'applicant', 'documents', 'pending', 'nothingPending']],
    ['next', ['send_portal_invite', 'send_reminder', 'send_document_reminder', 'move_to_review', 'assign_to_me', 'send_status_update', 'send_closing_email']],
    ['inbox.status', ['new', 'in_progress', 'closed']],
    ['inbox.kind', ['contact', 'lead_band', 'chat']],
    ['activity.inbox', ['new', 'in_progress', 'closed']],
    ['team.roles', ['admin', 'lawyer', 'case_manager']],
    ['availability.errors', ['duplicate', 'invalid', 'forbidden', 'generic']],
    ['callPanel.phase', ['booked', 'awaiting', 'held', 'no_show']],
    ['toast.error', ['unauthorized', 'forbidden', 'invalid', 'not_found', 'conflict', 'duplicate', 'email_taken', 'stale', 'rate_limited', 'internal']],
  ];
  for (const locale of ['en', 'he'] as const) {
    for (const [prefix, keys] of families) {
      it(`${locale}: ${prefix}.*`, () => {
        const missing = keys.filter((k) => typeof lookup(messages[locale], `${prefix}.${k}`) !== 'string' && typeof lookup(messages[locale], `${prefix}.${k}.text`) !== 'string');
        expect(missing).toEqual([]);
      });
    }

    it(`${locale}: next-action cards have a text and a button`, () => {
      for (const code of ['send_portal_invite', 'send_reminder', 'send_document_reminder', 'move_to_review', 'assign_to_me', 'send_status_update', 'send_closing_email']) {
        expect(typeof lookup(messages[locale], `next.${code}.text`), code).toBe('string');
        expect(typeof lookup(messages[locale], `next.${code}.button`), code).toBe('string');
      }
    });

    it(`${locale}: every "?" popover used in the code has a title and a text`, () => {
      const ids = new Set<string>();
      for (const src of componentSources) {
        for (const m of src.matchAll(/<HelpTip id="(\w+)"/g)) ids.add(m[1]!);
        for (const m of src.matchAll(/\bhelp="(\w+)"/g)) ids.add(m[1]!);
      }
      expect(ids.size).toBeGreaterThanOrEqual(15);
      for (const id of ids) {
        expect(typeof lookup(messages[locale], `help.${id}.title`), id).toBe('string');
        expect(typeof lookup(messages[locale], `help.${id}.text`), id).toBe('string');
      }
    });
  }
});

describe('activity codes', () => {
  /** every stable `code` the CRM server code writes to activity_log */
  const written = new Set<string>();
  for (const src of serverSources) {
    for (const m of src.matchAll(/\blog\(db, actor, [^,]+, '([a-z_]+)'/g)) written.add(m[1]!);
    for (const m of src.matchAll(/\bcode: '([a-z_]+)'/g)) written.add(m[1]!);
    for (const m of src.matchAll(/reminder \? '([a-z_]+)' : '([a-z_]+)'/g)) {
      written.add(m[1]!);
      written.add(m[2]!);
    }
  }
  // codes the rest of the app writes (portal-session.ts and the API routes): localised when known
  const others = ['lead_created', 'lead_created_oauth', 'account_created', 'email_verified', 'password_set', 'application_started', 'application_submitted', 'booking_completed'];

  it('finds the codes the CRM writes (sanity check of the scan)', () => {
    for (const c of ['stage_changed', 'status_changed', 'doc_requested', 'doc_reminded', 'doc_received', 'doc_rejected', 'note_added', 'owner_assigned', 'contact_updated', 'password_reset_sent', 'callback_status']) {
      expect(written.has(c), c).toBe(true);
    }
  });

  for (const locale of ['en', 'he'] as const) {
    it(`${locale}: every code the CRM writes, and the milestones of the other parts, has a message`, () => {
      const missing = [...written, ...others].filter((c) => typeof lookup(messages[locale], `activity.codes.${c}`) !== 'string');
      expect(missing).toEqual([]);
    });
  }
});

describe('Hebrew keeps the English placeholders', () => {
  const vars = (s: string) => [...new Set([...s.matchAll(/\{(\w+)(?=[,}])/g)].map((m) => m[1]!))].sort();
  const en = new Map(leaves(messages.en));
  it('every Hebrew message uses exactly the variables of its English original', () => {
    const mismatched = leaves(messages.he)
      .filter(([key, he]) => JSON.stringify(vars(he)) !== JSON.stringify(vars(en.get(key) ?? '')))
      .map(([key]) => key);
    expect(mismatched).toEqual([]);
  });
});
