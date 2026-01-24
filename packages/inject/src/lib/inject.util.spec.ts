import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  inject,
  registerService,
  registerServiceAsUndefined,
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

      // Create mock service instance
      const mockService = new TestService();

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

      // Setup mock to return undefined (service not found)

      // Attempt to inject the service should throw
      expect(() => inject(MissingService)).toThrowError(
        `Service with token ${
          MissingService || 'unknown'
        } not found in registry`
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
});
