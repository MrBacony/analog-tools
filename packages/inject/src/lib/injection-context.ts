/**
 * Scoped Dependency Injection Context
 * Replaces global singleton with scoped registries for better isolation
 */

import { ServiceRegistry } from './service-registry';
import { InjectionServiceClass, InjectOptions } from './inject.types';

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
    for (const registry of this.contexts.values()) {
      registry.destroy();
    }
    this.contexts.clear();
  }
}

/**
 * Scoped injection functions
 */
export function injectScoped<T>(
  token: InjectionServiceClass<T>,
  scope?: string,
  options: InjectOptions = {}
): T {
  const registry = InjectionContext.getRegistry(scope);
  const { required = true } = options;
  const service = registry.getService(token);

  if (!service && required) {
    throw new Error(
      `Service with token ${token.name || 'unknown'} not found in registry`
    );
  }

  return service as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerServiceScoped<T, Args extends any[]>(
  token: InjectionServiceClass<T, Args>,
  scope?: string,
  ...properties: Args
): void {
  const registry = InjectionContext.getRegistry(scope);
  registry.register(token, ...properties);
}

/**
 * Register a service as undefined in a specific scope
 */
export function registerServiceAsUndefinedScoped<T>(
  token: InjectionServiceClass<T>,
  scope?: string
): void {
  const registry = InjectionContext.getRegistry(scope);
  registry.registerAsUndefined(token);
}
