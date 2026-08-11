import { describe, expect, it } from 'vitest';
import { deriveCodeChallenge, generateCodeVerifier } from './pkce';

describe('pkce', () => {
  it('generates url-safe verifiers without padding', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(verifier).not.toContain('=');
    expect(verifier.length).toBeGreaterThanOrEqual(43);
  });

  it('generates a fresh verifier each call', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });

  it('derives the known S256 challenge from the RFC 7636 sample verifier', async () => {
    // RFC 7636 Appendix B
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = await deriveCodeChallenge(verifier);
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});
