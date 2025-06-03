/**
 * Dependency injection utility for Phaser.js games
 * Provides type-safe service injection throughout the application
 */

import { getServiceRegistry, ServiceRegistry } from './service-registry';
import { InjectionServiceClass, InjectOptions } from './inject.types';

function innerInjectFunction<T>(
  registry: ServiceRegistry,
  token: InjectionServiceClass<T>,
  options: InjectOptions = {}
): T {
  const { required = true } = options;
  // Type assertion to help TypeScript understand the return type
  const service = registry.getService(token) as T | undefined;

  if (!service && required) {
    throw new Error(
      `Service with token ${token || 'unknown'} not found in registry`
    );
  }

  return service as T;
}

/**
 * Inject a service from the ServiceRegistry
 * @param token - The injection token for the service
 * @param options - Injection options
 * @returns The requested service instance
 */

export function inject<T>(
  token: InjectionServiceClass<T>,
  options: InjectOptions = {}
): T {
  return innerInjectFunction(getServiceRegistry(), token, options);
}

/**
 * Register a service instance with the ServiceRegistry
 * @param token - The injection token (service class)
 * @param properties - The constructor parameters for the service class
 */
// Update registerService to enforce constructor parameter types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerService<T, Args extends any[]>(
  token: InjectionServiceClass<T, Args>,
  ...properties: Args
): void {
  getServiceRegistry().register(token, ...properties);
}

/**
 * Register a service as undefined in the ServiceRegistry
 * @param token - The injection token for the service
 */
export function registerServiceAsUndefined<T>(
  token: InjectionServiceClass<T>
): void {
  getServiceRegistry().registerAsUndefined(token);
}
