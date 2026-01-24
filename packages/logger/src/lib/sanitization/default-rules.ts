import { SanitizationRule } from './sanitization.types';

/**
 * Patterns for sensitive key names - values for these keys are fully redacted
 */
export const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /password/i,
  /token/i,
  /secret/i,
  /apikey|api_key|api-key/i,
  /authorization/i,
  /credential/i,
  /private/i,
];

/**
 * Default sanitization rules for common sensitive data patterns.
 * These patterns match values in log messages and metadata.
 */
export const DEFAULT_VALUE_RULES: SanitizationRule[] = [
  // Base64-like tokens (20+ chars of base64 alphabet)
  // Uses negative lookahead to exclude strings with more than 10 consecutive identical characters
  // This prevents matching very long strings of the same character (e.g., 'AAAAAAA...')
  { pattern: /\b(?!(.)\1{10})[A-Za-z0-9+/]{20,}={0,2}\b/g, replacement: '[TOKEN]' },

  // Credit card numbers (16 digits, with or without separators)
  { pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, replacement: '[CARD]' },

  // Email addresses
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL]',
  },

  // IPv4 addresses
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[IP]' },

  // SSN pattern (US Social Security Number)
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
];
