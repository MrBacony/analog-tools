/**
 * Error serialization utilities for safe logging with circular reference handling
 */

import { StructuredError, ErrorSerializationOptions } from './error.types';

/**
 * Utility class for safely serializing errors and objects for logging
 * 
 * Provides robust error serialization with support for:
 * - Standard Error objects with stack traces
 * - Circular reference detection and handling
 * - Maximum depth limits to prevent infinite recursion
 * - Non-enumerable property inclusion options
 * - Safe stringification of any value type
 * 
 * @example
 * ```typescript
 * // Serialize a standard Error
 * const error = new Error('Something went wrong');
 * const serialized = ErrorSerializer.serialize(error);
 * 
 * // Serialize with custom options
 * const serialized = ErrorSerializer.serialize(error, {
 *   includeStack: false,
 *   maxDepth: 5,
 *   includeNonEnumerable: true
 * });
 * 
 * // Serialize any object
 * const obj = { nested: { data: 'value' } };
 * const serialized = ErrorSerializer.serialize(obj);
 * ```
 */
export class ErrorSerializer {
  private static readonly DEFAULT_MAX_DEPTH = 10;
  private static readonly CIRCULAR_REF_PLACEHOLDER = '[Circular Reference]';
  private static readonly MAX_DEPTH_PLACEHOLDER = '[Max Depth Reached]';
  private static readonly UNABLE_TO_SERIALIZE = '[Unable to serialize]';
  
  // Simple memoization cache for frequently serialized errors (limited size to prevent memory leaks)
  private static readonly serializationCache = new Map<string, StructuredError | string>();
  private static readonly MAX_CACHE_SIZE = 100;
  
  /**
   * Generate a cache key for memoization (includes serialization options)
   * @private
   */
  private static getCacheKey(error: Error, includeStack: boolean, maxDepth: number, includeNonEnumerable: boolean): string | null {
    // Only cache if error has a stack trace (more stable identity)
    if (!error.stack) return null;
    
    // Create a simple hash based on message + first line of stack + options
    const stackFirstLine = error.stack.split('\n')[0] || '';
    return `${error.name}:${error.message}:${stackFirstLine}:${includeStack}:${maxDepth}:${includeNonEnumerable}`;
  }
  
  /**
   * Add to cache with size limit enforcement
   * @private
   */
  private static addToCache(key: string, value: StructuredError | string): void {
    if (this.serializationCache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entry (first in Map)
      const firstKey = this.serializationCache.keys().next().value;
      if (firstKey) {
        this.serializationCache.delete(firstKey);
      }
    }
    this.serializationCache.set(key, value);
  }
  
  /**
   * Safely serialize any value (Error objects, plain objects, primitives) for logging
   * 
   * @param error - The value to serialize (Error, object, string, etc.)
   * @param options - Configuration options for serialization behavior
   * @returns Serialized representation - StructuredError for Error objects, string for others
   * 
   * @example
   * ```typescript
   * // Serialize an Error object
   * const error = new Error('Failed to connect');
   * const result = ErrorSerializer.serialize(error);
   * // Returns: { message: 'Failed to connect', name: 'Error', stack: '...' }
   * 
   * // Serialize a plain object
   * const obj = { userId: '123', action: 'login' };
   * const result = ErrorSerializer.serialize(obj);
   * // Returns: '{\n  "userId": "123",\n  "action": "login"\n}'
   * 
   * // Serialize with options
   * const result = ErrorSerializer.serialize(error, { includeStack: false });
   * ```
   */
  static serialize(
    error: unknown, 
    options: ErrorSerializationOptions = {}
  ): StructuredError | string {
    const {
      includeStack = true,
      maxDepth = ErrorSerializer.DEFAULT_MAX_DEPTH,
      includeNonEnumerable = false
    } = options;
    
    // Handle Error instances
    if (error instanceof Error) {
      // Check cache first
      const cacheKey = this.getCacheKey(error, includeStack, maxDepth, includeNonEnumerable);
      if (cacheKey) {
        const cached = this.serializationCache.get(cacheKey);
        if (cached) {
          return cached;
        }
      }
      
      const result = this.serializeError(error, includeStack, maxDepth, includeNonEnumerable, new WeakSet());
      
      // Add to cache
      if (cacheKey) {
        this.addToCache(cacheKey, result);
      }
      
      return result;
    }
    
    // Handle string inputs
    if (typeof error === 'string') {
      return error;
    }
    
    // Handle all other types
    const stringified = this.safeStringify(error, maxDepth, new WeakSet());
    if (typeof stringified === 'string') {
      return stringified;
    }
    
    try {
      return JSON.stringify(stringified, null, 2);
    } catch {
      return String(stringified);
    }
  }
  
  /**
   * Serialize a standard Error object
   * @private
   */
  private static serializeError(
    error: Error, 
    includeStack: boolean, 
    maxDepth: number,
    includeNonEnumerable: boolean,
    seen: WeakSet<object> = new WeakSet()
  ): StructuredError {
    // Check for circular reference first
    if (seen.has(error)) {
      return { message: error.message, name: error.name, [Symbol.for('circular')]: this.CIRCULAR_REF_PLACEHOLDER };
    }
    
    seen.add(error);
    
    const result: StructuredError = {
      message: error.message,
      name: error.name
    };
    
    // Include stack trace if requested
    if (includeStack && error.stack) {
      result.stack = error.stack;
    }
    
    // Handle Error.cause (Node.js 16+)
    if ('cause' in error && error.cause !== undefined) {
      if (error.cause instanceof Error) {
        result.cause = this.serializeError(error.cause, includeStack, maxDepth - 1, includeNonEnumerable, seen);
      } else {
        result.cause = this.safeStringify(error.cause, maxDepth - 1, seen);
      }
    }
    
    // Include enumerable properties
    Object.keys(error).forEach(key => {
      if (!(key in result)) {
        try {
          const errorRecord = error as unknown as Record<string, unknown>;
          result[key] = this.safeStringify(errorRecord[key], maxDepth - 1, seen);
        } catch {
          result[key] = this.UNABLE_TO_SERIALIZE;
        }
      }
    });
    
    // Include non-enumerable properties if requested
    if (includeNonEnumerable) {
      Object.getOwnPropertyNames(error).forEach(key => {
        if (!(key in result) && key !== 'stack' && key !== 'message' && key !== 'name') {
          try {
            const descriptor = Object.getOwnPropertyDescriptor(error, key);
            if (descriptor && descriptor.enumerable === false) {
              const errorRecord = error as unknown as Record<string, unknown>;
              result[key] = this.safeStringify(errorRecord[key], maxDepth - 1, seen);
            }
          } catch {
            result[key] = this.UNABLE_TO_SERIALIZE;
          }
        }
      });
    }
    
    return result;
  }
  
  /**
   * Safely stringify any object with circular reference detection
   * @private
   */
  private static safeStringify(obj: unknown, maxDepth: number, seen: WeakSet<object> = new WeakSet()): unknown {
    if (maxDepth <= 0) {
      return this.MAX_DEPTH_PLACEHOLDER;
    }
    
    // Handle primitives
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    // Handle circular references
    if (seen.has(obj as object)) {
      return this.CIRCULAR_REF_PLACEHOLDER;
    }
    
    seen.add(obj as object);
    
    try {
      if (Array.isArray(obj)) {
        return obj.map(item => this.safeStringify(item, maxDepth - 1, seen));
      }
      
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        try {
          result[key] = this.safeStringify(value, maxDepth - 1, seen);
        } catch {
          result[key] = this.UNABLE_TO_SERIALIZE;
        }
      }
      
      seen.delete(obj as object);
      return result;
    } catch {
      seen.delete(obj as object);
      return this.UNABLE_TO_SERIALIZE;
    }
  }
}
