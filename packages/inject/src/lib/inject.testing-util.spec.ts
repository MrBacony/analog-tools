import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerMockService, resetAllInjections } from './inject.testing-util';
import * as serviceRegistryModule from './service-registry';
import { ServiceRegistry } from './service-registry';

describe('inject.testing-util', () => {
  let mockServiceRegistry: {
    registerCustomServiceInstance: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };

  // Setup mock service class
  class MockService {
    static INJECTABLE = true;
    doSomething(): string {
      return 'original implementation';
    }
  }

  beforeEach(() => {
    // Create a mock service registry with spy methods
    mockServiceRegistry = {
      registerCustomServiceInstance: vi.fn(),
      destroy: vi.fn()
    };

    // Mock the getServiceRegistry function to return our mock
    vi.spyOn(serviceRegistryModule, 'getServiceRegistry').mockReturnValue(
      mockServiceRegistry as unknown as ServiceRegistry
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerMockService', () => {
    it('should call registerCustomServiceInstance on the service registry', () => {
      // Arrange
      const mockObject = { doSomething: vi.fn().mockReturnValue('mocked implementation') };
      
      // Act
      registerMockService(MockService, mockObject);
      
      // Assert
      expect(serviceRegistryModule.getServiceRegistry).toHaveBeenCalled();
      expect(mockServiceRegistry.registerCustomServiceInstance).toHaveBeenCalledWith(
        MockService, 
        mockObject
      );
    });
  });

  describe('resetAllInjections', () => {
    it('should call destroy on the service registry', () => {
      // Act
      resetAllInjections();
      
      // Assert
      expect(serviceRegistryModule.getServiceRegistry).toHaveBeenCalled();
      expect(mockServiceRegistry.destroy).toHaveBeenCalled();
    });
  });
});
