import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as ServiceModule from './service-registry';
import { ServiceRegistry } from './service-registry';
import type { InjectionServiceClass } from './inject.types';

// Mock services for testing
class MockService {
  static INJECTABLE = true;
  public value = 'mock';
}

class MockServiceWithParams {
  static INJECTABLE = true;
  public value: string;

  constructor(value: string) {
    this.value = value;
  }
}

class NonInjectableService {
  static INJECTABLE = false;
  public value = 'non-injectable';
}

describe('getServiceRegistry', () => {
  it('should return an instance of ServiceRegistry', () => {
    const registry = ServiceModule.getServiceRegistry();
    expect(registry).toBeInstanceOf(ServiceRegistry);
  });

  it('should create a new ServiceRegistry if it does not exist', () => {
    const getServiceRegistrySpy = vi.spyOn(ServiceModule, 'getServiceRegistry');
    const registry = ServiceModule.getServiceRegistry();
    expect(getServiceRegistrySpy).toHaveBeenCalled();
    expect(registry).toBeInstanceOf(ServiceRegistry);
  });
});

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize correctly', () => {
    expect(registry).toBeInstanceOf(ServiceRegistry);
  });

  describe('register', () => {
    it('should register a service without parameters', () => {
      registry.register(MockService);
      expect(registry.hasService(MockService)).toBe(true);
    });

    it('should register a service with parameters', () => {
      const customValue = 'custom value';
      registry.register(MockServiceWithParams, customValue);

      const service = registry.getService(MockServiceWithParams);
      expect(service).toBeDefined();
      expect(service?.value).toBe(customValue);
    });
  });

  describe('registerAsUndefined', () => {
    it('should register a service as undefined', () => {
      registry.registerAsUndefined(MockService);
      expect(registry.hasService(MockService)).toBe(true);
      const service = registry.getService(MockService);
      expect(service).toBeUndefined();
    });

    it('should throw an error for non-injectable services', () => {
      expect(() => {
        registry.registerAsUndefined(NonInjectableService);
      }).toThrow(/not injectable/);
    });
  });

  describe('registerCustomServiceInstance', () => {
    it('should register a custom service instance', () => {
      const mockInstance = { value: 'custom mock' };
      registry.registerCustomServiceInstance(MockService, mockInstance);
      
      expect(registry.hasService(MockService)).toBe(true);
      const service = registry.getService(MockService);
      expect(service).toBe(mockInstance);
      expect(service?.value).toBe('custom mock');
    });

    it('should register a partial implementation of the service', () => {
      // Only implementing part of the service interface
      const partialMock = { value: 'partial implementation' };
      registry.registerCustomServiceInstance(MockService, partialMock);
      
      const service = registry.getService(MockService);
      expect(service).toBe(partialMock);
      expect(service?.value).toBe('partial implementation');
    });

    it('should throw an error for non-injectable services', () => {
      const mockInstance = { value: 'custom non-injectable' };
      expect(() => {
        registry.registerCustomServiceInstance(NonInjectableService, mockInstance);
      }).toThrow(/not injectable/);
    });
  });

  describe('getService', () => {
    it('should return undefined for non-injectable services', () => {
      const service = registry.getService(NonInjectableService);
      expect(service).toBeUndefined();
    });

    it('should auto-register and return injectable services', () => {
      // Service not registered yet
      expect(registry.hasService(MockService)).toBe(false);

      const service = registry.getService(MockService);

      // Service should be auto-registered
      expect(registry.hasService(MockService)).toBe(true);
      expect(service).toBeDefined();
      expect(service?.value).toBe('mock');
    });

    it('should return existing service if already registered', () => {
      registry.register(MockService);
      const service1 = registry.getService(MockService);
      const service2 = registry.getService(MockService);

      // Should be the same instance (singleton)
      expect(service1).toBe(service2);
    });
  });

  describe('hasService', () => {
    it('should return false for unregistered services', () => {
      expect(registry.hasService(MockService)).toBe(false);
    });

    it('should return true for registered services', () => {
      registry.register(MockService);
      expect(registry.hasService(MockService)).toBe(true);
    });
  });

  describe('isServiceInjectable', () => {
    it('should return true for injectable services', () => {
      expect(registry.isServiceInjectable(MockService)).toBe(true);
    });

    it('should return false for non-injectable services', () => {
      expect(registry.isServiceInjectable(NonInjectableService)).toBe(false);
    });

    it('should return false for services without INJECTABLE property', () => {
      class NoInjectablePropertyService {}
      expect(
        registry.isServiceInjectable(
          NoInjectablePropertyService as InjectionServiceClass<unknown>
        )
      ).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should remove all registered services', () => {
      registry.register(MockService);
      registry.register(MockServiceWithParams, 'test');

      expect(registry.hasService(MockService)).toBe(true);
      expect(registry.hasService(MockServiceWithParams)).toBe(true);

      registry.destroy();

      expect(registry.hasService(MockService)).toBe(false);
      expect(registry.hasService(MockServiceWithParams)).toBe(false);
    });
  });
});
