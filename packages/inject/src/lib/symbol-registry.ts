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
  private static tokens = new WeakMap<object, symbol>();
  
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
