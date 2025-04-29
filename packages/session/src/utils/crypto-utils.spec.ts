import { describe, it, expect, vi, beforeEach } from 'vitest';
import { subtle } from 'uncrypto';
import {
  getCryptoSignKey,
  getCryptoVerifyKey,
  parseCookieValue,
  CookieErrorReason,
  signCookie,
  unsignCookie,
  DEFAULT_HMAC_ALGORITHM,
} from './crypto-utils';
import { Buffer } from 'node:buffer';

describe('crypto-utils', () => {
  const mockCryptoKey = { type: 'mock-key' } as unknown as CryptoKey;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();


    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(Buffer, 'from').mockImplementation((str, encoding): any => {
      if (encoding === 'base64' && typeof str === 'string') {
        // Return a valid buffer-like object that can be used with Uint8Array.from
        return {
          [Symbol.iterator]: function* () {
            yield* [1, 2, 3, 4, 5]; // Mock bytes
          }
        };
      }
      return { toString: () => {
        return str.toString();
      }
      };
    });
  });
  describe('getCryptoSignKey', () => {

    it('should throw error if key import fails', async () => {
      vi.spyOn(subtle, 'importKey').mockRejectedValue(new Error('Import failed'));
      await expect(getCryptoSignKey('test-secret')).rejects.toThrow(
        'Failed to create signing key'
      );
    });

    it('should return a crypto key for signing', async () => {
      vi.spyOn(subtle,'importKey').mockResolvedValue(mockCryptoKey);
      const result = await getCryptoSignKey('test-secret');

      expect(subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        DEFAULT_HMAC_ALGORITHM,
        false,
        ['sign']
      );
      expect(result).toBe(mockCryptoKey);
    });

    it('should return cached key on subsequent calls with same parameters', async () => {
      const spy = vi.spyOn(subtle,'importKey').mockResolvedValue(mockCryptoKey);

      // First call
      await getCryptoSignKey('test-secret');

      // Reset mock to verify it's not called again
      spy.mockClear();

      // Second call with same parameters
      const result = await getCryptoSignKey('test-secret');

      expect(subtle.importKey).not.toHaveBeenCalled();
      expect(result).toBe(mockCryptoKey);
    });

    it('should throw error if secret is empty', async () => {
      await expect(getCryptoSignKey('')).rejects.toThrow(
        'Cannot create crypto key: Secret is empty'
      );
    });


  });

  describe('getCryptoVerifyKey', () => {
    it('should throw error if key import fails', async () => {
      vi.mocked(subtle.importKey).mockRejectedValue(new Error('Import failed'));

      await expect(getCryptoVerifyKey('test-secret')).rejects.toThrow(
        'Failed to create verification key'
      );
    });

    it('should return a crypto key for verification', async () => {
      vi.spyOn(subtle, 'importKey').mockResolvedValue(mockCryptoKey);

      const result = await getCryptoVerifyKey('test-secret');

      expect(subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        DEFAULT_HMAC_ALGORITHM,
        false,
        ['verify']
      );
      expect(result).toBe(mockCryptoKey);
    });

    it('should return cached key on subsequent calls with same parameters', async () => {
      // First call
      await getCryptoVerifyKey('test-secret');

      // Reset mock to verify it's not called again
      vi.mocked(subtle.importKey).mockClear();

      // Second call with same parameters
      const result = await getCryptoVerifyKey('test-secret');

      expect(subtle.importKey).not.toHaveBeenCalled();
      expect(result).toBe(mockCryptoKey);
    });

    it('should throw error if secret is empty', async () => {
      await expect(getCryptoVerifyKey('')).rejects.toThrow(
        'Cannot create crypto key: Secret is empty'
      );
    });


  });

  describe('parseCookieValue', () => {
    it('should correctly parse a valid signed cookie', () => {
      const validCookie =
        's:test-value.signature-part-exactly-43-characters-long-x';

      const result = parseCookieValue(validCookie);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('test-value');
        expect(result.signature).toBe(
          'signature-part-exactly-43-characters-long-x'
        );
      }
    });

    it('should return INVALID_FORMAT for short strings', () => {
      const result = parseCookieValue('short');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe(CookieErrorReason.INVALID_FORMAT);
      }
    });

    it('should return INVALID_PREFIX for cookies without s: prefix', () => {
      const invalidCookie =
        'x:test-value.signature-part-exactly-43-characters-long-x';

      const result = parseCookieValue(invalidCookie);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe(CookieErrorReason.INVALID_PREFIX);
      }
    });

    it('should return INVALID_SEPARATOR for cookies without proper separator', () => {
      const invalidCookie =
        's:test-value-signature-part-exactly-43-characters-long-xxxx';

      const result = parseCookieValue(invalidCookie);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe(CookieErrorReason.INVALID_SEPARATOR);
      }
    });
  });

  describe('signCookie', () => {
    it('should sign a cookie value correctly', async () => {
      // Mock subtle.sign to return a valid signature
      const mockSignature = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      vi.spyOn(subtle, 'sign').mockResolvedValue(mockSignature);

      const value = 'test-value';
      const secret = 'test-secret';

      const result = await signCookie(value, secret);

      expect(subtle.sign).toHaveBeenCalled();
      expect(result).toContain('s:test-value.');
    });

    it('should throw error if value is empty', async () => {
      await expect(signCookie('', 'test-secret')).rejects.toThrow(
        'Cannot sign cookie: Value is empty'
      );
    });

    it('should throw error if secret is empty', async () => {
      await expect(signCookie('test-value', '')).rejects.toThrow(
        'Cannot sign cookie: Secret is empty'
      );
    });

    it('should throw error if signing fails', async () => {
      vi.mocked(subtle.sign).mockRejectedValue(new Error('Signing failed'));

      await expect(signCookie('test-value', 'test-secret')).rejects.toThrow(
        'Failed to sign cookie'
      );
    });
  });

  describe('unsignCookie', () => {

    it('should correctly verify a signed cookie', async () => {
      vi.mocked(subtle.verify).mockResolvedValue(true);

      const result = await unsignCookie(
        's:test-value.signature-part-exactly-43-characters-long-x',
        ['test-secret']
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('test-value');
      }
    });

    it('should return false for invalid cookie format', async () => {
      const result = await unsignCookie('invalid', ['test-secret']);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe(CookieErrorReason.INVALID_FORMAT);
      }
    });

    it('should return failure if verification fails', async () => {
      vi.mocked(subtle.verify).mockResolvedValue(false);

      const result = await unsignCookie(
        's:test-value.signature-part-exactly-43-characters-long-x',
        ['test-secret']
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe(CookieErrorReason.VERIFICATION_FAILED);
      }
    });

    it('should try all provided secrets until one works', async () => {
      // First verification fails, second succeeds
      const mockVerify = vi.mocked(subtle.verify);
      mockVerify.mockResolvedValueOnce(false);
      mockVerify.mockResolvedValueOnce(true);

      const result = await unsignCookie(
        's:test-value.signature-part-exactly-43-characters-long-x',
        ['bad-secret', 'good-secret']
      );

      expect(result.success).toBe(true);
      expect(mockVerify).toHaveBeenCalledTimes(2);
    });

    it('should handle verification errors gracefully', async () => {
      vi.mocked(subtle.verify).mockRejectedValue(
        new Error('Verification error')
      );

      const result = await unsignCookie(
        's:test-value.signature-part-exactly-43-characters-long-x',
        ['test-secret']
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe(CookieErrorReason.VERIFICATION_FAILED);
      }
      expect(console.error).toHaveBeenCalled();
    });
  });


});
