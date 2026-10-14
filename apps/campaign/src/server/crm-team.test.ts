import type { Db } from '@dpl/db/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./auth', () => ({ queueStaffReset: vi.fn(async () => {}) }));

import { queueStaffReset } from './auth';
import { inviteStaff, updateStaff } from './crm-team';

/** A minimal stand-in for the three Supabase calls updateStaff makes. */
function fakeDb(opts: { target: { user_id: string; role: string; active: boolean } | null; otherAdmins: number; updateFails?: boolean }) {
  const updates: unknown[] = [];
  let counted = false;
  const db = {
    from: () => ({
      select: (_cols: string, o?: { count?: string }) => {
        const builder = {
          eq: () => builder,
          neq: () => builder,
          maybeSingle: async () => ({ data: opts.target }),
          then: (resolve: (v: { count: number }) => unknown) => {
            counted = o?.count === 'exact';
            return resolve({ count: opts.otherAdmins });
          },
        };
        return builder;
      },
      update: (patch: unknown) => ({
        eq: async () => {
          updates.push(patch);
          return { error: opts.updateFails ? { message: 'boom' } : null };
        },
      }),
    }),
  } as unknown as Db;
  return { db, updates, wasCounted: () => counted };
}

const ID = '3d4b0e9f-0dca-48cb-a6d8-497534af5c15';

describe('updateStaff', () => {
  it('answers not_found for an unknown member', async () => {
    const f = fakeDb({ target: null, otherAdmins: 1 });
    expect(await updateStaff(f.db, { userId: ID, role: 'lawyer', active: true })).toMatchObject({ ok: false, error: 'not_found' });
    expect(f.updates).toHaveLength(0);
  });

  it('changes the role and the active flag', async () => {
    const f = fakeDb({ target: { user_id: ID, role: 'case_manager', active: true }, otherAdmins: 0 });
    expect(await updateStaff(f.db, { userId: ID, role: 'admin', active: true })).toMatchObject({ ok: true });
    expect(f.updates).toEqual([{ role: 'admin', active: true }]);
    expect(f.wasCounted()).toBe(false); // nobody lost their admin rights, nothing to protect
  });

  it('never removes the last active admin: demoting or deactivating them is a conflict', async () => {
    for (const change of [{ role: 'lawyer' as const, active: true }, { role: 'admin' as const, active: false }, { role: 'case_manager' as const, active: false }]) {
      const f = fakeDb({ target: { user_id: ID, role: 'admin', active: true }, otherAdmins: 0 });
      expect(await updateStaff(f.db, { userId: ID, ...change }), JSON.stringify(change)).toMatchObject({ ok: false, error: 'conflict' });
      expect(f.updates).toHaveLength(0);
    }
  });

  it('lets an admin step down while another active admin remains', async () => {
    const f = fakeDb({ target: { user_id: ID, role: 'admin', active: true }, otherAdmins: 2 });
    expect(await updateStaff(f.db, { userId: ID, role: 'lawyer', active: true })).toMatchObject({ ok: true });
    expect(f.wasCounted()).toBe(true);
    expect(f.updates).toHaveLength(1);
  });

  it('deactivating a lawyer or an already inactive admin needs no admin left over', async () => {
    const lawyer = fakeDb({ target: { user_id: ID, role: 'lawyer', active: true }, otherAdmins: 0 });
    expect(await updateStaff(lawyer.db, { userId: ID, role: 'lawyer', active: false })).toMatchObject({ ok: true });
    const inactiveAdmin = fakeDb({ target: { user_id: ID, role: 'admin', active: false }, otherAdmins: 0 });
    expect(await updateStaff(inactiveAdmin.db, { userId: ID, role: 'lawyer', active: false })).toMatchObject({ ok: true });
  });

  it('reports a failed write as internal', async () => {
    const f = fakeDb({ target: { user_id: ID, role: 'lawyer', active: true }, otherAdmins: 1, updateFails: true });
    expect(await updateStaff(f.db, { userId: ID, role: 'admin', active: true })).toMatchObject({ ok: false, error: 'internal' });
  });
});

/** A minimal stand-in for the Supabase calls inviteStaff makes: the email lookup, the staff upsert, and the auth admin API. */
function fakeInviteDb(opts: {
  existingUserId?: string | null;
  alreadyStaff?: boolean;
  createUserId?: string | null;
  updateUserFails?: boolean;
  upsertFails?: boolean;
  generateLinkFails?: boolean;
}) {
  const calls = {
    rpc: [] as { name: string; args: unknown }[],
    upsert: [] as unknown[],
    updateUserById: [] as unknown[],
    createUser: [] as unknown[],
    generateLink: [] as unknown[],
  };
  const db = {
    rpc: async (name: string, args: unknown) => {
      calls.rpc.push({ name, args });
      if (name === 'auth_user_id_by_email') return { data: opts.existingUserId ?? null };
      return { data: null };
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.alreadyStaff ? { user_id: opts.existingUserId } : null }) }) }),
      upsert: async (row: unknown) => {
        calls.upsert.push(row);
        return { error: opts.upsertFails ? { message: 'boom' } : null };
      },
    }),
    auth: {
      admin: {
        updateUserById: async (id: string, patch: unknown) => {
          calls.updateUserById.push({ id, patch });
          return { error: opts.updateUserFails ? { message: 'boom' } : null };
        },
        createUser: async (patch: unknown) => {
          calls.createUser.push(patch);
          return opts.createUserId === null
            ? { data: null, error: { message: 'boom' } }
            : { data: { user: { id: opts.createUserId ?? 'new-user-id' } }, error: null };
        },
        generateLink: async (patch: unknown) => {
          calls.generateLink.push(patch);
          return opts.generateLinkFails
            ? { data: null, error: { message: 'boom' } }
            : { data: { properties: { hashed_token: 'tok123' } }, error: null };
        },
      },
    },
  } as unknown as Db;
  return { db, calls };
}

describe('inviteStaff', () => {
  beforeEach(() => vi.mocked(queueStaffReset).mockClear());
  const invite = { email: 'New.Hire@Example.com', fullName: 'New Hire', role: 'lawyer' as const, locale: 'en' as const };

  it('creates a brand new account and staff row, and emails a set-password link', async () => {
    const f = fakeInviteDb({ existingUserId: null, createUserId: 'fresh-id' });
    const res = await inviteStaff(f.db, invite);
    expect(res).toMatchObject({ ok: true });
    expect(f.calls.createUser).toHaveLength(1);
    expect(f.calls.upsert).toEqual([{ user_id: 'fresh-id', full_name: 'New Hire', email: 'new.hire@example.com', role: 'lawyer', active: true }]);
    expect(f.calls.updateUserById).toHaveLength(0); // nothing to reset: the account did not exist before
    expect(queueStaffReset).toHaveBeenCalledWith(f.db, expect.objectContaining({ email: 'new.hire@example.com', userId: 'fresh-id' }));
  });

  it('answers duplicate when the email already belongs to an active staff member', async () => {
    const f = fakeInviteDb({ existingUserId: ID, alreadyStaff: true });
    expect(await inviteStaff(f.db, invite)).toMatchObject({ ok: false, error: 'duplicate' });
    expect(f.calls.upsert).toHaveLength(0);
    expect(queueStaffReset).not.toHaveBeenCalled();
  });

  it('claims an existing non-staff account: resets its password, revokes its sessions, then grants the role', async () => {
    const f = fakeInviteDb({ existingUserId: ID, alreadyStaff: false });
    const res = await inviteStaff(f.db, invite);
    expect(res).toMatchObject({ ok: true });
    expect(f.calls.updateUserById).toEqual([{ id: ID, patch: { password: expect.any(String), email_confirm: true } }]);
    expect(f.calls.rpc.some((c) => c.name === 'revoke_user_sessions')).toBe(true);
    expect(f.calls.createUser).toHaveLength(0);
    expect(f.calls.upsert).toEqual([{ user_id: ID, full_name: 'New Hire', email: 'new.hire@example.com', role: 'lawyer', active: true }]);
  });

  it('still saves the account and the role when the invite email fails to send', async () => {
    const f = fakeInviteDb({ existingUserId: null, createUserId: 'fresh-id', generateLinkFails: true });
    const res = await inviteStaff(f.db, invite);
    expect(res).toMatchObject({ ok: true });
    expect(f.calls.upsert).toHaveLength(1);
    expect(queueStaffReset).not.toHaveBeenCalled();
  });

  it('reports a failed staff upsert as internal', async () => {
    const f = fakeInviteDb({ existingUserId: null, createUserId: 'fresh-id', upsertFails: true });
    expect(await inviteStaff(f.db, invite)).toMatchObject({ ok: false, error: 'internal' });
  });
});
