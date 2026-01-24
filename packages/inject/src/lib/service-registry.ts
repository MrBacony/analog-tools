import { InjectionServiceClass } from './inject.types';
import { InjectionContext } from './injection-context';

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
  private serviceMap: Map<string, unknown> = new Map();
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
      if (!this.hasService(token) || this.getService(token) === undefined) {
        if (properties === undefined || properties.length === 0) {
          this.serviceMap.set(this.getInjcectableName(token), new token());
          return;
        }
        this.serviceMap.set(
          this.getInjcectableName(token),
          new token(...properties)
        );
      }
    }
  }

  public registerAsUndefined<T>(token: InjectionServiceClass<T>): void {
    if (this.isServiceInjectable(token)) {
      this.serviceMap.set(this.getInjcectableName(token), undefined);
    } else {
      throw new Error(
        `Service with token ${this.getInjcectableName(
          token
        )} is not injectable. Ensure it has the INJECTABLE static property set to true.`
      );
    }
  }

  public registerCustomServiceInstance<T>(
    token: InjectionServiceClass<T>,
    customObject: Partial<T>
  ): void {
    if (this.isServiceInjectable(token)) {
      this.serviceMap.set(this.getInjcectableName(token), customObject);
    } else {
      throw new Error(
        `Service with token ${this.getInjcectableName(
          token
        )} is not injectable. Ensure it has the INJECTABLE static property set to true.`
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
      return this.serviceMap.get(this.getInjcectableName(token)) as
        | T
        | undefined;
    }
    return undefined;
  }

  /**
   * Check if a service is registered
   * @param token - The injection token for the service
   * @returns True if the service is registered
   */
  public hasService<T>(token: InjectionServiceClass<T>): boolean {
    return this.serviceMap.has(this.getInjcectableName(token));
  }

  /**
   * Check if a service class is injectable
   * @param token - The injection token for the service
   * @returns True if the service has the INJECTABLE static property set to true
   */
  public isServiceInjectable<T>(token: InjectionServiceClass<T>): boolean {
    const injectable = (token as unknown as { INJECTABLE?: boolean | string })
      .INJECTABLE;
    return injectable !== undefined && injectable !== false;
  }

  public getInjcectableName<T>(token: InjectionServiceClass<T>): string {
    if (this.isServiceInjectable(token)) {
      const injectable = (token as unknown as { INJECTABLE?: string | boolean })
        .INJECTABLE;
      if (typeof injectable !== 'string') {
        return token.name;
      }
      return injectable;
    }
    throw new Error(
      `Service with token ${token.name} is not injectable. Ensure it has the INJECTABLE static property set to true.`
    );
  }

  /**
   * Clean up all services when the game is being destroyed
   */
  public destroy(): void {
    this.serviceMap.clear();
  }
}
