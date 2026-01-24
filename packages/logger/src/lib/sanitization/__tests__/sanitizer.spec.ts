import { describe, it, expect } from 'vitest';
import {
  sanitizeControlChars,
  applySanitizationRules,
  sanitizeValue,
  sanitizeMessage,
  createSanitizer,
  compileRules,
} from '../sanitizer';
import { DEFAULT_VALUE_RULES } from '../default-rules';

describe('sanitizeControlChars', () => {
  it('should escape newlines', () => {
    expect(sanitizeControlChars('line1\nline2')).toBe('line1\\nline2');
    expect(sanitizeControlChars('line1\r\nline2')).toBe('line1\\nline2');
  });

  it('should escape tabs', () => {
    expect(sanitizeControlChars('col1\tcol2')).toBe('col1\\tcol2');
  });

  it('should remove other control characters', () => {
    expect(sanitizeControlChars('text\u0000hidden')).toBe('texthidden');
  });

  it('should handle empty strings', () => {
    expect(sanitizeControlChars('')).toBe('');
  });

  it('should handle strings without control characters', () => {
    expect(sanitizeControlChars('normal text')).toBe('normal text');
  });
});

describe('applySanitizationRules', () => {
  const rules = compileRules(DEFAULT_VALUE_RULES, 'mask');

  it('should redact email addresses', () => {
    expect(applySanitizationRules('Contact: user@example.com', rules)).toBe(
      'Contact: [EMAIL]'
    );
  });

  it('should redact credit card numbers', () => {
    expect(applySanitizationRules('Card: 4532-1234-5678-9012', rules)).toBe(
      'Card: [CARD]'
    );
  });

  it('should redact IP addresses', () => {
    expect(applySanitizationRules('IP: 192.168.1.1', rules)).toBe('IP: [IP]');
  });

  it('should redact SSN patterns', () => {
    expect(applySanitizationRules('SSN: 123-45-6789', rules)).toBe(
      'SSN: [SSN]'
    );
  });

  it('should redact base64 tokens', () => {
    expect(applySanitizationRules('Token: abc123def456ghi789jkl', rules)).toBe(
      'Token: [TOKEN]'
    );
  });

  it('should handle multiple patterns in one string', () => {
    const text = 'Email: user@test.com and IP: 10.0.0.1';
    expect(applySanitizationRules(text, rules)).toBe(
      'Email: [EMAIL] and IP: [IP]'
    );
  });

  it('should not modify strings without sensitive data', () => {
    expect(applySanitizationRules('normal text here', rules)).toBe(
      'normal text here'
    );
  });
});

describe('sanitizeValue', () => {
  const sanitizer = createSanitizer({ enabled: true });

  it('should sanitize string values', () => {
    expect(sanitizeValue('user@test.com', sanitizer)).toBe('[EMAIL]');
  });

  it('should sanitize object properties', () => {
    const input = { email: 'user@test.com', name: 'John' };
    const result = sanitizeValue(input, sanitizer) as Record<string, string>;
    expect(result['email']).toBe('[EMAIL]');
    expect(result['name']).toBe('John');
  });

  it('should redact sensitive keys entirely', () => {
    const input = { password: 'secret123', username: 'john' };
    const result = sanitizeValue(input, sanitizer) as Record<string, string>;
    expect(result['password']).toBe('[REDACTED]');
    expect(result['username']).toBe('john');
  });

  it('should redact token key', () => {
    const input = { token: 'abc123def456ghi789jkl' };
    const result = sanitizeValue(input, sanitizer) as Record<string, string>;
    expect(result['token']).toBe('[REDACTED]');
  });

  it('should handle nested objects', () => {
    const input = { user: { email: 'a@b.com', token: 'abc' } };
    const result = sanitizeValue(input, sanitizer) as {
      user: Record<string, string>;
    };
    expect(result.user['email']).toBe('[EMAIL]');
    expect(result.user['token']).toBe('[REDACTED]');
  });

  it('should handle arrays', () => {
    const input = ['user@test.com', 'normal text'];
    const result = sanitizeValue(input, sanitizer) as string[];
    expect(result[0]).toBe('[EMAIL]');
    expect(result[1]).toBe('normal text');
  });

  it('should handle circular references', () => {
    const obj: Record<string, unknown> = { name: 'test' };
    obj['self'] = obj;
    const result = sanitizeValue(obj, sanitizer) as Record<string, unknown>;
    expect(result['self']).toBe('[Circular Reference]');
  });

  it('should respect maxDepth', () => {
    const sanitizer = createSanitizer({ enabled: true, maxDepth: 1 });
    const input = { level1: { level2: { email: 'a@b.com' } } };
    const result = sanitizeValue(input, sanitizer) as {
      level1: { level2: { email: string } };
    };
    // level2 is at depth 2, should not be sanitized
    expect(result.level1.level2.email).toBe('a@b.com');
  });

  it('should return primitives unchanged', () => {
    expect(sanitizeValue(42, sanitizer)).toBe(42);
    expect(sanitizeValue(true, sanitizer)).toBe(true);
    expect(sanitizeValue(null, sanitizer)).toBe(null);
    expect(sanitizeValue(undefined, sanitizer)).toBe(undefined);
  });

  it('should skip sanitization when disabled', () => {
    const disabledSanitizer = createSanitizer({ enabled: false });
    expect(sanitizeValue('user@test.com', disabledSanitizer)).toBe(
      'user@test.com'
    );
  });

  it('should handle empty objects', () => {
    const input = {};
    const result = sanitizeValue(input, sanitizer);
    expect(result).toEqual({});
  });

  it('should handle empty arrays', () => {
    const input: unknown[] = [];
    const result = sanitizeValue(input, sanitizer);
    expect(result).toEqual([]);
  });
});

describe('createSanitizer', () => {
  it('should create sanitizer with defaults', () => {
    const sanitizer = createSanitizer();
    expect(sanitizer.enabled).toBe(true);
    expect(sanitizer.rules.length).toBeGreaterThan(0);
    expect(sanitizer.maxDepth).toBe(10);
  });

  it('should allow disabling sanitization', () => {
    const sanitizer = createSanitizer({ enabled: false });
    expect(sanitizer.enabled).toBe(false);
  });

  it('should merge custom rules with defaults', () => {
    const sanitizer = createSanitizer({
      customRules: [{ pattern: /custom/gi, replacement: '[CUSTOM]' }],
    });
    expect(sanitizer.rules.length).toBe(DEFAULT_VALUE_RULES.length + 1);
  });

  it('should replace defaults when rules provided', () => {
    const sanitizer = createSanitizer({
      rules: [{ pattern: /only/gi, replacement: '[ONLY]' }],
    });
    expect(sanitizer.rules.length).toBe(1);
  });

  it('should respect custom maxDepth', () => {
    const sanitizer = createSanitizer({ maxDepth: 5 });
    expect(sanitizer.maxDepth).toBe(5);
  });

  it('should use default maxDepth when not specified', () => {
    const sanitizer = createSanitizer();
    expect(sanitizer.maxDepth).toBe(10);
  });
});

describe('strategy behaviors', () => {
  it('should mask with replacement', () => {
    const sanitizer = createSanitizer({
      rules: [{ pattern: /secret/gi, strategy: 'mask', replacement: '***' }],
    });
    expect(sanitizeMessage('my secret value', sanitizer)).toBe('my *** value');
  });

  it('should remove matched content', () => {
    const sanitizer = createSanitizer({
      rules: [{ pattern: /secret/gi, strategy: 'remove' }],
    });
    expect(sanitizeMessage('my secret value', sanitizer)).toBe('my  value');
  });

  it('should hash matched content', () => {
    const sanitizer = createSanitizer({
      rules: [{ pattern: /secret/gi, strategy: 'hash', hashLength: 8 }],
    });
    const result = sanitizeMessage('my secret value', sanitizer);
    expect(result).toMatch(/my \[HASH:[a-f0-9]{8}\] value/);
  });

  it('should use custom handler', () => {
    const sanitizer = createSanitizer({
      rules: [
        {
          pattern: /\d{4}-\d{4}/g,
          strategy: 'custom',
          customHandler: (match: string) => `****-${match.slice(-4)}`,
        },
      ],
    });
    expect(sanitizeMessage('Card: 1234-5678', sanitizer)).toBe('Card: ****-5678');
  });
});

describe('sanitizeMessage', () => {
  it('should sanitize and escape control chars', () => {
    const sanitizer = createSanitizer();
    const result = sanitizeMessage('Email: a@b.com\nSSN: 123-45-6789', sanitizer);
    expect(result).toContain('[EMAIL]');
    expect(result).toContain('[SSN]');
    expect(result).toContain('\\n');
    expect(result).not.toContain('\n');
  });

  it('should skip sanitization when disabled', () => {
    const sanitizer = createSanitizer({ enabled: false });
    expect(sanitizeMessage('a@b.com', sanitizer)).toBe('a@b.com');
  });
});
