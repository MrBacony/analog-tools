/**
 * Constant-time string comparison that leaks neither length nor content through
 * timing.
 *
 * Both inputs are HMAC'd under a fresh random per-call key, so the comparison
 * runs over two fixed-length (32-byte) digests without an early return, and an
 * attacker cannot precompute or correlate the digests across calls. Use this for
 * comparing secrets (e.g. API keys) instead of `===`, which short-circuits on
 * the first differing byte.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyBytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const digestA = new Uint8Array(
    await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(a))
  );
  const digestB = new Uint8Array(
    await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(b))
  );

  let diff = 0;
  for (let i = 0; i < digestA.length; i++) {
    diff |= digestA[i] ^ digestB[i];
  }
  return diff === 0;
}
