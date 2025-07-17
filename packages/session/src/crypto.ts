/**
 * Simplified crypto utilities for session package
 * Replaces 309-line complex crypto module with essential functions
 * Under 50 lines total as per taskplan requirements
 */

/**
 * Sign a cookie value with HMAC-SHA256
 * @param value The value to sign
 * @param secret The secret key for signing
 * @returns Signed cookie value in format `s:value.signature`
 */
export async function signCookie(value: string, secret: string): Promise<string> {
  // Use Node.js crypto when available, fallback for browser environments
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    const encoder = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(value));
    const b64Signature = arrayBufferToBase64(signature).replace(/=+$/, '');
    
    return `s:${value}.${b64Signature}`;
  }
  
  // Fallback for environments without crypto
  throw new Error('Crypto API not available');
}

/**
 * Unsign a cookie value, trying multiple secrets for rotation support
 * @param signedValue The signed cookie value to verify
 * @param secrets Array of secrets to try (supports key rotation)
 * @returns Original value if valid, null if invalid or tampered
 */
export async function unsignCookie(
  signedValue: string,
  secrets: string[]
): Promise<string | null> {
  if (!signedValue.startsWith('s:')) return null;
  
  const [, valueAndSig] = signedValue.split('s:', 2);
  const lastDot = valueAndSig.lastIndexOf('.');
  if (lastDot === -1) return null;
  
  const value = valueAndSig.slice(0, lastDot);
  const providedSig = valueAndSig.slice(lastDot + 1);
  
  // Try each secret (supports key rotation)
  for (const secret of secrets) {
    try {
      const expectedSigned = await signCookie(value, secret);
      const [, expectedValueAndSig] = expectedSigned.split('s:', 2);
      const expectedSig = expectedValueAndSig.slice(expectedValueAndSig.lastIndexOf('.') + 1);
      
      // Timing-safe comparison
      if (timingSafeEqual(providedSig, expectedSig)) {
        return value;
      }
    } catch {
      continue;
    }
  }
  
  return null;
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
