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
  // JWT tokens (Header.Payload.Signature starting with eyJ)
  // Uses (?!\w) instead of \b at the end: \b fails to match right after a
  // trailing '-' (a valid base64url char), which would otherwise let the
  // regex backtrack and leave that character un-redacted.
  {
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?!\w)/g,
    replacement: '[TOKEN]',
  },

  // Bearer authorization tokens
  // (?!\w) instead of \b: '=' padding is a non-word char, so a trailing \b
  // would fail and the regex would backtrack past the padding, leaking it.
  {
    pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{8,}=*(?!\w)/gi,
    replacement: 'Bearer [TOKEN]',
  },

  // Known API key formats (Stripe, GitHub, Slack, Google, etc.)
  {
    pattern:
      /\b(?:sk_live|sk_test|pk_live|pk_test|ghp|gho|github_pat|xox[baprs]|ya29)[_.-][A-Za-z0-9_.-]{10,}(?!\w)/g,
    replacement: '[TOKEN]',
  },

  // Key-value pairs matching token/key terms in text messages (e.g. Token: xyz..., api_key=xyz...)
  // No leading \b: a leading boundary can't match inside a camelCase
  // identifier like `refreshToken:`/`accessToken:`, which is exactly how
  // this codebase's own session fields are named, so those would otherwise
  // never be redacted in free-text log messages.
  {
    pattern:
      /(token|api_?key|secret|auth_?token)\s*[:=]\s*[A-Za-z0-9._~+/-]{10,}=*/gi,
    replacement: '$1: [TOKEN]',
  },

  // Base64-like tokens with explicit padding (= or ==)
  {
    pattern: /\b(?!(.)\1{10})[A-Za-z0-9+/]{16,}={1,2}(?!\w)/g,
    replacement: '[TOKEN]',
  },

  // Base64-like tokens with non-alphanumeric base64 chars (+ or /)
  // Single quantified run + lookahead (instead of two alternated runs
  // straddling a mandatory pivot char) avoids the ambiguous split-point
  // backtracking of the old two-alternative form, which was O(n^2)-prone
  // on long non-matching input.
  {
    pattern: /\b(?!(.)\1{10})(?=[A-Za-z0-9+/]*[+/])[A-Za-z0-9+/]{16,}(?!\w)/g,
    replacement: '[TOKEN]',
  },

  // Generic fallback for opaque tokens with no known shape/prefix/context
  // (plain hex/alnum secrets, session ids, etc.). Requires a mix of at
  // least one digit and one letter so it doesn't catch pure-letter
  // identifiers/class names (see sanitizer.spec.ts), while still catching
  // the kind of random secret the removed catch-all rule used to redact.
  {
    pattern:
      /\b(?!(.)\1{10})(?=[A-Za-z0-9+/]*[0-9])(?=[A-Za-z0-9+/]*[A-Za-z])[A-Za-z0-9+/]{20,}={0,2}(?!\w)/g,
    replacement: '[TOKEN]',
  },

  // Credit card numbers (16 digits, with or without separators)
  { pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, replacement: '[CARD]' },

  // Email addresses
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL]',
  },

  // IPv4 addresses
  {
    pattern:
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: '[IP]',
  },

  // SSN pattern (US Social Security Number)
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
];
