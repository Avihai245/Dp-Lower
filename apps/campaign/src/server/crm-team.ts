import 'server-only';
import type { Db } from '@dpl/db/types';
import type { ActionResult, StaffView } from '@/components/admin/types';
import { done, fail } from './crm-util';

export async function loadTeam(db: Db): Promise<StaffView[]> {
  const { data, error } = await db.from('staff').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({
    id: s.user_id,
    name: s.full_name,
    email: s.email,
    role: s.role,
    active: s.active,
    createdAt: s.created_at,
  }));
}

/** Role and active flag of a staff member (admins only). The firm can never be left without an active admin. */
export async function updateStaff(
  db: Db,
  a: { userId: string; role: 'admin' | 'lawyer' | 'case_manager'; active: boolean },
): Promise<ActionResult> {
  const { data: target } = await db.from('staff').select('user_id,role,active').eq('user_id', a.userId).maybeSingle();
  if (!target) return fail('not_found');

  const staysAdmin = a.role === 'admin' && a.active;
  if (!staysAdmin && target.role === 'admin' && target.active) {
    const { count } = await db
      .from('staff')
      .select('user_id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('active', true)
      .neq('user_id', a.userId);
    if (!count) return fail('conflict');
  }
  const { error } = await db.from('staff').update({ role: a.role, active: a.active }).eq('user_id', a.userId);
  return error ? fail('internal') : done();
}
