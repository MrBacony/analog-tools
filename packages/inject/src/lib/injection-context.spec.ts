import { describe, it, expect, afterEach } from 'vitest';
import {
  InjectionContext,
  injectScoped,
  registerServiceScoped,
  registerServiceAsUndefinedScoped,
} from './injection-context';
import { inject } from './inject.improved';

class TestService {
  static readonly INJECTABLE = true;

  constructor(public value = 'default') {}
}

class AnotherService {
  static readonly INJECTABLE = true;

  constructor(public name = 'default') {}
}

class NonInjectableService {
  // No INJECTABLE flag
}

class DatabaseService {
  static readonly INJECTABLE = true;

  constructor(public connectionString = 'default-connection') {}
}

class RepositoryWithGlobalInject {
  static readonly INJECTABLE = true;

  // NOTE: Uses global inject() - looks in DEFAULT scope, not TEST_SCOPE
  constructor(private db = inject(DatabaseService)) {}

  getDb() {
    return this.db;
  }
}

describe('InjectionContext', () => {
  afterEach(() => {
    InjectionContext.clearAll();
  });

  describe('getRegistry', () => {
    it('should create default scope registry on first access', () => {
      expect(InjectionContext.getRegistry()).toBeDefined();
    });

    it('should return same registry for same scope', () => {
      const registry1 = InjectionContext.getRegistry('test');
      const registry2 = InjectionContext.getRegistry('test');
      expect(registry1).toBe(registry2);
    });

    it('should return different registries for different scopes', () => {
      const registry1 = InjectionContext.getRegistry('scope1');
      const registry2 = InjectionContext.getRegistry('scope2');
      expect(registry1).not.toBe(registry2);
    });

    it('should create default scope when scope is undefined', () => {
      InjectionContext.getRegistry();
      expect(InjectionContext.getActiveScopes()).toContain('default');
    });
  });

  describe('createScope', () => {
    it('should create a new scope', () => {
      const registry = InjectionContext.createScope('new-scope');
      expect(registry).toBeDefined();
      expect(InjectionContext.getActiveScopes()).toContain('new-scope');
    });

    it('should throw if scope already exists', () => {
      InjectionContext.createScope('existing');
      expect(() => InjectionContext.createScope('existing')).toThrow(
        "Scope 'existing' already exists"
      );
    });

    it('should return a ServiceRegistry instance', () => {
      const registry = InjectionContext.createScope('test-scope');
      expect(registry).toBeDefined();
      expect(registry.hasService).toBeDefined();
      expect(registry.getService).toBeDefined();
    });
  });

  describe('destroyScope', () => {
    it('should remove scope and clear its services', () => {
      InjectionContext.createScope('temp');
      registerServiceScoped(TestService, 'temp');

      const serviceBefore = injectScoped(TestService, 'temp');
      expect(serviceBefore).toBeDefined();

      InjectionContext.destroyScope('temp');

      expect(InjectionContext.getActiveScopes()).not.toContain('temp');
    });

    it('should not throw for non-existent scope', () => {
      expect(() =>
        InjectionContext.destroyScope('non-existent')
      ).not.toThrow();
    });

    it('should be synchronous (not async)', () => {
      InjectionContext.createScope('sync-test');
      const result = InjectionContext.destroyScope('sync-test');
      expect(result).toBeUndefined();
    });
  });

  describe('clearAll', () => {
    it('should clear all scopes', () => {
      InjectionContext.createScope('scope1');
      InjectionContext.createScope('scope2');
      registerServiceScoped(TestService, 'scope1');
      registerServiceScoped(TestService, 'scope2');

      InjectionContext.clearAll();

      expect(InjectionContext.getActiveScopes()).toHaveLength(0);
    });

    it('should be synchronous (not async)', () => {
      InjectionContext.createScope('test1');
      const result = InjectionContext.clearAll();
      expect(result).toBeUndefined();
    });
  });

  describe('getActiveScopes', () => {
    it('should return empty array when no scopes exist', () => {
      expect(InjectionContext.getActiveScopes()).toEqual([]);
    });

    it('should return all active scopes', () => {
      InjectionContext.createScope('scope1');
      InjectionContext.createScope('scope2');
      InjectionContext.createScope('scope3');

      const scopes = InjectionContext.getActiveScopes();
      expect(scopes).toHaveLength(3);
      expect(scopes).toContain('scope1');
      expect(scopes).toContain('scope2');
      expect(scopes).toContain('scope3');
    });
  });

  describe('setDefaultScope', () => {
    it('should change the default scope', () => {
      registerServiceScoped(TestService, 'default', 'default-value');
      registerServiceScoped(TestService, 'custom', 'custom-value');

      InjectionContext.setDefaultScope('custom');

      const service = injectScoped(TestService);
      expect(service.value).toBe('custom-value');
    });

    afterEach(() => {
      // Reset to default
      InjectionContext.setDefaultScope('default');
    });
  });

  describe('scope isolation', () => {
    it('should isolate services between scopes', () => {
      registerServiceScoped(TestService, 'scope-a', 'value-a');
      registerServiceScoped(TestService, 'scope-b', 'value-b');

      const serviceA = injectScoped(TestService, 'scope-a');
      const serviceB = injectScoped(TestService, 'scope-b');

      expect(serviceA.value).toBe('value-a');
      expect(serviceB.value).toBe('value-b');
    });

    it('should not find service from other scope', () => {
      registerServiceScoped(TestService, 'scope-a');

      // Note: injectScoped will auto-register TestService in scope-b
      // if called with required=true. To verify isolation, we need to
      // check that the service values are different (auto-registered vs. registered)
      const serviceA = injectScoped(TestService, 'scope-a');
      const serviceB = injectScoped(TestService, 'scope-b');

      // Both are defined but should be different instances
      expect(serviceA).toBeDefined();
      expect(serviceB).toBeDefined();
      expect(serviceA).not.toBe(serviceB);
    });

    it('should support multiple services per scope', () => {
      registerServiceScoped(TestService, 'test', 'test-value');
      registerServiceScoped(AnotherService, 'test', 'another-name');

      const service1 = injectScoped(TestService, 'test');
      const service2 = injectScoped(AnotherService, 'test');

      expect(service1.value).toBe('test-value');
      expect(service2.name).toBe('another-name');
    });

    it('should allow same service name in different scopes', () => {
      registerServiceScoped(TestService, 'scope1', 'scope1-value');
      registerServiceScoped(TestService, 'scope2', 'scope2-value');

      const s1 = injectScoped(TestService, 'scope1');
      const s2 = injectScoped(TestService, 'scope2');

      expect(s1).not.toBe(s2);
      expect(s1.value).toBe('scope1-value');
      expect(s2.value).toBe('scope2-value');
    });

    it('should return same instance within a scope', () => {
      registerServiceScoped(TestService, 'scope-a');

      const service1 = injectScoped(TestService, 'scope-a');
      const service2 = injectScoped(TestService, 'scope-a');

      expect(service1).toBe(service2);
    });
  });
});

describe('injectScoped', () => {
  afterEach(() => {
    InjectionContext.clearAll();
  });

  it('should inject service from specified scope', () => {
    registerServiceScoped(TestService, 'test-scope', 'test-value');
    const service = injectScoped(TestService, 'test-scope');
    expect(service.value).toBe('test-value');
  });

  it('should auto-register missing service', () => {
    // When a service is not registered, getService auto-registers it
    const service = injectScoped(TestService, 'empty-scope');
    expect(service).toBeDefined();
    expect(service.value).toBe('default');
  });

  it('should return service even when optional (ServiceRegistry auto-registers)', () => {
    // Note: Since ServiceRegistry.getService() auto-registers on access,
    // optional still returns the auto-registered instance
    const service = injectScoped(TestService, 'empty-scope', {
      required: false,
    });
    expect(service).toBeDefined();
    expect(service.value).toBe('default');
  });

  it('should auto-register service in scope if not present', () => {
    const service = injectScoped(TestService, 'auto-register');
    expect(service).toBeDefined();
    expect(service.value).toBe('default');
  });

  it('should use default scope when scope is not specified', () => {
    registerServiceScoped(TestService, 'default', 'default-value');
    const service = injectScoped(TestService);
    expect(service.value).toBe('default-value');
  });

  it('should throw for non-injectable services', () => {
    expect(() =>
      injectScoped(
        NonInjectableService as unknown as typeof TestService,
        'test'
      )
    ).toThrow();
  });

  it('should handle optional missing service with required: false', () => {
    // Only return undefined if explicitly registered as undefined
    registerServiceAsUndefinedScoped(TestService, 'empty-scope');
    const service = injectScoped(TestService, 'empty-scope', {
      required: false,
    });
    expect(service).toBeUndefined();
  });

  it('should return undefined for service registered as undefined', () => {
    registerServiceAsUndefinedScoped(TestService, 'test-scope');
    const service = injectScoped(TestService, 'test-scope', {
      required: false,
    });
    expect(service).toBeUndefined();
  });
});

describe('registerServiceScoped', () => {
  afterEach(() => {
    InjectionContext.clearAll();
  });

  it('should register service with no arguments', () => {
    registerServiceScoped(TestService, 'test-scope');
    const service = injectScoped(TestService, 'test-scope');
    expect(service).toBeDefined();
    expect(service.value).toBe('default');
  });

  it('should register service with constructor arguments', () => {
    registerServiceScoped(TestService, 'test-scope', 'custom-value');
    const service = injectScoped(TestService, 'test-scope');
    expect(service.value).toBe('custom-value');
  });

  it('should create scope if it does not exist', () => {
    registerServiceScoped(TestService, 'auto-create-scope');
    expect(InjectionContext.getActiveScopes()).toContain(
      'auto-create-scope'
    );
  });

  it('should be idempotent - first registration wins', () => {
    registerServiceScoped(TestService, 'test-scope', 'first-value');
    registerServiceScoped(TestService, 'test-scope', 'second-value');

    const service = injectScoped(TestService, 'test-scope');
    expect(service.value).toBe('first-value');
  });

  it('should register different services in same scope', () => {
    registerServiceScoped(TestService, 'test-scope', 'test');
    registerServiceScoped(AnotherService, 'test-scope', 'another');

    const s1 = injectScoped(TestService, 'test-scope');
    const s2 = injectScoped(AnotherService, 'test-scope');

    expect(s1.value).toBe('test');
    expect(s2.name).toBe('another');
  });
});

describe('registerServiceAsUndefinedScoped', () => {
  afterEach(() => {
    InjectionContext.clearAll();
  });

  it('should register service as undefined', () => {
    registerServiceAsUndefinedScoped(TestService, 'test-scope');
    const service = injectScoped(TestService, 'test-scope', {
      required: false,
    });
    expect(service).toBeUndefined();
  });

  it('should throw when required: true and service is undefined', () => {
    registerServiceAsUndefinedScoped(TestService, 'test-scope');
    expect(() => injectScoped(TestService, 'test-scope')).toThrow();
  });

  it('should create scope if it does not exist', () => {
    registerServiceAsUndefinedScoped(TestService, 'new-scope');
    expect(InjectionContext.getActiveScopes()).toContain('new-scope');
  });
});

describe('backward compatibility with default scope', () => {
  afterEach(() => {
    InjectionContext.clearAll();
  });

  it('should work with scoped functions using default scope', () => {
    registerServiceScoped(TestService, 'default', 'default-value');
    const service = injectScoped(TestService);
    expect(service.value).toBe('default-value');
  });

  it('should allow mixing scoped and non-scoped registrations', () => {
    registerServiceScoped(TestService, 'default', 'default-value');
    registerServiceScoped(AnotherService, 'custom', 'custom-name');

    const defaultService = injectScoped(TestService);
    const customService = injectScoped(AnotherService, 'custom');

    expect(defaultService.value).toBe('default-value');
    expect(customService.name).toBe('custom-name');
  });
});

describe('scope mismatch - inject() vs injectScoped()', () => {
  const TEST_SCOPE = 'test-scope-isolation';

  afterEach(() => {
    InjectionContext.clearAll();
  });

  it('should demonstrate scope mismatch when service uses global inject()', () => {
    // Register DatabaseService in TEST_SCOPE with a test connection string
    registerServiceScoped(DatabaseService, TEST_SCOPE, 'test://connection');

    // Get repository from TEST_SCOPE
    const repo = injectScoped(RepositoryWithGlobalInject, TEST_SCOPE);

    // ISSUE: repo.getDb() returns a DatabaseService from DEFAULT scope,
    // not from TEST_SCOPE, because the constructor uses inject() which looks
    // in the global default scope. Since DatabaseService isn't in default scope,
    // it gets auto-registered with the no-arg constructor.
    const db = repo.getDb();
    expect(db.connectionString).toBe('default-connection');
    // ^^^ This is NOT 'test://connection' because inject() looks in default scope
  });

  it('should allow services to work correctly when dependencies are in both scopes', () => {
    // Register DatabaseService in BOTH scopes
    registerServiceScoped(DatabaseService, TEST_SCOPE, 'test://connection');
    registerServiceScoped(DatabaseService, 'default', 'test://connection');

    const repo = injectScoped(RepositoryWithGlobalInject, TEST_SCOPE);
    const db = repo.getDb();

    // Now it works because the dependency is available in both scopes
    expect(db.connectionString).toBe('test://connection');
  });

  it('should document: scoped injection is scope-only and does not inherit', () => {
    // This test documents the design: each scope is independent
    registerServiceScoped(DatabaseService, TEST_SCOPE, 'test://connection');
    // DatabaseService NOT registered in default scope

    const repo = injectScoped(RepositoryWithGlobalInject, TEST_SCOPE);
    const db = repo.getDb();

    // The repository's constructor runs inject(DatabaseService)
    // which creates a new instance in the default scope, not reusing
    // the one from TEST_SCOPE. Services do not inherit or fall back
    // across scopes.
    expect(db.connectionString).toBe('default-connection');
  });
});
