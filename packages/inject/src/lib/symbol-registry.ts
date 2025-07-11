/**
 * Symbol-based service discovery to prevent minification issues
 */

// Service token symbol for unique identification
export const SERVICE_TOKEN = Symbol('SERVICE_TOKEN');

/**
 * Enhanced injectable service interface with symbol-based tokens
 */
export interface SymbolInjectableService {
  [SERVICE_TOKEN]: symbol;
}

/**
 * Create a unique service token
 */
export function createServiceToken(name?: string): symbol {
  return Symbol(name || 'ServiceToken');
}

/**
 * Service token registry for mapping classes to symbols
 */
class ServiceTokenRegistry {
  // eslint-disable-next-line @typescript-eslint/ban-types
  private static tokens = new WeakMap<Function, symbol>();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static getToken<T>(serviceClass: new (...args: any[]) => T): symbol {
    if (!this.tokens.has(serviceClass)) {
      const token = createServiceToken(serviceClass.name);
      this.tokens.set(serviceClass, token);
    }
    const result = this.tokens.get(serviceClass);
    if (!result) {
      throw new Error(`Failed to get token for service ${serviceClass.name}`);
    }
    return result;
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static setToken<T>(serviceClass: new (...args: any[]) => T, token: symbol): void {
    this.tokens.set(serviceClass, token);
  }
}

/**
 * Decorator for marking services as injectable with automatic token generation
 */
export function Injectable<T extends new (...args: any[]) => any>(
  token?: symbol
): (target: T) => T {
  return (target: T) => {
    const serviceToken = token || ServiceTokenRegistry.getToken(target);
    ServiceTokenRegistry.setToken(target, serviceToken);
    
    // Add static properties for backward compatibility
    (target as any).INJECTABLE = true;
    (target as any)[SERVICE_TOKEN] = serviceToken;
    
    return target;
  };
}

/**
 * Enhanced service registry using symbols
 */
export class SymbolServiceRegistry {
  private serviceMap = new Map<symbol, unknown>();
  private initializingServices = new Set<symbol>();
  
  /**
   * Register a service with symbol-based token
   */
  register<T>(
    serviceClass: new (...args: any[]) => T,
    ...args: ConstructorParameters<new (...args: any[]) => T>
  ): void {
    const token = ServiceTokenRegistry.getToken(serviceClass);
    
    if (this.initializingServices.has(token)) {
      throw new CircularDependencyError([serviceClass.name]);
    }
    
    if (!this.serviceMap.has(token)) {
      this.initializingServices.add(token);
      try {
        const instance = new serviceClass(...args);
        this.serviceMap.set(token, instance);
      } finally {
        this.initializingServices.delete(token);
      }
    }
  }
  
  /**
   * Get service by class
   */
  getService<T>(serviceClass: new (...args: any[]) => T): T | undefined {
    const token = ServiceTokenRegistry.getToken(serviceClass);
    return this.serviceMap.get(token) as T | undefined;
  }
  
  /**
   * Check if service exists
   */
  hasService<T>(serviceClass: new (...args: any[]) => T): boolean {
    const token = ServiceTokenRegistry.getToken(serviceClass);
    return this.serviceMap.has(token);
  }
  
  /**
   * Remove service
   */
  removeService<T>(serviceClass: new (...args: any[]) => T): boolean {
    const token = ServiceTokenRegistry.getToken(serviceClass);
    return this.serviceMap.delete(token);
  }
  
  /**
   * Clear all services
   */
  clear(): void {
    this.serviceMap.clear();
    this.initializingServices.clear();
  }
}

/**
 * Import circular dependency error from improved inject
 */
class CircularDependencyError extends Error {
  constructor(dependencyChain: string[]) {
    super(`Circular dependency detected: ${dependencyChain.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}
