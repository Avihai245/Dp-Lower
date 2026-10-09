import type { ActionResult } from './types';

/**
 * Calls a CRM Server Action so that it cannot throw. The actions themselves never throw (they answer `{ ok: false }`),
 * but the call can still fail on the way: a dropped connection, a server restarting, a deployment that no longer knows
 * the action. That becomes the same 'internal' result, so the screen shows its error toast, undoes an optimistic
 * change and re-enables its buttons instead of ending up in the error page.
 */
export async function settle<T>(work: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await work();
  } catch (e) {
    console.error('[admin] action call failed', e instanceof Error ? e.message : e);
    return { ok: false, error: 'internal' };
  }
}
