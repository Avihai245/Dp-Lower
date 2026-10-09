import 'server-only';
import type { LeadRow } from '@dpl/db/types';

/**
 * Entry points of the nurture sequence, implemented by the emails worker. Signatures are a contract.
 * startWelcomeSequence: called right after a lead is created; queues welcome-1 immediately and records it in
 * email_sequence_state so the scheduler continues from number 2. Never throws.
 */
export async function startWelcomeSequence(_lead: LeadRow): Promise<void> {
  /* stub */
}
