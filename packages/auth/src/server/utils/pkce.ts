/**
 * PKCE (RFC 7636) helpers for the authorization-code flow with S256.
 */

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate a high-entropy `code_verifier` (43 chars, url-safe).
 */
export function generateCodeVerifier(): string {
  return base64url(globalThis.crypto.getRandomValues(new Uint8Array(32)));
}

/**
 * Derive the S256 `code_challenge` for a `code_verifier`.
 */
export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  return base64url(new Uint8Array(digest));
}
