/**
 * The recovery link emailed by "Send password reset link": the app's own /auth/callback with the Supabase token hash
 * (never the Supabase-hosted action_link), which verifies it and continues to the set-password screen in reset mode.
 * Pure, so it can be unit-tested.
 */
export const RESET_NEXT = '/create-password?mode=reset';

export function buildResetUrl(callbackUrl: string, tokenHash: string): string {
  const q = new URLSearchParams({ token_hash: tokenHash, type: 'recovery', next: RESET_NEXT });
  return `${callbackUrl}?${q.toString()}`;
}
