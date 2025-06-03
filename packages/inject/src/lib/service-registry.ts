import { InjectionServiceClass } from './inject.types';

/**
 * Service injection options
 */

export let _serviceRegistry: ServiceRegistry | null = null;
export function getServiceRegistry(): ServiceRegistry {
  if (!_serviceRegistry) {
    _serviceRegistry = new ServiceRegistry();
  }
  return _serviceRegistry;
}

/**
 * Service registry that provides access to all service singletons.
 * Implements the singleton pattern for central service management.
 */
export class ServiceRegistry {
  private serviceMap: Map<InjectionServiceClass<unknown>, unknown> = new Map();
  /**
   * Register a service with a token
   * @param token - The injection token for the service
   * @param properties - The constructor parameters for the service class
   */
  public register<T>(
    token: InjectionServiceClass<T>,
    ...properties: ConstructorParameters<InjectionServiceClass<T>>
  ): void {
    if (this.isServiceInjectable(token)) {
      if (
        !this.serviceMap.has(token) ||
        this.serviceMap.get(token) === undefined
      ) {
        if (properties === undefined || properties.length === 0) {
          this.serviceMap.set(token, new token());
          return;
        }

        this.serviceMap.set(token, new token(...properties));
      }
    }
  }

  public registerAsUndefined<T>(token: InjectionServiceClass<T>): void {
    if (this.isServiceInjectable(token)) {
      this.serviceMap.set(token, undefined);
    } else {
      throw new Error(
        `Service with token ${token.name} is not injectable. Ensure it has the INJECTABLE static property set to true.`
      );
    }
  }

  public registerCustomServiceInstance<T>(
    token: InjectionServiceClass<T>,
    customObject: Partial<T>
  ): void {
    if (this.isServiceInjectable(token)) {
      this.serviceMap.set(token, customObject);
    } else {
      throw new Error(
        `Service with token ${token.name} is not injectable. Ensure it has the INJECTABLE static property set to true.`
      );
    }
  }

  /**
   * Get a service by its token
   * @param token - The injection token for the service
   * @returns The requested service or undefined if not found
   */
  public getService<T>(token: InjectionServiceClass<T>): T | undefined {
    if (this.isServiceInjectable(token)) {
      if (!this.hasService(token)) {
        this.register(token);
      }
      return this.serviceMap.get(token) as T | undefined;
    }
    return undefined;
  }

  /**
   * Check if a service is registered
   * @param token - The injection token for the service
   * @returns True if the service is registered
   */
  public hasService<T>(token: InjectionServiceClass<T>): boolean {
    return this.serviceMap.has(token);
  }

  /**
   * Check if a service class is injectable
   * @param token - The injection token for the service
   * @returns True if the service has the INJECTABLE static property set to true
   */
  public isServiceInjectable<T>(token: InjectionServiceClass<T>): boolean {
    const injectable = (token as unknown as { INJECTABLE?: boolean })
      .INJECTABLE;
    return injectable !== undefined && injectable;
  }
  /**
   * Clean up all services when the game is being destroyed
   */
  public destroy(): void {
    this.serviceMap.clear();
  }
}
