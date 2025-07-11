/**
 * Type-safe injection utilities with improved error handling
 */

import { InjectionServiceClass, InjectOptions } from './inject.types';
import { getServiceRegistry } from './service-registry';

/**
 * Custom error class for injection-related errors
 */
export class InjectionError extends Error {
  constructor(
    message: string,
    public readonly token?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'InjectionError';
  }
}

/**
 * Error for circular dependency detection
 */
export class CircularDependencyError extends InjectionError {
  constructor(dependencyChain: string[]) {
    super(`Circular dependency detected: ${dependencyChain.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}

/**
 * Type-safe inject function with strict null checking
 */
export function inject<T>(
  token: InjectionServiceClass<T>,
  options: InjectOptions = {}
): T {
  const { required = true } = options;
  
  try {
    const service = getServiceRegistry().getService(token);
    
    if (service === undefined || service === null) {
      if (required) {
        throw new InjectionError(
          `Service '${token.name}' not found in registry and is required`,
          token.name
        );
      }
      return undefined as T; // This is only valid when required = false
    }
    
    return service;
  } catch (error) {
    if (error instanceof InjectionError) {
      throw error;
    }
    throw new InjectionError(
      `Failed to inject service '${token.name}'`,
      token.name,
      error as Error
    );
  }
}

/**
 * Type-safe service registration with strict typing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerService<T, Args extends any[] = any[]>(
  token: InjectionServiceClass<T, Args>,
  ...properties: Args
): void {
  try {
    getServiceRegistry().register(token, ...properties);
  } catch (error) {
    throw new InjectionError(
      `Failed to register service '${token.name}'`,
      token.name,
      error as Error
    );
  }
}

/**
 * Register a service as undefined for testing
 */
export function registerServiceAsUndefined<T>(
  token: InjectionServiceClass<T>
): void {
  try {
    getServiceRegistry().registerAsUndefined(token);
  } catch (error) {
    throw new InjectionError(
      `Failed to register service '${token.name}' as undefined`,
      token.name,
      error as Error
    );
  }
}

/**
 * Check if a service is available without throwing
 */
export function hasService<T>(token: InjectionServiceClass<T>): boolean {
  try {
    return getServiceRegistry().hasService(token);
  } catch {
    return false;
  }
}

/**
 * Try to inject a service, returning undefined if not available
 */
export function tryInject<T>(
  token: InjectionServiceClass<T>
): T | undefined {
  return inject(token, { required: false });
}
