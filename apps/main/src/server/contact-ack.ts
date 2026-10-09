import 'server-only';

/**
 * Sends the "we received your request" acknowledgement to a website visitor (template `contact-received`).
 * Implemented by the emails worker; the route handler calls it after storing the submission. Never throws.
 */
export async function queueContactAck(_args: { submissionId: string; name: string; email: string | null; locale: 'en' | 'he' }): Promise<void> {
  /* stub */
}
