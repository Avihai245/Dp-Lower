export const MIN_PASSWORD = 8;

export type PasswordHint = 'mismatch' | 'short' | 'default';

export interface PasswordState {
  /** both fields filled in correctly: the save button is live */
  ok: boolean;
  hint: PasswordHint;
  /** the hint is drawn in the error colour */
  error: boolean;
}

/**
 * The hint under "Confirm password", exactly as the prototype decides it: a mismatch wins over "too short", and the
 * neutral line shows otherwise. The button is only enabled when the password is long enough and both fields match.
 */
export function passwordState(password: string, confirm: string): PasswordState {
  const mismatch = confirm !== '' && password !== confirm;
  const short = password !== '' && password.length < MIN_PASSWORD;
  return {
    ok: password.length >= MIN_PASSWORD && password === confirm,
    hint: mismatch ? 'mismatch' : short ? 'short' : 'default',
    error: mismatch || short,
  };
}
