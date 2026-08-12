import { describe, expect, it } from 'vitest';
import { timingSafeEqual } from './timing-safe-equal';

describe('timingSafeEqual', () => {
  it('returns true for equal strings', async () => {
    expect(await timingSafeEqual('Bearer secret-key', 'Bearer secret-key')).toBe(
      true
    );
  });

  it('returns false for different strings of equal length', async () => {
    expect(await timingSafeEqual('Bearer secret-abc', 'Bearer secret-xyz')).toBe(
      false
    );
  });

  it('returns false for strings of different length', async () => {
    expect(await timingSafeEqual('Bearer key', 'Bearer key-longer')).toBe(false);
  });

  it('returns true for two empty strings', async () => {
    expect(await timingSafeEqual('', '')).toBe(true);
  });

  it('returns false when only one side is empty', async () => {
    expect(await timingSafeEqual('', 'x')).toBe(false);
  });
});
