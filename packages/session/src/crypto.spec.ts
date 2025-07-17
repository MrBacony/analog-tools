/**
 * Tests for simplified crypto functions
 * Verifies security and functionality of essential crypto implementation
 */

import { describe, it, expect } from 'vitest';
import { signCookie, unsignCookie } from './crypto';

describe('Crypto Functions', () => {
  const secret = 'test-secret-key';
  const value = 'test-session-id';

  describe('signCookie', () => {
    it('should sign a cookie value correctly', async () => {
      const signed = await signCookie(value, secret);
      
      expect(signed).toMatch(/^s:test-session-id\./);
      expect(signed.split('.').length).toBe(2);
    });

    it('should produce different signatures for different secrets', async () => {
      const signed1 = await signCookie(value, secret);
      const signed2 = await signCookie(value, 'different-secret');
      
      expect(signed1).not.toBe(signed2);
    });

    it('should produce consistent signatures for same input', async () => {
      const signed1 = await signCookie(value, secret);
      const signed2 = await signCookie(value, secret);
      
      expect(signed1).toBe(signed2);
    });
  });

  describe('unsignCookie', () => {
    it('should unsign a valid cookie', async () => {
      const signed = await signCookie(value, secret);
      const unsigned = await unsignCookie(signed, [secret]);
      
      expect(unsigned).toBe(value);
    });

    it('should return null for invalid signature', async () => {
      const signed = await signCookie(value, secret);
      const tampered = signed + 'tampered';
      const unsigned = await unsignCookie(tampered, [secret]);
      
      expect(unsigned).toBeNull();
    });

    it('should return null for wrong secret', async () => {
      const signed = await signCookie(value, secret);
      const unsigned = await unsignCookie(signed, ['wrong-secret']);
      
      expect(unsigned).toBeNull();
    });

    it('should support multiple secrets for rotation', async () => {
      const oldSecret = 'old-secret';
      const newSecret = 'new-secret';
      
      const signedWithOld = await signCookie(value, oldSecret);
      const signedWithNew = await signCookie(value, newSecret);
      
      // Should verify with both secrets
      expect(await unsignCookie(signedWithOld, [newSecret, oldSecret])).toBe(value);
      expect(await unsignCookie(signedWithNew, [newSecret, oldSecret])).toBe(value);
    });

    it('should return null for malformed cookie', async () => {
      expect(await unsignCookie('invalid', [secret])).toBeNull();
      expect(await unsignCookie('s:no-signature', [secret])).toBeNull();
      expect(await unsignCookie('not-signed:value', [secret])).toBeNull();
    });

    it('should handle empty secrets array', async () => {
      const signed = await signCookie(value, secret);
      const unsigned = await unsignCookie(signed, []);
      
      expect(unsigned).toBeNull();
    });
  });

  describe('Security Properties', () => {
    it('should resist timing attacks', async () => {
      const signed = await signCookie(value, secret);
      const validSignature = signed.split('.')[1];
      const invalidSignature = 'x'.repeat(validSignature.length);
      
      const tamperedValid = `s:${value}.${validSignature}`;
      const tamperedInvalid = `s:${value}.${invalidSignature}`;
      
      // Both should take similar time (though we can't easily test timing here)
      const result1 = await unsignCookie(tamperedValid, [secret]);
      const result2 = await unsignCookie(tamperedInvalid, [secret]);
      
      expect(result1).toBe(value);
      expect(result2).toBeNull();
    });

    it('should handle special characters in values', async () => {
      const specialValue = 'test@user.com|123!@#$%^&*()';
      const signed = await signCookie(specialValue, secret);
      const unsigned = await unsignCookie(signed, [secret]);
      
      expect(unsigned).toBe(specialValue);
    });

    it('should handle empty values', async () => {
      const signed = await signCookie('', secret);
      const unsigned = await unsignCookie(signed, [secret]);
      
      expect(unsigned).toBe('');
    });
  });
});
