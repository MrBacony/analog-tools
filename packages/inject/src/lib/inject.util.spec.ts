import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  inject,
  registerService,
  registerServiceAsUndefined,
} from './inject.util';
import { getServiceRegistry, ServiceRegistry } from './service-registry';

describe('inject utility', () => {
  // Reset modules before each test to ensure clean state
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up to ensure tests don't affect each other
    const registry = new ServiceRegistry();
    registry.destroy();
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
      expect(service).toStrictEqual(mockService);
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
});
