/**
 * Sanitization strategy for handling matched sensitive data
 */
export type SanitizationStrategy = 'mask' | 'remove' | 'hash' | 'custom';

/**
 * Configuration for a single sanitization rule
 */
export interface SanitizationRule {
  /** Regex pattern to match sensitive data */
  pattern: RegExp;
  /** Strategy for handling matches (default: 'mask') */
  strategy?: SanitizationStrategy;
  /** Replacement string for 'mask' strategy (default: '[REDACTED]') */
  replacement?: string;
  /** Length of hash output for 'hash' strategy (default: 8) */
  hashLength?: number;
  /** Custom handler function for 'custom' strategy */
  customHandler?: (match: string) => string;
}

/**
 * Compiled rule with resolved defaults for runtime use
 */
export interface CompiledSanitizationRule {
  pattern: RegExp;
  strategy: SanitizationStrategy;
  replacement: string;
  hashLength: number;
  customHandler?: (match: string) => string;
}

/**
 * Sanitization configuration for LoggerConfig
 */
export interface SanitizationConfig {
  /** Enable/disable sanitization (default: true) */
  enabled?: boolean;
  /** Replace default rules entirely */
  rules?: SanitizationRule[];
  /** Append to default rules */
  customRules?: SanitizationRule[];
  /** Default strategy for rules without explicit strategy (default: 'mask') */
  strategy?: SanitizationStrategy;
  /** Maximum depth for object traversal (default: 10) */
  maxDepth?: number;
}

/**
 * Compiled sanitizer instance with pre-processed rules
 */
export interface CompiledSanitizer {
  readonly enabled: boolean;
  readonly rules: CompiledSanitizationRule[];
  readonly maxDepth: number;
}

/** Default values */
export const DEFAULT_SANITIZATION_CONFIG: Required<
  Omit<SanitizationConfig, 'rules' | 'customRules'>
> = {
  enabled: true,
  strategy: 'mask',
  maxDepth: 10,
};
