import { describe, expect, it, vi } from 'vitest';
import { settle } from './settle';

describe('settle', () => {
  it('passes the result of the action through', async () => {
    await expect(settle(async () => ({ ok: true as const, data: 3 }))).resolves.toEqual({ ok: true, data: 3 });
    await expect(settle(async () => ({ ok: false as const, error: 'stale' as const }))).resolves.toEqual({ ok: false, error: 'stale' });
  });

  it('turns a failed call (network error, unknown action) into the internal error instead of throwing', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      settle(async () => {
        throw new TypeError('Failed to fetch');
      }),
    ).resolves.toEqual({ ok: false, error: 'internal' });
    expect(log).toHaveBeenCalledWith('[admin] action call failed', 'Failed to fetch');
    log.mockRestore();
  });
});
