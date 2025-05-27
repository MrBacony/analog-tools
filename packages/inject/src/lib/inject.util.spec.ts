import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { registerService } from './inject.util';
import { ServiceRegistry } from './service-registry';
import type { InjectionServiceClass } from './inject.util';

// Mock the ServiceRegistry
vi.mock('./service-registry', () => {
  const ServiceRegistry = vi.fn();
  ServiceRegistry.prototype.register = vi.fn();
  ServiceRegistry.prototype.getService = vi.fn();
  ServiceRegistry.prototype.hasService = vi.fn();
  ServiceRegistry.prototype.isServiceInjectable = vi.fn();
  ServiceRegistry.prototype.destroy = vi.fn();
  return { ServiceRegistry };
});

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
      // Define a mock service
      class TestService {
        static INJECTABLE = true;
        constructor(public name = 'default') {}
      }

      // Register the service
      registerService(TestService, 'test');

      // Verify the registry was created and register was called
      expect(ServiceRegistry).toHaveBeenCalled();
      expect(ServiceRegistry.prototype.register).toHaveBeenCalledWith(TestService, 'test');
    });

    it('should register a service with constructor parameters', () => {
      // Define a mock service with constructor parameters
      class TestServiceWithParams {
        static INJECTABLE = true;
        constructor(public id: number, public name: string) {}
      }

      // Register the service with parameters
      registerService(TestServiceWithParams, 1, 'test-service');

      // Verify the service was registered with the correct parameters
      expect(ServiceRegistry.prototype.register).toHaveBeenCalledWith(
        TestServiceWithParams,
        1,
        'test-service'
      );
    });
  });

  describe('inject', () => {
    // We'll use beforeEach to reset modules and setup mocks for each test
    let mockServiceRegistry: ReturnType<typeof vi.fn>;
    let injectFn: typeof import('./inject.util').inject;

    beforeEach(async () => {
      // Reset the modules to ensure clean state
      vi.resetModules();
      
      // Setup fresh mocks
      mockServiceRegistry = vi.fn();
      mockServiceRegistry.prototype.getService = vi.fn();
      mockServiceRegistry.prototype.register = vi.fn();
      mockServiceRegistry.prototype.hasService = vi.fn();
      mockServiceRegistry.prototype.isServiceInjectable = vi.fn();
      mockServiceRegistry.prototype.destroy = vi.fn();
      
      // Re-mock the ServiceRegistry
      vi.doMock('./service-registry', () => ({
        ServiceRegistry: mockServiceRegistry
      }));
      
      // Re-import inject to ensure we're working with a fresh instance
      const module = await import('./inject.util');
      injectFn = module.inject;
    });

    it('should create a service registry if it does not exist', () => {
      // Define a mock service
      class TestService {
        static INJECTABLE = true;
      }

      // Setup mock return value for getService
      mockServiceRegistry.prototype.getService.mockReturnValue(new TestService());

      // Inject the service
      injectFn(TestService);

      // Verify the registry was created
      expect(mockServiceRegistry).toHaveBeenCalled();
    });

    it('should return the service from the registry', () => {
      // Define a mock service
      class TestService {
        static INJECTABLE = true;
        name = 'test';
      }

      // Create mock service instance
      const mockService = new TestService();

      // Setup mock return value
      mockServiceRegistry.prototype.getService.mockReturnValue(mockService);

      // Inject the service
      const service = injectFn(TestService);

      // Verify the service was retrieved
      expect(mockServiceRegistry.prototype.getService).toHaveBeenCalledWith(TestService);
      expect(service).toBe(mockService);
      expect(service.name).toBe('test');
    });

    it('should throw an error when required service is not found', () => {
      // Define a mock service
      class MissingService {
        static INJECTABLE = true;
      }

      // Setup mock to return undefined (service not found)
      mockServiceRegistry.prototype.getService.mockReturnValue(undefined);

      // Attempt to inject the service should throw
      expect(() => injectFn(MissingService)).toThrowError(
        `Service with token ${MissingService || 'unknown'} not found in registry`
      );
    });

    it('should not throw an error when service is not required', () => {
      // Define a mock service
      class OptionalService {
        static INJECTABLE = true;
      }

      // Setup mock to return undefined (service not found)
      mockServiceRegistry.prototype.getService.mockReturnValue(undefined);

      // Inject with required: false should not throw
      expect(() => injectFn(OptionalService, { required: false })).not.toThrow();
      expect(injectFn(OptionalService, { required: false })).toBeUndefined();
    });
  });

  describe('integration tests', () => {
    // Reset modules to use real implementations, not mocks
    beforeEach(async () => {
      vi.resetModules();
      vi.doUnmock('./service-registry');
      
      // Re-import the modules to get fresh instances
      const injectionModule = await import('./inject.util');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { inject: injectFn, registerService: registerServiceFn } = injectionModule;
    });

    it('should register and inject a real service', async () => {
      // Re-import to get fresh instances
      const { inject, registerService } = await import('./inject.util');
      
      // Define a real service
      class RealService {
        static INJECTABLE = true;
        constructor(public value = 'default') {}
        
        getValue() {
          return this.value;
        }
      }
      
      // Register with a custom value
      registerService(RealService, 'custom-value');
      
      // Inject and verify
      const service = inject(RealService);
      expect(service).toBeInstanceOf(RealService);
      expect(service.getValue()).toBe('custom-value');
    });
    
    it('should auto-register injectable services', async () => {
      // Re-import to get fresh instances
      const { inject } = await import('./inject.util');
      const { ServiceRegistry } = await import('./service-registry');
      
      // Define an injectable service
      class AutoService {
        static INJECTABLE = true;
        getValue() {
          return 'auto';
        }
      }
      
      // Patch isServiceInjectable to return true
      const originalIsServiceInjectable = ServiceRegistry.prototype.isServiceInjectable;
      ServiceRegistry.prototype.isServiceInjectable = function() { return true; };
      
      try {
        // Inject without prior registration should auto-register
        const service = inject(AutoService);
        expect(service).toBeInstanceOf(AutoService);
        expect(service.getValue()).toBe('auto');
      } finally {
        // Restore original method
        ServiceRegistry.prototype.isServiceInjectable = originalIsServiceInjectable;
      }
    });
  });
});
