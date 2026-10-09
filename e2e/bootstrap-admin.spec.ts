import { expect, test } from '@playwright/test';
import { bootstrapStaff, deleteUserByEmail } from '../scripts/bootstrap-admin';
import { ANON_KEY, SUPABASE_URL, newEmail } from './support/funnel';

/**
 * `pnpm bootstrap:admin` for an address somebody has already registered publicly (the sign-up endpoint is open): whoever
 * registered it knows its password, so promoting it to staff must replace that password and end the sessions.
 */

const signIn = async (email: string, password: string) =>
  (
    await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  ).status;

test('an address that was registered publicly first does not keep its password when it becomes staff', async () => {
  const email = newEmail('bootstrap');
  try {
    const signup = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'Attacker-Knows-123' }),
    });
    expect(signup.status).toBe(200);
    expect(await signIn(email, 'Attacker-Knows-123')).toBe(200);

    const first = await bootstrapStaff({ email, fullName: 'New Hire' });
    expect(first.created).toBe(false);
    expect(first.generatedPassword).toBeTruthy();
    expect(await signIn(email, 'Attacker-Knows-123')).toBe(400);
    expect(await signIn(email, first.generatedPassword!)).toBe(200);

    // running it again only re-activates: the member of staff keeps the password they were given
    const again = await bootstrapStaff({ email, fullName: 'New Hire' });
    expect(again.generatedPassword).toBeNull();
    expect(await signIn(email, first.generatedPassword!)).toBe(200);
  } finally {
    await deleteUserByEmail(email);
  }
});
