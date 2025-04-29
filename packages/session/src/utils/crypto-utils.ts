/**
 * Cryptographic utility functions for session management
 */
import { Buffer } from 'node:buffer';
import { subtle } from 'uncrypto';

/**
 * HMAC algorithm configuration
 */
export interface HmacAlgorithmConfig {
  readonly name: 'HMAC';
  readonly hash: 'SHA-256' | 'SHA-384' | 'SHA-512';
}

/**
 * Standard HMAC SHA-256 algorithm configuration
 */
export const DEFAULT_HMAC_ALGORITHM: HmacAlgorithmConfig = {
  name: 'HMAC',
  hash: 'SHA-256'
} as const;

/**
 * LRU Cache for CryptoKeys with a fixed maximum size
 */
class LRUCryptoKeyCache {
  private readonly cache = new Map<string, CryptoKey>();
  private readonly maxSize: number;

  /**
   * Create a new LRU cache for crypto keys
   * @param maxSize - Maximum number of keys to store in the cache
   */
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Get a key from the cache
   * @param cacheKey - The cache key to retrieve
   * @returns The cached crypto key or undefined if not found
   */
  get(cacheKey: string): CryptoKey | undefined {
    const key = this.cache.get(cacheKey);

    if (key) {
      // Access marks this key as most recently used
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, key);
    }

    return key;
  }

  /**
   * Store a key in the cache
   * @param cacheKey - The cache key to store under
   * @param key - The crypto key to cache
   */
  set(cacheKey: string, key: CryptoKey): void {
    // If we're at capacity, remove the oldest entry (first in map)
    if (this.cache.size >= this.maxSize) {
      const keys = this.cache.keys();
      const oldestKey = keys.next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(cacheKey, key);
  }
}

/**
 * Cache for crypto sign keys to avoid repeatedly creating the same keys
 */
const signKeysCache = new LRUCryptoKeyCache(100);

/**
 * Get or create a crypto key for signing with HMAC
 * @param secret - The secret used to generate the key
 * @param algorithm - The HMAC algorithm configuration
 * @returns A CryptoKey for signing
 * @throws Error if key import fails
 */
export async function getCryptoSignKey(
  secret: string,
  algorithm: HmacAlgorithmConfig = DEFAULT_HMAC_ALGORITHM
): Promise<CryptoKey> {
  const cacheKey = `${secret}:${algorithm.hash}`;

  const cachedKey = signKeysCache.get(cacheKey);
  if (cachedKey) {
    return cachedKey;
  }

  if (!secret) {
    throw new Error('[@analog-tools/session] Cannot create crypto key: Secret is empty');
  }

  try {
    const encoder = new TextEncoder();
    const keyUint8Array = encoder.encode(secret);
    const cryptoKey = await subtle.importKey(
      'raw',
      keyUint8Array,
      algorithm,
      false,
      ['sign']
    );

    signKeysCache.set(cacheKey, cryptoKey);
    return cryptoKey;
  } catch (error) {
    throw new Error(`[@analog-tools/session] Failed to create signing key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Cache for crypto verify keys to avoid repeatedly creating the same keys
 */
const verifyKeysCache = new LRUCryptoKeyCache(100);

/**
 * Get or create a crypto key for verification with HMAC
 * @param secret - The secret used to generate the key
 * @param algorithm - The HMAC algorithm configuration
 * @returns A CryptoKey for verification
 * @throws Error if key import fails
 */
export async function getCryptoVerifyKey(
  secret: string,
  algorithm: HmacAlgorithmConfig = DEFAULT_HMAC_ALGORITHM
): Promise<CryptoKey> {
  const cacheKey = `${secret}:${algorithm.hash}`;

  const cachedKey = verifyKeysCache.get(cacheKey);
  if (cachedKey) {
    return cachedKey;
  }

  if (!secret) {
    throw new Error('[@analog-tools/session] Cannot create crypto key: Secret is empty');
  }

  try {
    const encoder = new TextEncoder();
    const keyUint8Array = encoder.encode(secret);
    const cryptoKey = await subtle.importKey(
      'raw',
      keyUint8Array,
      algorithm,
      false,
      ['verify']
    );

    verifyKeysCache.set(cacheKey, cryptoKey);
    return cryptoKey;
  } catch (error) {
    throw new Error(`[@analog-tools/session] Failed to create verification key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Length of the signature part in signed cookies
 */
const SIGNATURE_LENGTH = 43;

/**
 * Error messages for cookie parsing and verification
 */
export enum CookieErrorReason {
  INVALID_FORMAT = 'invalid_format',
  INVALID_PREFIX = 'invalid_prefix',
  INVALID_SEPARATOR = 'invalid_separator',
  VERIFICATION_FAILED = 'verification_failed'
}

/**
 * Result of parsing a cookie value
 */
export type ParsedCookieResult =
  | { success: true; value: string; signature: string }
  | { success: false; reason: CookieErrorReason };

/**
 * Parse a signed cookie value into its components
 * @param value - The cookie value to parse
 * @returns A parsed cookie result object
 */
export function parseCookieValue(value: string): ParsedCookieResult {
  if (!value || value.length < SIGNATURE_LENGTH + 3) {
    return { success: false, reason: CookieErrorReason.INVALID_FORMAT };
  }

  const separatorIndex = value.length - SIGNATURE_LENGTH - 1;

  if (value.charAt(0) !== 's' || value.charAt(1) !== ':') {
    return { success: false, reason: CookieErrorReason.INVALID_PREFIX };
  }

  if (value.charAt(separatorIndex) !== '.') {
    return { success: false, reason: CookieErrorReason.INVALID_SEPARATOR };
  }

  return {
    success: true,
    value: value.substring(2, separatorIndex),
    signature: value.substring(separatorIndex + 1)
  };
}

/**
 * Result of unsigning a cookie
 */
export type UnsignCookieResult =
  | { success: true; value: string }
  | { success: false; reason: CookieErrorReason };

/**
 * Verify that a cookie was signed with one of the secrets
 * If it's valid, return the embedded message
 *
 * @param value - A cookie value in the format `s:[value].[signature]`
 * @param secrets - An array of secret strings to verify with
 * @param algorithm - The HMAC algorithm configuration
 * @returns A result object with the unsigned value or error reason
 */
export async function unsignCookie(
  value: string,
  secrets: readonly string[],
  algorithm: HmacAlgorithmConfig = DEFAULT_HMAC_ALGORITHM
): Promise<UnsignCookieResult> {
  const parseResult = parseCookieValue(value);

  if (!parseResult.success) {
    return { success: false, reason: parseResult.reason };
  }

  const { value: message, signature } = parseResult;
  const encoder = new TextEncoder();
  const messageUint8Array = encoder.encode(message);

  try {
    const signatureUint8Array = Uint8Array.from(Buffer.from(signature, 'base64'));

    for (const secret of secrets) {
      try {
        const cryptoKey = await getCryptoVerifyKey(secret, algorithm);
        const result = await subtle.verify(
          algorithm.name,
          cryptoKey,
          signatureUint8Array,
          messageUint8Array
        );

        if (result) {
          return { success: true, value: message };
        }
      } catch (error) {
        console.error(`[@analog-tools/session] Error verifying with secret: ${error instanceof Error ? error.message : String(error)}`);
        // Continue with next secret
      }
    }

    return { success: false, reason: CookieErrorReason.VERIFICATION_FAILED };
  } catch (error) {
    console.error(`[@analog-tools/session] Failed to verify cookie signature: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, reason: CookieErrorReason.VERIFICATION_FAILED };
  }
}

/**
 * Creates a signed cookie value in the format `s:[value].[signature]`
 * @param value - The value to sign
 * @param secret - The secret to use for signing
 * @param algorithm - The HMAC algorithm configuration
 * @returns A signed cookie string
 * @throws Error if signing fails
 */
export async function signCookie(
  value: string,
  secret: string,
  algorithm: HmacAlgorithmConfig = DEFAULT_HMAC_ALGORITHM
): Promise<string> {
  if (!value) {
    throw new Error('[@analog-tools/session] Cannot sign cookie: Value is empty');
  }

  if (!secret) {
    throw new Error('[@analog-tools/session] Cannot sign cookie: Secret is empty');
  }

  try {
    const encoder = new TextEncoder();
    const messageUint8Array = encoder.encode(value);
    const cryptoKey = await getCryptoSignKey(secret, algorithm);
    const signature = await subtle.sign(algorithm.name, cryptoKey, messageUint8Array);

    const b64Signature = Buffer.from(signature)
      .toString('base64')
      .replace(/=+$/, '');

    return `s:${value}.${b64Signature}`;
  } catch (error) {
    throw new Error(`[@analog-tools/session] Failed to sign cookie: ${error instanceof Error ? error.message : String(error)}`);
  }
}
