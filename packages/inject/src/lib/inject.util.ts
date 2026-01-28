/**
 * Type-safe injection utilities with improved error handling
 */

import { InjectionServiceClass, InjectOptions } from './inject.types';
import { getServiceRegistry } from './service-registry';

/**
 * Custom error class for injection-related errors
 * @example
 * ```typescript
 * try {
 *   const service = inject(MyService);
 * } catch (error) {
 *   if (error instanceof InjectionError) {
 *     console.error(`Service ${error.token} not found: ${error.message}`);
 *   }
 * }
 * ```
 */
export class InjectionError extends Error {
  /**
   * Optional underlying error cause.
   *
   * NOTE:
   * - Newer JavaScript runtimes and TypeScript lib definitions already define `Error["cause"]`.
   * - We use `declare` here so we only contribute type information and do NOT redefine the
   *   property at runtime. This keeps the class compatible with:
   *   - environments / TS configs that do not yet include `Error.cause`, and
   *   - environments where `Error.cause` is already part of the standard `Error` type.
   *
   * When targeting ES2022+ (or TS versions with native `Error.cause` support), this line
   * simply augments the existing type. In older targets it provides a typed `cause` property
   * without changing the runtime shape of `Error`.
   */
  declare cause?: Error;

  constructor(
    message: string,
    public readonly token?: string,
    cause?: Error
  ) {
    super(message);
    this.name = 'InjectionError';
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Error thrown when a circular dependency is detected
 * @example
 * ```typescript
 * try {
 *   const service = inject(ServiceA);
 * } catch (error) {
 *   if (error instanceof CircularDependencyError) {
 *     console.error(`Circular dependency: ${error.message}`);
 *   }
 * }
 * ```
 */
export class CircularDependencyError extends InjectionError {
  constructor(dependencyChain: string[]) {
    super(`Circular dependency detected: ${dependencyChain.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}

/**
 * Error thrown when a class is missing the required SERVICE_TOKEN.
 * This indicates the class was not decorated with @Injectable().
 */
export class MissingServiceTokenError extends InjectionError {
  constructor(className: string) {
    super(
      `Service '${className}' is missing SERVICE_TOKEN. ` +
        `Add @Injectable() decorator to the class. ` +
        `See: packages/inject/docs/migrations/symbol-tokens.md`,
      className
    );
    this.name = 'MissingServiceTokenError';
  }
}

/**
 * Error thrown when one or more services fail during destruction.
 * Contains all individual errors for debugging.
 */
export class AggregateDestructionError extends InjectionError {
  constructor(
    public readonly failures: Array<{ serviceName: string; error: Error }>
  ) {
    const summary = failures
      .map((f) => `${f.serviceName}: ${f.error.message}`)
      .join('; ');
    super(`Failed to destroy ${failures.length} service(s): ${summary}`);
    this.name = 'AggregateDestructionError';
  }

  /**
   * Get all underlying errors
   */
  getErrors(): Error[] {
    return this.failures.map((f) => f.error);
  }

  /**
   * Check if a specific service failed
   */
  hasFailure(serviceName: string): boolean {
    return this.failures.some((f) => f.serviceName === serviceName);
  }
}

/**
 * Inject a service from the ServiceRegistry
 * @param token - The injection token for the service
 * @param options - Injection options
 * @returns The requested service instance
 * @throws {InjectionError} When a required service is not found
 * @throws {InjectionError} When service retrieval fails
 * @example
 * ```typescript
 * try {
 *   const service = inject(MyService);
 * } catch (error) {
 *   if (error instanceof InjectionError) {
 *     console.error(`Injection failed: ${error.message}`);
 *   }
 * }
 * ```
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
 * Register a service instance with the ServiceRegistry
 * @param token - The injection token (service class)
 * @param properties - The constructor parameters for the service class
 * @throws {InjectionError} When service registration fails
 * @example
 * ```typescript
 * class MyService {
 *   constructor(config: Config) {}
 * }
 *
 * registerService(MyService, configInstance);
 * ```
 */
export function registerService<T, Args extends unknown[] = unknown[]>(
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
 * Register a service as undefined in the ServiceRegistry (useful for testing)
 * @param token - The injection token for the service
 * @throws {InjectionError} When service registration fails
 * @example
 * ```typescript
 * registerServiceAsUndefined(MyService);
 * const service = inject(MyService, { required: false });
 * ```
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
 * Check if a service is available in the registry without throwing
 * @param token - The injection token for the service
 * @returns true if the service is registered, false otherwise
 * @example
 * ```typescript
 * if (hasService(MyService)) {
 *   const service = inject(MyService);
 * }
 * ```
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
 * Never throws an error, useful for optional dependencies
 * @param token - The injection token for the service
 * @returns The service instance or undefined if not found
 * @example
 * ```typescript
 * const optionalService = tryInject(OptionalService);
 * if (optionalService) {
 *   optionalService.doSomething();
 * }
 * ```
 */
export function tryInject<T>(
  token: InjectionServiceClass<T>
): T | undefined {
  return inject(token, { required: false });
}

/**
 * Inject a service asynchronously, ensuring async initialization is complete.
 * @param token - The injection token for the service
 * @param options - Injection options
 * @returns Promise resolving to the initialized service instance
 * @throws {InjectionError} When a required service is not found or initialization fails
 * @example
 * ```typescript
 * try {
 *   const service = await injectAsync(MyService);
 * } catch (error) {
 *   if (error instanceof InjectionError) {
 *     console.error(`Service injection failed: ${error.message}`);
 *   }
 * }
 * ```
 */
export async function injectAsync<T>(
  token: InjectionServiceClass<T>,
  options: InjectOptions = {}
): Promise<T> {
  const { required = true } = options;

  try {
    const service = await getServiceRegistry().getServiceAsync(token);

    if (service === undefined || service === null) {
      if (required) {
        throw new InjectionError(
          `Service '${token.name}' not found in registry and is required`,
          token.name
        );
      }
      return undefined as T;
    }

    return service;
  } catch (error) {
    if (error instanceof InjectionError) {
      throw error;
    }
    throw new InjectionError(
      `Failed to inject async service '${token.name}'`,
      token.name,
      error as Error
    );
  }
}

/**
 * Register and eagerly initialize an async service.
 * Use during application startup to ensure services are ready.
 * @param token - The injection token (service class)
 * @param properties - The constructor parameters for the service class
 * @throws {InjectionError} When registration or initialization fails
 * @example
 * ```typescript
 * await registerAsync(DatabaseService);
 * // Service is now initialized and ready to use
 * const db = inject(DatabaseService);
 * ```
 */
export async function registerAsync<T, Args extends unknown[] = unknown[]>(
  token: InjectionServiceClass<T, Args>,
  ...properties: Args
): Promise<void> {
  try {
    await getServiceRegistry().registerAsync(token, ...properties);
  } catch (error) {
    if (error instanceof InjectionError) {
      throw error;
    }
    throw new InjectionError(
      `Failed to register async service '${token.name}'`,
      token.name,
      error as Error
    );
  }
}

/**
 * Destroy all services in the global registry asynchronously.
 * Invokes onDestroy() lifecycle hooks for proper resource cleanup.
 * @throws {AggregateDestructionError} When one or more services fail to destroy
 * @example
 * ```typescript
 * process.on('SIGTERM', async () => {
 *   await destroyAllServicesAsync();
 *   process.exit(0);
 * });
 * ```
 */
export async function destroyAllServicesAsync(): Promise<void> {
  return getServiceRegistry().destroyAsync();
}
