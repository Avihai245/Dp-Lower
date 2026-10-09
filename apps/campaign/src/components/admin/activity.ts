import { isDocType, LEAD_STAGES, LEAD_STATUSES } from '@dpl/core';
import type { ActivityView } from './types';

/**
 * Localises one activity_log entry by its `code`. Staff actions (written by this CRM) and the system milestones other
 * parts of the app log share the `activity.codes.<code>` messages; an entry with an unknown code, or without the data a
 * message needs, falls back to the English `text` stored with it, so nothing is ever lost or half translated.
 */

type Translate = {
  (key: string, values?: Record<string, string | number>): string;
  has: (key: string) => boolean;
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const isStage = (v: string): boolean => (LEAD_STAGES as readonly string[]).includes(v);
const isStatus = (v: string): boolean => (LEAD_STATUSES as readonly string[]).includes(v);

/** The values a code's message needs; an empty string means "not available". */
function paramsFor(t: Translate, a: ActivityView, iso: (v: string) => string): Record<string, string> {
  const m = a.meta;
  const docType = str(m.docType);
  const from = str(m.from);
  const to = str(m.to);
  const inbox = str(m.status);
  switch (a.code) {
    case 'stage_changed':
      return { from: isStage(from) ? t(`stage.${from}`) : '', to: isStage(to) ? t(`stage.${to}`) : '' };
    case 'status_changed':
      return { to: isStatus(to) ? t(`status.${to}`) : '' };
    case 'owner_assigned':
      return { name: str(m.ownerName) };
    case 'doc_requested':
    case 'doc_reminded':
    case 'doc_received':
    case 'doc_rejected':
      return { doc: isDocType(docType) ? t(`docs.name.${docType}`) : '' };
    case 'password_reset_sent':
    case 'portal_invite_sent':
    case 'reminder_sent':
    case 'doc_reminder_sent':
    case 'status_update_sent':
    case 'closing_email_sent':
      return { email: str(m.email) ? iso(str(m.email)) : '' };
    case 'callback_status':
      return { status: ['new', 'in_progress', 'closed'].includes(inbox) ? t(`activity.inbox.${inbox}`) : '' };
    default:
      return {};
  }
}

export function activityText(t: Translate, a: ActivityView, iso: (v: string) => string = (v) => v): string {
  if (!a.code) return a.text;
  const key = `activity.codes.${a.code}`;
  if (!t.has(key)) return a.text;
  const params = paramsFor(t, a, iso);
  if (Object.values(params).some((v) => v === '')) return a.text;
  return t(key, params);
}

