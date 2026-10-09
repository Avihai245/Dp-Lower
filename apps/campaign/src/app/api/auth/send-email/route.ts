import type { NextRequest } from 'next/server';
import { handleSendEmailHook } from '../../../../server/auth-email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Supabase Auth "Send Email" hook (Authentication > Hooks > Send Email > HTTPS):
 *   URL      https://euro-passports.com/api/auth/send-email
 *   Secret   SEND_EMAIL_HOOK_SECRET  (the `v1,whsec_...` value Supabase generates)
 * Not callable by anyone else: the Standard Webhooks signature is verified before anything is read.
 */
export async function POST(req: NextRequest): Promise<Response> {
  return handleSendEmailHook(req);
}
