import { InjectionServiceClass } from './inject.types';
import { getServiceRegistry } from './service-registry';
import { InjectionContext } from './injection-context';

export function registerMockService<T>(
  token: InjectionServiceClass<T>,
  customObject: Partial<T>
): void {
  getServiceRegistry().registerCustomServiceInstance(token, customObject);
}

export function resetAllInjections(): void {
  InjectionContext.clearAll();
}

/**
 * Register a mock service in a specific scope (for test isolation)
 */
export function registerMockServiceScoped<T>(
  token: InjectionServiceClass<T>,
  customObject: Partial<T>,
  scope?: string
): void {
  InjectionContext.getRegistry(scope).registerCustomServiceInstance(
    token,
    customObject
  );
}

/**
 * Reset/destroy a specific scope (for test isolation)
 */
export function resetScopedInjections(scope: string): void {
  InjectionContext.destroyScope(scope);
}
