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

// Make InjectionServiceClass generic over constructor args
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface InjectionServiceClass<T, Args extends any[] = any[]> {
  new (...args: Args): T;
}

let _serviceRegistry: ServiceRegistry | null = null;

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
  if (!_serviceRegistry) {
    _serviceRegistry = new ServiceRegistry();
  }
  return innerInjectFunction(_serviceRegistry, token, options);
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
  if (!_serviceRegistry) {
    _serviceRegistry = new ServiceRegistry();
  }
  _serviceRegistry.register(token, ...properties);
}

export function registerCustomServiceInstance<T>(
  token: InjectionServiceClass<T>,
  customObject: Partial<T>
): void {
  if (!_serviceRegistry) {
    _serviceRegistry = new ServiceRegistry();
  }
  _serviceRegistry.registerCustomServiceInstance(token, customObject);
}

export function resetAllInjections(): void {
  if (!_serviceRegistry) {
    _serviceRegistry = new ServiceRegistry();
  }
  _serviceRegistry.destroy();
}
