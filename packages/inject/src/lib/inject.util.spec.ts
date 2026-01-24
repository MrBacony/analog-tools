import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  inject,
  registerService,
  registerServiceAsUndefined,
  InjectionError,
  CircularDependencyError,
  tryInject,
  hasService,
} from './inject.util';
import { getServiceRegistry, ServiceRegistry } from './service-registry';
import { resetAllInjections } from './inject.testing-util';
import { InjectionContext } from './injection-context';

describe('inject utility', () => {
  // Reset modules before each test to ensure clean state
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up to ensure tests don't affect each other
    resetAllInjections();
  });

  describe('registerService', () => {
    it('should create a service registry if it does not exist', () => {
      const serviceRegistry = getServiceRegistry();
      const serviceRegistryRegisterSpy = vi.spyOn(serviceRegistry, 'register');

      // Define a mock service
      class TestService {
        static INJECTABLE = true;
        constructor(public name = 'default') {}
      }

      // Register the service
      registerService(TestService, 'test');

      // Verify the registry was created and register was called
      expect(serviceRegistryRegisterSpy).toHaveBeenCalledWith(
        TestService,
        'test'
      );
    });

    it('should register a service with constructor parameters', () => {
      const serviceRegistry = getServiceRegistry();
      const serviceRegistryRegisterSpy = vi.spyOn(serviceRegistry, 'register');

      // Define a mock service with constructor parameters
      class TestServiceWithParams {
        static INJECTABLE = true;
        constructor(public id: number, public name: string) {}
      }

      // Register the service with parameters
      registerService(TestServiceWithParams, 1, 'test-service');

      // Verify the service was registered with the correct parameters
      expect(serviceRegistryRegisterSpy).toHaveBeenCalledWith(
        TestServiceWithParams,
        1,
        'test-service'
      );
    });
  });

  describe('inject', () => {
    // We'll use beforeEach to reset modules and setup mocks for each test
    let serviceRegistry: ServiceRegistry;
    // @ts-expect-error spyobject does not have type definitions
    let spyServiceRegistry;

    beforeEach(async () => {
      // Reset the modules to ensure clean state
      vi.resetModules();

      serviceRegistry = getServiceRegistry();
      spyServiceRegistry = {
        getService: vi.spyOn(serviceRegistry, 'getService'),
        register: vi.spyOn(serviceRegistry, 'register'),
        isServiceInjectable: vi.spyOn(serviceRegistry, 'isServiceInjectable'),
        registerCustomServiceInstance: vi.spyOn(
          serviceRegistry,
          'registerCustomServiceInstance'
        ),
        hasService: vi.spyOn(serviceRegistry, 'hasService'),
      };
    });

    it('should return the service from the registry', () => {
      // Define a mock service
      class TestService {
        static INJECTABLE = true;
        name = 'test';
      }
      const service = inject(TestService);

      // Verify the service was retrieved
      // @ts-expect-error spyServiceRegistry has type any
      expect(spyServiceRegistry.getService).toHaveBeenCalledWith(TestService);
      expect(service).toMatchObject({ name: 'test' });
      expect(service.name).toBe('test');
    });

    it('should throw an error when required service is not found', () => {
      // Define a mock service
      class MissingService {}

      // Attempt to inject the service should throw
      expect(() => inject(MissingService)).toThrow(InjectionError);
      expect(() => inject(MissingService)).toThrowError(
        `Service '${MissingService.name}' not found in registry and is required`
      );
    });

    it('should not throw an error when service is not required', () => {
      // Define a mock service
      class OptionalService {
        static INJECTABLE = true;
      }
      registerServiceAsUndefined(OptionalService);

      // Inject with required: false should not throw
      expect(() => inject(OptionalService, { required: false })).not.toThrow();
      expect(inject(OptionalService, { required: false })).toBeUndefined();
    });
  });

  describe('backward compatibility with scoped registry', () => {
    it('should work with existing inject/registerService API', () => {
      class BackwardCompatService {
        static INJECTABLE = true;
        value = 'works';
      }

      registerService(BackwardCompatService);
      const service = inject(BackwardCompatService);

      expect(service.value).toBe('works');
    });

    it('resetAllInjections should clear all scopes', () => {
      class ResetTestService {
        static INJECTABLE = true;
      }

      registerService(ResetTestService);
      expect(
        inject(ResetTestService, { required: false })
      ).toBeDefined();

      resetAllInjections();

      // After reset, all scopes are cleared including default
      // So getActiveScopes should be empty
      expect(InjectionContext.getActiveScopes()).toHaveLength(0);
    });

    it('getServiceRegistry should return default scope registry', () => {
      const registry = getServiceRegistry();
      expect(registry).toBeDefined();
      expect(registry.register).toBeDefined();
      expect(registry.getService).toBeDefined();
    });

    it('multiple calls to getServiceRegistry return same instance', () => {
      const registry1 = getServiceRegistry();
      const registry2 = getServiceRegistry();
      expect(registry1).toBe(registry2);
    });
  });

  describe('InjectionError', () => {
    it('should create an InjectionError with message and token', () => {
      class TestService {}
      const error = new InjectionError('Test error', TestService.name);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(InjectionError);
      expect(error.message).toBe('Test error');
      expect(error.token).toBe(TestService.name);
      expect(error.name).toBe('InjectionError');
    });

    it('should include cause in InjectionError', () => {
      const cause = new Error('Root cause');
      const error = new InjectionError('Wrapped error', 'TestService', cause);

      expect(error.cause).toBe(cause);
      expect(error.token).toBe('TestService');
    });

    it('should throw InjectionError with token context on invalid injection', () => {
      class InvalidService {}

      expect(() => inject(InvalidService)).toThrow(InjectionError);
      
      try {
        inject(InvalidService);
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(InjectionError);
        expect((error as InjectionError).token).toBe(InvalidService.name);
      }
    });
  });

  describe('CircularDependencyError', () => {
    it('should create a CircularDependencyError with dependency chain', () => {
      const chain = ['ServiceA', 'ServiceB', 'ServiceC', 'ServiceA'];
      const error = new CircularDependencyError(chain);

      expect(error).toBeInstanceOf(InjectionError);
      expect(error).toBeInstanceOf(CircularDependencyError);
      expect(error.message).toBe('Circular dependency detected: ServiceA -> ServiceB -> ServiceC -> ServiceA');
      expect(error.name).toBe('CircularDependencyError');
    });
  });

  describe('tryInject', () => {
    it('should return the service if available', () => {
      class TestService {
        static INJECTABLE = true;
        value = 'test';
      }

      registerService(TestService);
      const service = tryInject(TestService);

      expect(service).toBeDefined();
      expect(service?.value).toBe('test');
    });

    it('should return undefined if service is not available', () => {
      class MissingService {}

      const service = tryInject(MissingService);

      expect(service).toBeUndefined();
    });

    it('should never throw an error', () => {
      class UnavailableService {}

      expect(() => tryInject(UnavailableService)).not.toThrow();
      expect(tryInject(UnavailableService)).toBeUndefined();
    });
  });

  describe('hasService', () => {
    it('should return true if service is registered', () => {
      class RegisteredService {
        static INJECTABLE = true;
      }

      registerService(RegisteredService);
      expect(hasService(RegisteredService)).toBe(true);
    });

    it('should return false if service is not registered', () => {
      class UnregisteredService {}

      expect(hasService(UnregisteredService)).toBe(false);
    });

    it('should never throw an error', () => {
      class ServiceA {}
      class ServiceB {}

      expect(() => hasService(ServiceA)).not.toThrow();
      expect(() => hasService(ServiceB)).not.toThrow();
    });

    it('should return true for undefined services (key exists in registry even though value is undefined)', () => {
      class UndefinedService {
        static INJECTABLE = true;
      }

      registerServiceAsUndefined(UndefinedService);
      // Note: hasService returns true because the service key is registered in the map,
      // even though the value is undefined. To check if a service is actually available,
      // use inject() with required: false or tryInject()
      expect(hasService(UndefinedService)).toBe(true);
    });
  });
});
