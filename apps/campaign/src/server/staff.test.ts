import { ApiError } from '@dpl/db/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// React.cache only memoises inside a server render; here every call must read the (mutable) test state
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T) => fn }));

const state = vi.hoisted(() => ({
  user: null as { id: string; factors?: Array<{ factor_type: string; status: string }> } | null,
  staff: null as Record<string, unknown> | null,
  level: 'aal1' as 'aal1' | 'aal2',
}));
vi.mock('@dpl/db/server', () => ({
  createServerSupabase: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: state.level, nextLevel: 'aal2' } }) },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.staff }) }) }) }),
  }),
}));

import { errorCode, requireAdmin, requireStaff, resolveStaff } from './staff';

const staffRow = (over: Record<string, unknown> = {}) => ({
  user_id: 'u1',
  full_name: 'Anna Reinhardt',
  email: 'anna@firm.example',
  role: 'case_manager',
  active: true,
  ...over,
});

beforeEach(() => {
  state.user = null;
  state.staff = null;
  state.level = 'aal1';
  vi.unstubAllEnvs();
});

const failure = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e;
  }
  return null;
};

describe('resolveStaff', () => {
  it('tells anonymous visitors, signed-in non-staff and staff apart', async () => {
    expect((await resolveStaff()).kind).toBe('anonymous');
    state.user = { id: 'u1' };
    expect((await resolveStaff()).kind).toBe('forbidden');
    state.staff = staffRow({ active: false });
    expect((await resolveStaff()).kind).toBe('forbidden'); // deactivated staff are locked out
    state.staff = staffRow();
    expect((await resolveStaff()).kind).toBe('staff');
  });
});

const totp = (status = 'verified') => ({ factor_type: 'totp', status });

describe('two-step verification', () => {
  it('staff who enrolled an authenticator app are staff only once the session passed the second step', async () => {
    state.user = { id: 'u1', factors: [totp()] };
    state.staff = staffRow();
    expect(await resolveStaff()).toMatchObject({ kind: 'second-step', step: 'verify' });
    expect(await failure(requireStaff())).toMatchObject({ status: 403, code: 'second_step_required' });
    expect(await failure(requireAdmin())).toMatchObject({ status: 403, code: 'second_step_required' });
    state.level = 'aal2';
    expect((await resolveStaff()).kind).toBe('staff');
    expect((await requireStaff()).actor.id).toBe('u1');
  });

  it('an enrolment that was never confirmed protects nothing and asks for nothing', async () => {
    state.user = { id: 'u1', factors: [totp('unverified')] };
    state.staff = staffRow();
    expect((await resolveStaff()).kind).toBe('staff');
    state.user = { id: 'u1', factors: [{ factor_type: 'phone', status: 'verified' }] };
    expect((await resolveStaff()).kind).toBe('staff');
  });

  it('is not asked of people who are not active staff: they stay forbidden, enrolled or not', async () => {
    state.user = { id: 'u1', factors: [totp()] };
    expect((await resolveStaff()).kind).toBe('forbidden');
    state.staff = staffRow({ active: false });
    expect((await resolveStaff()).kind).toBe('forbidden');
  });

  it('STAFF_MFA_REQUIRED makes everybody on the staff enrol first', async () => {
    vi.stubEnv('STAFF_MFA_REQUIRED', '1');
    state.user = { id: 'u1' };
    state.staff = staffRow();
    expect(await resolveStaff()).toMatchObject({ kind: 'second-step', step: 'enroll' });
    expect(await failure(requireStaff())).toMatchObject({ status: 403, code: 'second_step_required' });
    // once enrolled and verified, the requirement is met
    state.user = { id: 'u1', factors: [totp()] };
    state.level = 'aal2';
    expect((await resolveStaff()).kind).toBe('staff');
    // other spellings of "on", and anything else is off
    vi.stubEnv('STAFF_MFA_REQUIRED', 'true');
    state.user = { id: 'u1' };
    expect((await resolveStaff()).kind).toBe('second-step');
    vi.stubEnv('STAFF_MFA_REQUIRED', '0');
    expect((await resolveStaff()).kind).toBe('staff');
  });
});

describe('requireStaff', () => {
  it('throws 401 without a session', async () => {
    const e = await failure(requireStaff());
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 401, code: 'unauthorized' });
  });

  it('throws 403 for a signed-in user who is not an active staff member', async () => {
    state.user = { id: 'u1' };
    expect(await failure(requireStaff())).toMatchObject({ status: 403, code: 'forbidden' });
    state.staff = staffRow({ active: false });
    expect(await failure(requireStaff())).toMatchObject({ status: 403, code: 'forbidden' });
  });

  it('returns the user, the staff row and the actor written to activity_log', async () => {
    state.user = { id: 'u1' };
    state.staff = staffRow();
    const s = await requireStaff();
    expect(s.user.id).toBe('u1');
    expect(s.staff.role).toBe('case_manager');
    expect(s.actor).toEqual({ id: 'u1', name: 'Anna Reinhardt' });
  });
});

describe('requireAdmin', () => {
  it('only lets admins through', async () => {
    state.user = { id: 'u1' };
    for (const role of ['lawyer', 'case_manager']) {
      state.staff = staffRow({ role });
      expect(await failure(requireAdmin()), role).toMatchObject({ status: 403 });
    }
    state.staff = staffRow({ role: 'admin' });
    expect((await requireAdmin()).staff.role).toBe('admin');
  });

  it('still answers 401 to the anonymous', async () => {
    expect(await failure(requireAdmin())).toMatchObject({ status: 401 });
  });
});

describe('errorCode', () => {
  it('maps what Server Actions catch to the code the browser gets', () => {
    expect(errorCode(new ApiError(401, 'unauthorized'))).toBe('unauthorized');
    expect(errorCode(new ApiError(403, 'forbidden'))).toBe('forbidden');
    expect(errorCode(new ApiError(404, 'not_found'))).toBe('internal');
    expect(errorCode(new Error('boom'))).toBe('internal');
  });
});
