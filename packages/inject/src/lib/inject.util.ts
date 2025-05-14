/**
 * Dependency injection utility for Phaser.js games
 * Provides type-safe service injection throughout the application
 */

import { ServiceRegistry } from './service-registry';

/**
 * Service injection options
 */
export interface InjectOptions {
  /**
   * Whether to throw an error if the service is not found
   * @default true
   */
  required?: boolean;
}

export interface InjectionServiceClass<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): T;
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
  const { required = true } = options;
  const registry = ServiceRegistry.getInstance();

  // Type assertion to help TypeScript understand the return type
  const service = registry.getService(token) as T | undefined;

  if (!service && required) {
    throw new Error(
      `Service with token ${token || 'unknown'} not found in registry`
    );
  }

  return service as T;
}
