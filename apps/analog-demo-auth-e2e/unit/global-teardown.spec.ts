/* eslint-disable playwright/no-standalone-expect */
import { describe, expect, it, vi } from 'vitest';
import { cleanupSessionDirectory } from '../src/global-teardown';

describe('global teardown session cleanup', () => {
  it('ignores missing session directory errors', async () => {
    const rm = vi.fn().mockRejectedValue(
      Object.assign(new Error('missing'), {
        code: 'ENOENT',
      })
    );

    await expect(cleanupSessionDirectory({ rm })).resolves.toBeUndefined();
  });

  it('rethrows unexpected cleanup errors', async () => {
    const rm = vi.fn().mockRejectedValue(
      Object.assign(new Error('permission denied'), {
        code: 'EACCES',
      })
    );

    await expect(cleanupSessionDirectory({ rm })).rejects.toThrow(
      'permission denied'
    );
  });
});
