import 'server-only';
import { enqueueEvent, leadSnapshot } from './outbox';
import type { Db, LeadRow } from './types';
import { cleanAnswers } from '@dpl/core';

/** The firm's external CRM hears about a change of contact details or answers (`lead.updated`; the payload names the fields). */
export async function announceUpdate(db: Db, lead: LeadRow, changed: string[], previous?: { email?: string }): Promise<void> {
  const fields = changed.filter((f) => f !== 'locale' || changed.length > 1);
  if (fields.length === 0) return;
  await enqueueEvent(db, {
    type: 'lead.updated',
    leadId: lead.id,
    payload: { lead: leadSnapshot(lead), changed: fields, ...(previous ? { previous } : {}), ...(fields.includes('answers') ? { answers: cleanAnswers(lead.answers) } : {}) },
  });
}
