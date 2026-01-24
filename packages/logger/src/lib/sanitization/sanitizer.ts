import {
  SanitizationRule,
  CompiledSanitizationRule,
  CompiledSanitizer,
  SanitizationConfig,
  SanitizationStrategy,
  DEFAULT_SANITIZATION_CONFIG,
} from './sanitization.types';
import { DEFAULT_VALUE_RULES, SENSITIVE_KEY_PATTERNS } from './default-rules';

/**
 * Check if a value has circular references
 */
export function hasCircularReference(
  value: unknown,
  seen = new WeakSet<object>()
): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value !== 'object') {
    return false;
  }

  if (seen.has(value as object)) {
    return true;
  }

  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.some((item) => hasCircularReference(item, seen));
  }

  if (typeof value === 'object') {
    for (const val of Object.values(value)) {
      if (hasCircularReference(val, seen)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Escape control characters to prevent log injection attacks
 */
export function sanitizeControlChars(input: string): string {
  return input
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/\t/g, '\\t')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '');
}

/**
 * Generate a truncated, deterministic hash of the input for log sanitization.
 *
 * Security notice:
 * - This function is NOT cryptographically secure.
 * - The same input will always produce the same hash output, which allows
 *   correlation of values across log entries.
 * - The output is predictable and can be brute-forced; it MUST NOT be used
 *   for anonymization, pseudonymization, or protecting sensitive data in
 *   security-sensitive contexts.
 *
 * It is intended only to obfuscate values in logs where correlation is
 * acceptable and true anonymity is not required.
 */
function hashValue(input: string, length: number): string {
  // Use a simple, deterministic string-based hash that works in all environments.
  // This is not cryptographically secure and is only suitable for basic log sanitization.
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).substring(0, length);
}

/**
 * Apply a single rule to a string value
 */
function applyRule(value: string, rule: CompiledSanitizationRule): string {
  switch (rule.strategy) {
    case 'mask':
      return value.replace(rule.pattern, rule.replacement);
    case 'remove':
      return value.replace(rule.pattern, '');
    case 'hash':
      return value.replace(rule.pattern, (match) => `[HASH:${hashValue(match, rule.hashLength)}]`);
    case 'custom':
      if (rule.customHandler) {
        return value.replace(rule.pattern, rule.customHandler);
      }
      return value.replace(rule.pattern, rule.replacement);
    default:
      return value.replace(rule.pattern, rule.replacement);
  }
}

/**
 * Apply all sanitization rules to a string
 */
export function applySanitizationRules(
  value: string,
  rules: CompiledSanitizationRule[]
): string {
  let result = value;
  for (const rule of rules) {
    result = applyRule(result, rule);
  }
  return result;
}

/**
 * Check if a key name matches sensitive patterns
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Recursively sanitize a value (string, object, or array)
 */
export function sanitizeValue(
  value: unknown,
  sanitizer: CompiledSanitizer,
  currentDepth = 0,
  seen = new WeakSet<object>()
): unknown {
  // Skip if disabled
  if (!sanitizer.enabled) {
    return value;
  }

  // Depth limit check
  if (currentDepth > sanitizer.maxDepth) {
    return value;
  }

  // Handle null/undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Handle strings
  if (typeof value === 'string') {
    let result = applySanitizationRules(value, sanitizer.rules);
    result = sanitizeControlChars(result);
    return result;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[Circular Reference]';
    }
    seen.add(value);
    return value.map((item) => sanitizeValue(item, sanitizer, currentDepth + 1, seen));
  }

  // Handle objects
  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular Reference]';
    }
    seen.add(value);

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      // Redact entire value if key is sensitive
      if (isSensitiveKey(key) && typeof val === 'string') {
        result[key] = '[REDACTED]';
      } else {
        result[key] = sanitizeValue(val, sanitizer, currentDepth + 1, seen);
      }
    }
    return result;
  }

  // Return primitives (numbers, booleans) unchanged
  return value;
}

/**
 * Compile rules with resolved defaults
 */
export function compileRules(
  rules: SanitizationRule[],
  defaultStrategy: SanitizationStrategy
): CompiledSanitizationRule[] {
  return rules.map((rule) => ({
    pattern: rule.pattern,
    strategy: rule.strategy ?? defaultStrategy,
    replacement: rule.replacement ?? '[REDACTED]',
    hashLength: rule.hashLength ?? 8,
    customHandler: rule.customHandler,
  }));
}

/**
 * Create a compiled sanitizer from configuration
 */
export function createSanitizer(config?: SanitizationConfig): CompiledSanitizer {
  const enabled = config?.enabled ?? DEFAULT_SANITIZATION_CONFIG.enabled;
  const strategy = config?.strategy ?? DEFAULT_SANITIZATION_CONFIG.strategy;
  const maxDepth = config?.maxDepth ?? DEFAULT_SANITIZATION_CONFIG.maxDepth;

  // Determine which rules to use
  let rules: SanitizationRule[];
  if (config?.rules) {
    // User provided rules replace defaults entirely
    rules = config.rules;
  } else {
    // Use defaults + any custom rules
    rules = [...DEFAULT_VALUE_RULES, ...(config?.customRules ?? [])];
  }

  return {
    enabled,
    rules: compileRules(rules, strategy),
    maxDepth,
  };
}

/**
 * Sanitize a log message string
 */
export function sanitizeMessage(
  message: string,
  sanitizer: CompiledSanitizer
): string {
  if (!sanitizer.enabled) {
    return message;
  }
  let result = applySanitizationRules(message, sanitizer.rules);
  result = sanitizeControlChars(result);
  return result;
}
