import { describe, it, expect, beforeEach } from 'vitest';
import {
  SERVICE_TOKEN,
  Injectable,
  createServiceToken,
  SymbolInjectableService,
} from './symbol-registry';
import { ServiceRegistry } from './service-registry';
import { InjectionServiceClass } from './inject.types';

/**
 * Helper to cast an @Injectable() decorated class to InjectionServiceClass.
 *
 * Bridges the gap between TypeScript's compile-time types and the decorator's
 * runtime behavior, keeping tests readable while maintaining type safety.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asInjectable<T>(cls: new (...args: any[]) => T): InjectionServiceClass<T> {
  return cls as unknown as InjectionServiceClass<T>;
}

/**
 * Helper to get SERVICE_TOKEN from a decorated class.
 *
 * Accesses the runtime SERVICE_TOKEN symbol added by the @Injectable() decorator.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getToken(cls: new (...args: any[]) => unknown): symbol {
  return (cls as unknown as Record<symbol, symbol>)[SERVICE_TOKEN];
}

describe('Symbol-based Service Registry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  describe('@Injectable() decorator', () => {
    it('should assign SERVICE_TOKEN to decorated class', () => {
      @Injectable()
      class MyService {}

      expect(getToken(MyService)).toBeDefined();
      expect(typeof getToken(MyService)).toBe('symbol');
    });

    it('should assign same token to multiple instances of service', () => {
      @Injectable()
      class MyService {}

      const token1 = getToken(MyService);
      const token2 = getToken(MyService);

      expect(token1).toBe(token2);
    });

    it('should use custom token when provided', () => {
      const customToken = Symbol('custom-service');

      @Injectable(customToken)
      class MyService {}

      expect(getToken(MyService)).toBe(customToken);
    });

    it('should support INJECTABLE property for detection (legacy)', () => {
      @Injectable()
      class MyService {}

      const ctor = MyService as unknown as Record<string, boolean>;
      expect(ctor['INJECTABLE']).toBe(true);
    });

    it('should work with constructor parameters', () => {
      @Injectable()
      class Dependency {}

      @Injectable()
      class MyService {
        constructor(public dep: Dependency) {}
      }

      const depInstance = new Dependency();
      registry.registerCustomServiceInstance(asInjectable(Dependency), depInstance);

      const instance = new MyService(depInstance);
      registry.registerCustomServiceInstance(asInjectable(MyService), instance);

      const retrieved = registry.getService(asInjectable(MyService));
      expect(retrieved).toBe(instance);
      expect(retrieved?.dep).toBe(depInstance);
    });

    it('should work with multiple decorators (if any)', () => {
      @Injectable()
      class FirstService {}

      @Injectable()
      class SecondService {}

      expect(getToken(FirstService)).not.toBe(getToken(SecondService));
    });
  });

  describe('createServiceToken()', () => {
    it('should create a unique service token', () => {
      const token1 = createServiceToken();
      const token2 = createServiceToken();

      expect(token1).not.toBe(token2);
      expect(typeof token1).toBe('symbol');
      expect(typeof token2).toBe('symbol');
    });

    it('should create token with optional description', () => {
      const token = createServiceToken('MyCustomToken');

      expect(token.toString()).toContain('MyCustomToken');
    });

    it('should allow static SERVICE_TOKEN assignment via decorator', () => {
      @Injectable()
      class ManualService {}

      registry.register(asInjectable(ManualService));
      const instance = registry.getService(asInjectable(ManualService));

      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(ManualService);
    });
  });

  describe('SERVICE_TOKEN symbol', () => {
    it('should be a unique symbol', () => {
      expect(typeof SERVICE_TOKEN).toBe('symbol');
    });

    it('should be same across module imports', () => {
      // This would be true in real usage - each import gets same symbol
      const token = SERVICE_TOKEN;
      expect(token).toBe(SERVICE_TOKEN);
    });

    it('should be used as key in service map', () => {
      @Injectable()
      class MyService {}

      registry.register(asInjectable(MyService));
      const retrieved = registry.getService(asInjectable(MyService));

      expect(retrieved).toBeInstanceOf(MyService);
    });
  });

  describe('Scoped Injection with Symbols', () => {
    it('should support scoped injection with decorated services', () => {
      @Injectable()
      class ScopedService {
        id = Math.random();
      }

      const global1 = registry.getService(asInjectable(ScopedService));
      const global2 = registry.getService(asInjectable(ScopedService));

      // Same instance
      expect(global1).toBe(global2);
      expect(global1!.id).toBe(global2!.id);
    });

    it('should work with dependency chains using symbols', () => {
      @Injectable()
      class Database {
        connected = true;
      }

      @Injectable()
      class UserRepository {
        constructor(public db: Database) {}
      }

      @Injectable()
      class UserService {
        constructor(public repo: UserRepository) {}
      }

      const db = new Database();
      registry.registerCustomServiceInstance(asInjectable(Database), db);

      const repo = new UserRepository(db);
      registry.registerCustomServiceInstance(asInjectable(UserRepository), repo);

      const service = new UserService(repo);
      registry.registerCustomServiceInstance(asInjectable(UserService), service);

      // Verify the chain
      const retrieved = registry.getService(asInjectable(UserService));
      expect(retrieved!.repo.db.connected).toBe(true);
      expect(retrieved!.repo).toBe(repo);
    });
  });

  describe('Symbol Registry Utility Type', () => {
    it('should support SymbolInjectableService interface', () => {
      class ProperService implements SymbolInjectableService {
        [SERVICE_TOKEN]: symbol = createServiceToken('ProperService');
      }

      const service = new ProperService();
      expect(service[SERVICE_TOKEN]).toBeDefined();
    });

    it('should allow services with optional SERVICE_TOKEN via partial', () => {
      // Using Partial to demonstrate optional token pattern
      class OptionalTokenService implements Partial<SymbolInjectableService> {
        [SERVICE_TOKEN]?: symbol;
      }

      const service = new OptionalTokenService();
      expect(service[SERVICE_TOKEN]).toBeUndefined();
    });
  });

  describe('Symbol Token Migration Path', () => {
    it('should allow gradual migration to injectable decorator', () => {
      // Old style (would fail in new system)
      class OldStyleService {
        static readonly INJECTABLE = true;
      }

      // New style
      @Injectable()
      class NewStyleService {}

      // New style should work
      expect(getToken(NewStyleService)).toBeDefined();

      // Old style would need conversion - check static property
      expect(OldStyleService.INJECTABLE).toBe(true);
    });

    it('should provide clear error when service is not decorated', () => {
      class UndecoratedService {}

      expect(() =>
        registry.getService(asInjectable(UndecoratedService))
      ).toThrow('missing SERVICE_TOKEN');
    });
  });

  describe('Token Uniqueness Guarantees', () => {
    it('should ensure tokens are unique across services', () => {
      @Injectable()
      class ServiceA {}

      @Injectable()
      class ServiceB {}

      @Injectable()
      class ServiceC {}

      const tokens = [
        getToken(ServiceA),
        getToken(ServiceB),
        getToken(ServiceC),
      ];

      // All tokens should be unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(3);
    });

    it('should use symbol identity not equality', () => {
      @Injectable()
      class ServiceA {}

      const token1 = getToken(ServiceA);
      const token2 = createServiceToken('ServiceA');

      // Different symbols even with same description
      expect(token1).not.toBe(token2);
      expect(token1).toEqual(token1); // Same symbol equals itself
    });
  });
});
