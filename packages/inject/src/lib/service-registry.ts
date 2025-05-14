import { InjectionServiceClass } from './inject.util';

/**
 * Service registry that provides access to all service singletons.
 * Implements the singleton pattern for central service management.
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry;

  private serviceMap: Map<InjectionServiceClass<unknown>, unknown> = new Map();

  /**
   * Private constructor to prevent direct instantiation
   */
  private constructor() {
    // Initialize services in the correct dependency order
    console.log('Service registry initialized');
  }

  /**
   * Initialize the ServiceRegistry singleton
   * @returns The ServiceRegistry instance
   */
  public static initialize(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Get the ServiceRegistry instance
   * @throws Error if the registry hasn't been initialized
   * @returns The ServiceRegistry instance
   */
  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      throw new Error(
        'ServiceRegistry not initialized. Call initialize() first.'
      );
    }
    return ServiceRegistry.instance;
  }

  /**
   * Register a service with a token
   * @param token - The injection token for the service
   * @param service - The service instance
   */
  public register<T>(
    token: InjectionServiceClass<T>,
    ...properties: unknown[]
  ): void {
    if (properties === undefined) {
      this.serviceMap.set(token, new token());
      return;
    }

    this.serviceMap.set(token, new token(...properties));
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
    return (token as unknown as { INJECTABLE?: boolean }).INJECTABLE === true;
  }
  /**
   * Clean up all services when the game is being destroyed
   */
  public destroy(): void {
    this.serviceMap.clear();
  }
}
