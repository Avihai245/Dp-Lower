import type { Db } from '@dpl/db/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { updateStaff } from './crm-team';

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
