/**
 * Debug tests for crypto functions
 */

import { describe, it, expect } from 'vitest';
import { signCookie, unsignCookie } from './crypto';

describe('Crypto Debug', () => {
  it('should debug signing behavior', async () => {
    const value = 'test-session-id';
    const secret1 = 'test-secret-key';
    const secret2 = 'different-secret';

    const signed1 = await signCookie(value, secret1);
    const signed2 = await signCookie(value, secret2);

    console.log('Signed1:', signed1);
    console.log('Signed2:', signed2);
    console.log('Are they different?', signed1 !== signed2);

    expect(signed1).not.toBe(signed2);
  });

  it('should debug unsigning', async () => {
    const value = 'test-session-id';
    const correctSecret = 'test-secret-key';
    const wrongSecret = 'wrong-secret';

    const signed = await signCookie(value, correctSecret);
    console.log('Signed value:', signed);

    const correctUnsigned = await unsignCookie(signed, [correctSecret]);
    const wrongUnsigned = await unsignCookie(signed, [wrongSecret]);

    console.log('Correct unsigned:', correctUnsigned);
    console.log('Wrong unsigned:', wrongUnsigned);

    expect(correctUnsigned).toBe(value);
    expect(wrongUnsigned).toBeNull();
  });
});
