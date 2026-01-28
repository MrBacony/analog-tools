import { InjectionServiceClass } from './inject.types';
import { InjectionContext } from './injection-context';
import { SERVICE_TOKEN } from './symbol-registry';
import { AsyncInjectableService } from './inject.types';
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
  private initializationPromises = new Map<symbol, Promise<void>>();
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
   * Ensure a service is async-initialized.
   * Returns existing promise if initialization is in progress.
   * 
   * Note on retry behavior: If initialization fails, the promise is removed from
   * the cache to allow retry on subsequent calls. All concurrent callers awaiting
   * the same failed promise will receive the rejection. A subsequent call to
   * ensureAsyncInitialized() will attempt initialization again.
   */
  private async ensureAsyncInitialized<T>(service: T, key: symbol): Promise<void> {
    // Check if already initialized or in progress
    if (this.initializationPromises.has(key)) {
      const initPromise = this.initializationPromises.get(key);
      if(initPromise) {
      return initPromise;
      }
    }

    // Check if service has async initialization
    const asyncService = service as AsyncInjectableService;
    if (typeof asyncService.initializeAsync !== 'function') {
      // No async init needed, cache empty resolved promise
      const resolved = Promise.resolve();
      this.initializationPromises.set(key, resolved);
      return resolved;
    }

    // Create and cache initialization promise
    const initPromise = asyncService.initializeAsync().catch((error) => {
      // Remove failed promise to allow retry
      this.initializationPromises.delete(key);
      throw error;
    });

    this.initializationPromises.set(key, initPromise);
    return initPromise;
  }

  /**
   * Get a service and ensure its async initialization is complete.
   */
  public async getServiceAsync<T>(token: InjectionServiceClass<T>): Promise<T | undefined> {
    const key = this.getServiceKey(token);

    if (!this.serviceMap.has(key)) {
      this.register(token);
    }

    const service = this.serviceMap.get(key) as T | undefined;
    if (service !== undefined) {
      await this.ensureAsyncInitialized(service, key);
    }
    return service;
  }

  /**
   * Register a service and eagerly initialize it.
   */
  public async registerAsync<T>(
    token: InjectionServiceClass<T>,
    ...properties: ConstructorParameters<InjectionServiceClass<T>>
  ): Promise<void> {
    const key = this.getServiceKey(token);

    if (!this.serviceMap.has(key) || this.serviceMap.get(key) === undefined) {
      this.register(token, ...properties);
    }

    const service = this.serviceMap.get(key) as T;
    await this.ensureAsyncInitialized(service, key);
  }

  /**
   * Clean up all services when the game is being destroyed
   */
  public destroy(): void {
    this.serviceMap.clear();
    this.initializingServices.clear();
    this.initializationPromises.clear();
  }
}
