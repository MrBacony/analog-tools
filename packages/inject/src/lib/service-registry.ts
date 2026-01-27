import { InjectionServiceClass } from './inject.types';
import { InjectionContext } from './injection-context';
import { SERVICE_TOKEN } from './symbol-registry';
import { CircularDependencyError, MissingServiceTokenError } from './inject.util';

/**
 * Service injection options
 */

export function getServiceRegistry(): ServiceRegistry {
  return InjectionContext.getRegistry();
}

/**
 * Service registry that provides access to all service singletons.
 * Implements the singleton pattern for central service management.
 */
export class ServiceRegistry {
  private serviceMap: Map<symbol, unknown> = new Map();
  private initializingServices = new Set<symbol>();
  /**
   * Resolve the symbol token for a service class.
   * Throws MissingServiceTokenError if SERVICE_TOKEN is not present.
   */
  private getServiceKey<T>(token: InjectionServiceClass<T>): symbol {
    const serviceToken = (token as unknown as Record<symbol, symbol>)[SERVICE_TOKEN];
    if (!serviceToken) {
      throw new MissingServiceTokenError(token.name);
    }
    return serviceToken;
  }

  /**
   * Register a service with a token
   * @param token - The injection token for the service
   * @param properties - The constructor parameters for the service class
   */
  public register<T>(
    token: InjectionServiceClass<T>,
    ...properties: ConstructorParameters<InjectionServiceClass<T>>
  ): void {
    const key = this.getServiceKey(token);

    if (this.initializingServices.has(key)) {
      throw new CircularDependencyError([token.name]);
    }

    if (!this.serviceMap.has(key) || this.serviceMap.get(key) === undefined) {
      this.initializingServices.add(key);
      try {
        const instance =
          properties.length === 0 ? new token() : new token(...properties);
        this.serviceMap.set(key, instance);
      } finally {
        this.initializingServices.delete(key);
      }
    }
  }

  public registerAsUndefined<T>(token: InjectionServiceClass<T>): void {
    const key = this.getServiceKey(token);
    this.serviceMap.set(key, undefined);
  }

  public registerCustomServiceInstance<T>(
    token: InjectionServiceClass<T>,
    customObject: Partial<T>
  ): void {
    const key = this.getServiceKey(token);
    this.serviceMap.set(key, customObject);
  }

  /**
   * Get a service by its token
   * @param token - The injection token for the service
   * @returns The requested service or undefined if not found
   */
  public getService<T>(token: InjectionServiceClass<T>): T | undefined {
    const key = this.getServiceKey(token);
    if (!this.serviceMap.has(key)) {
      this.register(token);
    }
    return this.serviceMap.get(key) as T | undefined;
  }

  /**
   * Check if a service is registered
   * @param token - The injection token for the service
   * @returns True if the service is registered
   */
  public hasService<T>(token: InjectionServiceClass<T>): boolean {
    const key = this.getServiceKey(token);
    return this.serviceMap.has(key);
  }

  /**
   * Clean up all services when the game is being destroyed
   */
  public destroy(): void {
    this.serviceMap.clear();
  }
}
