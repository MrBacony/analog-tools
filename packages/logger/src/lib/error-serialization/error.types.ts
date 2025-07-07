/**
 * Error-specific types for the logger serialization system
 */

/**
 * Union type for all acceptable error parameters
 * 
 * Supports Error objects, strings, and any other values
 * that can be serialized for logging purposes.
 * 
 * @example
 * ```typescript
 * // Error object
 * const error: ErrorParam = new Error('Something went wrong');
 * 
 * // Plain string
 * const error: ErrorParam = 'Network timeout';
 * 
 * // Custom error object
 * const error: ErrorParam = { code: 'VALIDATION_FAILED', field: 'email' };
 * ```
 */
export type ErrorParam = Error | string | unknown;

/**
 * Structured metadata for log entries
 */
export interface LogMetadata {
  [key: string]: unknown;
  correlationId?: string;
  userId?: string;
  requestId?: string;
  context?: Record<string, unknown>;
}

/**
 * Structured error information extracted from Error objects
 * 
 * Provides a consistent structure for serialized Error objects,
 * including standard properties and any additional enumerable
 * properties that may be present on the original Error.
 * 
 * @example
 * ```typescript
 * const structuredError: StructuredError = {
 *   message: 'Database connection failed',
 *   name: 'ConnectionError',
 *   stack: 'Error: Database connection failed\n    at ...',
 *   code: 'ECONNREFUSED',
 *   host: 'localhost',
 *   port: 5432
 * };
 * ```
 */
export interface StructuredError {
  message: string;
  name?: string;
  stack?: string;
  cause?: unknown;
  code?: string | number;
  [key: string]: unknown;
}

/**
 * Configuration options for error serialization behavior
 * 
 * Controls how errors and objects are serialized, including
 * stack trace inclusion, object traversal depth limits,
 * and property enumeration settings.
 * 
 * @example
 * ```typescript
 * const options: ErrorSerializationOptions = {
 *   includeStack: true,           // Include stack traces for errors
 *   maxDepth: 5,                 // Prevent deep object recursion
 *   includeNonEnumerable: false  // Skip non-enumerable properties
 * };
 * 
 * ErrorSerializer.serialize(error, options);
 * ```
 */
export interface ErrorSerializationOptions {
  /**
   * Whether to include the stack trace in serialized errors
   * @default true
   */
  includeStack?: boolean;
  
  /**
   * Maximum depth for object serialization to prevent infinite recursion
   * @default 10
   */
  maxDepth?: number;
  
  /**
   * Whether to include non-enumerable properties in serialization
   * @default false
   */
  includeNonEnumerable?: boolean;
}
