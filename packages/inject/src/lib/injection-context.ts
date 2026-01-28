/**
 * Scoped Dependency Injection Context
 * Replaces global singleton with scoped registries for better isolation
 */

import { ServiceRegistry } from './service-registry';
import { InjectionServiceClass, InjectOptions } from './inject.types';
import { InjectionError } from './inject.util';

export class InjectionContext {
  private static contexts = new Map<string, ServiceRegistry>();
  private static defaultScope = 'default';

  /**
   * Get or create a registry for the specified scope
   */
  static getRegistry(scope: string = this.defaultScope): ServiceRegistry {
    if (!this.contexts.has(scope)) {
      this.contexts.set(scope, new ServiceRegistry());
    }
    const registry = this.contexts.get(scope);
    if (!registry) {
      throw new Error(`Failed to create registry for scope '${scope}'`);
    }
    return registry;
  }

  /**
   * Create a new scope with its own registry
   */
  static createScope(scope: string): ServiceRegistry {
    if (this.contexts.has(scope)) {
      throw new Error(`Scope '${scope}' already exists`);
    }
    const registry = new ServiceRegistry();
    this.contexts.set(scope, registry);
    return registry;
  }

  /**
   * Destroy a scope and cleanup its services
   */
  static destroyScope(scope: string): void {
    const registry = this.contexts.get(scope);
    if (registry) {
      registry.destroy();
      this.contexts.delete(scope);
    }
  }

  /**
   * Destroy a scope and cleanup its services asynchronously
   */
  static async destroyScopeAsync(scope: string): Promise<void> {
    const registry = this.contexts.get(scope);
    if (registry) {
      await registry.destroyAsync();
      this.contexts.delete(scope);
    }
  }

  /**
   * Clear all scopes asynchronously with proper resource cleanup
   */
  static async clearAllAsync(): Promise<void> {
    const { AggregateDestructionError } = await import('./inject.util');
    const errors: Array<{ serviceName: string; error: Error }> = [];

    const entries = Array.from(this.contexts.entries());
    for (const [scope, registry] of entries) {
      try {
        await registry.destroyAsync();
      } catch (error) {
        if (error instanceof AggregateDestructionError) {
          // Collect failures from each scope
          errors.push(...error.failures);
        } else if (error instanceof Error) {
          errors.push({
            serviceName: `scope:${scope}`,
            error,
          });
        }
      }
    }

    this.contexts.clear();

    if (errors.length > 0) {
      throw new AggregateDestructionError(errors);
    }
  }

  /**
   * Set the default scope for injection operations
   */
  static setDefaultScope(scope: string): void {
    this.defaultScope = scope;
  }

  /**
   * Get all active scopes
   */
  static getActiveScopes(): string[] {
    return Array.from(this.contexts.keys());
  }

  /**
   * Clear all scopes (useful for testing)
   */
  static clearAll(): void {
    const registries = Array.from(this.contexts.values());
    for (const registry of registries) {
      registry.destroy();
    }
    this.contexts.clear();
  }
}

/**
 * Inject a service from a specific scope
 * @param token - The injection token for the service
 * @param scope - The scope name (uses default if not provided)
 * @param options - Injection options
 * @returns The requested service instance
 * @throws {InjectionError} When a required service is not found in the scope
 * @example
 * ```typescript
 * const service = injectScoped(MyService, 'request-scope');
 * ```
 */
export function injectScoped<T>(
  token: InjectionServiceClass<T>,
  scope?: string,
  options: InjectOptions = {}
): T {
  const registry = InjectionContext.getRegistry(scope);
  const { required = true } = options;
  
  try {
    const service = registry.getService(token);

    if (service === undefined || service === null) {
      if (required) {
        throw new InjectionError(
          `Service '${token.name}' not found in scope '${scope || 'default'}' and is required`,
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
      `Failed to inject service '${token.name}' from scope '${scope || 'default'}'`,
      token.name,
      error as Error
    );
  }
}

/**
 * Register a service in a specific scope
 * @param token - The injection token (service class)
 * @param scope - The scope name (uses default if not provided)
 * @param properties - The constructor parameters for the service class
 * @throws {InjectionError} When service registration fails
 * @example
 * ```typescript
 * registerServiceScoped(MyService, 'request-scope', configInstance);
 * ```
 */
export function registerServiceScoped<T, Args extends unknown[] = unknown[]>(
  token: InjectionServiceClass<T, Args>,
  scope?: string,
  ...properties: Args
): void {
  const registry = InjectionContext.getRegistry(scope);
  
  try {
    registry.register(token, ...properties);
  } catch (error) {
    throw new InjectionError(
      `Failed to register service '${token.name}' in scope '${scope || 'default'}'`,
      token.name,
      error as Error
    );
  }
}

/**
 * Register a service as undefined in a specific scope (useful for testing)
 * @param token - The injection token for the service
 * @param scope - The scope name (uses default if not provided)
 * @throws {InjectionError} When service registration fails
 * @example
 * ```typescript
 * registerServiceAsUndefinedScoped(MyService, 'test-scope');
 * ```
 */
export function registerServiceAsUndefinedScoped<T>(
  token: InjectionServiceClass<T>,
  scope?: string
): void {
  const registry = InjectionContext.getRegistry(scope);
  
  try {
    registry.registerAsUndefined(token);
  } catch (error) {
    throw new InjectionError(
      `Failed to register service '${token.name}' as undefined in scope '${scope || 'default'}'`,
      token.name,
      error as Error
    );
  }
}
