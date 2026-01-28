import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceRegistry, getServiceRegistry } from '../service-registry';
import { InjectionContext } from '../injection-context';
import { Injectable } from '../symbol-registry';
import {
  AggregateDestructionError,
  destroyAllServicesAsync,
  registerAsync,
} from '../inject.util';
import type { AsyncInjectableService } from '../inject.types';

// Mock services for testing

@Injectable()
class CleanupService implements AsyncInjectableService {
  public destroyed = false;
  public initializationCount = 0;

  async initializeAsync(): Promise<void> {
    this.initializationCount++;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  async onDestroy(): Promise<void> {
    this.destroyed = true;
  }
}

@Injectable()
class ErrorCleanupService implements AsyncInjectableService {
  public destroyed = false;

  async initializeAsync(): Promise<void> {
    // No-op
  }

  async onDestroy(): Promise<void> {
    this.destroyed = true;
    throw new Error('Cleanup failed');
  }
}

@Injectable()
class SyncOnlyService {
  public value = 'sync-only';
}

@Injectable()
class SlowCleanupService implements AsyncInjectableService {
  public destroyed = false;

  async initializeAsync(): Promise<void> {
    // No-op
  }

  async onDestroy(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 30));
    this.destroyed = true;
  }
}

@Injectable()
class TimerService implements AsyncInjectableService {
  public timers: NodeJS.Timeout[] = [];
  public cleaned = false;

  async initializeAsync(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this.timers.push(setInterval(() => {}, 100));
  }

  async onDestroy(): Promise<void> {
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers = [];
    this.cleaned = true;
  }
}

describe('Async Service Destruction Lifecycle', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Destruction Basics', () => {
    it('should call onDestroy() during destroyAsync()', async () => {
      await registry.registerAsync(CleanupService);
      const service = await registry.getServiceAsync(CleanupService);
      if (!service) throw new Error('Service not defined');

      expect(service.destroyed).toBe(false);
      await registry.destroyAsync();
      expect(service.destroyed).toBe(true);
    });

    it('should handle services without onDestroy() method', async () => {
      await registry.registerAsync(SyncOnlyService);
      await expect(registry.destroyAsync()).resolves.not.toThrow();
    });

    it('should skip uninitialized services', async () => {
      registry.register(CleanupService);
      const service = registry.getService(CleanupService);
      if (!service) throw new Error('Service not defined');

      await registry.destroyAsync();
      // Uninitialized service shouldn't have onDestroy called
      expect(service.destroyed).toBe(false);
    });

    it('should not call lifecycle hooks with sync destroy()', async () => {
      await registry.registerAsync(CleanupService);
      const service = await registry.getServiceAsync(CleanupService);
      if (!service) throw new Error('Service not defined');

      registry.destroy();
      expect(service.destroyed).toBe(false);
    });

    it('should destroy services in natural iteration order', async () => {
      const destroyOrder: string[] = [];

      @Injectable()
      class Service1 implements AsyncInjectableService {
        async onDestroy() {
          destroyOrder.push('service1');
        }
      }

      @Injectable()
      class Service2 implements AsyncInjectableService {
        async onDestroy() {
          destroyOrder.push('service2');
        }
      }

      @Injectable()
      class Service3 implements AsyncInjectableService {
        async onDestroy() {
          destroyOrder.push('service3');
        }
      }

      await registry.registerAsync(Service1);
      await registry.registerAsync(Service2);
      await registry.registerAsync(Service3);

      await registry.destroyAsync();

      expect(destroyOrder).toEqual(['service1', 'service2', 'service3']);
    });

    it('should wait for pending initializations before destruction', async () => {
      const timeline: string[] = [];

      @Injectable()
      class SlowInitService implements AsyncInjectableService {
        async initializeAsync(): Promise<void> {
          timeline.push('init-start');
          await new Promise((resolve) => setTimeout(resolve, 20));
          timeline.push('init-complete');
        }

        async onDestroy(): Promise<void> {
          timeline.push('destroy-start');
          await new Promise((resolve) => setTimeout(resolve, 5));
          timeline.push('destroy-complete');
        }
      }

      const initPromise = registry.registerAsync(SlowInitService);
      const destroyPromise = registry.destroyAsync();

      await Promise.all([initPromise, destroyPromise]);

      // Verify init completed before or concurrently with destroy
      expect(timeline).toContain('init-complete');
      expect(timeline.indexOf('init-complete')).toBeLessThanOrEqual(
        timeline.indexOf('destroy-start')
      );
    });

    it('should be idempotent - second destroy() call is no-op', async () => {
      const destroyLog: string[] = [];

      @Injectable()
      class LoggingService implements AsyncInjectableService {
        async onDestroy(): Promise<void> {
          destroyLog.push('destroyed');
        }
      }

      await registry.registerAsync(LoggingService);
      await registry.destroyAsync();

      expect(destroyLog).toHaveLength(1);

      // Second destroy should be no-op
      await registry.destroyAsync();
      expect(destroyLog).toHaveLength(1);
    });

    it('should handle empty registry', async () => {
      await expect(registry.destroyAsync()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw AggregateDestructionError when single service fails', async () => {
      await registry.registerAsync(ErrorCleanupService);

      await expect(registry.destroyAsync()).rejects.toThrow(
        AggregateDestructionError
      );
    });

    it('should aggregate errors from multiple failing services', async () => {
      @Injectable()
      class FailService1 implements AsyncInjectableService {
        async onDestroy(): Promise<void> {
          throw new Error('Service 1 failed');
        }
      }

      @Injectable()
      class FailService2 implements AsyncInjectableService {
        async onDestroy(): Promise<void> {
          throw new Error('Service 2 failed');
        }
      }

      await registry.registerAsync(FailService1);
      await registry.registerAsync(FailService2);

      let error: AggregateDestructionError | undefined;
      try {
        await registry.destroyAsync();
        expect.fail('Should have thrown');
      } catch (e) {
        error = e as AggregateDestructionError;
      }

      expect(error).toBeDefined();
      if (!error) throw new Error('Error should be defined');
      expect(error.failures).toHaveLength(2);
    });

    it('should continue destroying other services on error', async () => {
      const cleanedUp: string[] = [];

      @Injectable()
      class Service1 implements AsyncInjectableService {
        async onDestroy(): Promise<void> {
          throw new Error('Service 1 failed');
        }
      }

      @Injectable()
      class Service2 implements AsyncInjectableService {
        async onDestroy(): Promise<void> {
          cleanedUp.push('service2');
        }
      }

      @Injectable()
      class Service3 implements AsyncInjectableService {
        async onDestroy(): Promise<void> {
          cleanedUp.push('service3');
        }
      }

      await registry.registerAsync(Service1);
      await registry.registerAsync(Service2);
      await registry.registerAsync(Service3);

      await expect(registry.destroyAsync()).rejects.toThrow(
        AggregateDestructionError
      );

      // Service2 and Service3 should still be cleaned
      expect(cleanedUp).toEqual(['service2', 'service3']);
    });

    it('should have failures property with service names', async () => {
      @Injectable()
      class NamedErrorService1 implements AsyncInjectableService {
        async onDestroy(): Promise<void> {
          throw new Error('First failure');
        }
      }

      @Injectable()
      class NamedErrorService2 implements AsyncInjectableService {
        async onDestroy(): Promise<void> {
          throw new Error('Second failure');
        }
      }

      await registry.registerAsync(NamedErrorService1);
      await registry.registerAsync(NamedErrorService2);

      try {
        await registry.destroyAsync();
        expect.fail('Should have thrown');
      } catch (error) {
        const aggError = error as AggregateDestructionError;
        expect(aggError.failures).toHaveLength(2);
        expect(aggError.failures[0].serviceName).toBe('NamedErrorService1');
        expect(aggError.failures[1].serviceName).toBe('NamedErrorService2');
      }
    });

    it('should have getErrors() helper method', async () => {
      @Injectable()
      class FailingService implements AsyncInjectableService {
        async onDestroy(): Promise<void> {
          throw new Error('Test failure');
        }
      }

      await registry.registerAsync(FailingService);

      try {
        await registry.destroyAsync();
        expect.fail('Should have thrown');
      } catch (error) {
        const aggError = error as AggregateDestructionError;
        const errors = aggError.getErrors();
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('Test failure');
      }
    });

    it('should have hasFailure() helper method', async () => {
      @Injectable()
      class CheckableService implements AsyncInjectableService {
        async onDestroy(): Promise<void> {
          throw new Error('Failure');
        }
      }

      await registry.registerAsync(CheckableService);

      try {
        await registry.destroyAsync();
        expect.fail('Should have thrown');
      } catch (error) {
        const aggError = error as AggregateDestructionError;
        expect(aggError.hasFailure('CheckableService')).toBe(true);
        expect(aggError.hasFailure('NonExistentService')).toBe(false);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent destroy calls safely with idempotent flag', async () => {
      const destroyCalls: number[] = [];

      @Injectable()
      class ConcurrentService implements AsyncInjectableService {
        async onDestroy(): Promise<void> {
          destroyCalls.push(1);
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      }

      await registry.registerAsync(ConcurrentService);

      // Attempt concurrent destroys
      await Promise.all([
        registry.destroyAsync(),
        registry.destroyAsync(),
        registry.destroyAsync(),
      ]);

      // Should only destroy once due to idempotent guard
      expect(destroyCalls).toHaveLength(1);
    });

    it('should handle mixed sync and async services', async () => {
      const destroyed: boolean[] = [];

      @Injectable()
      class AsyncService1 implements AsyncInjectableService {
        async onDestroy(): Promise<void> {
          destroyed.push(true);
        }
      }

      @Injectable()
      class SyncService1 {
        value = 'sync';
      }

      @Injectable()
      class AsyncService2 implements AsyncInjectableService {
        async onDestroy(): Promise<void> {
          destroyed.push(true);
        }
      }

      await registry.registerAsync(AsyncService1);
      registry.register(SyncService1);
      await registry.registerAsync(AsyncService2);

      await registry.destroyAsync();

      // Both async services destroyed
      expect(destroyed).toHaveLength(2);
    });

    it('should skip undefined service entries', async () => {
      @Injectable()
      class UndefinedService {
        value = 'should not error';
      }

      registry.registerAsUndefined(UndefinedService);
      await expect(registry.destroyAsync()).resolves.not.toThrow();
    });

    it('should handle service registered but never initialized', async () => {
      registry.register(CleanupService);
      // Service is registered but not initialized (no getServiceAsync call)

      await registry.destroyAsync();
      // Should not invoke onDestroy on uninitialized service
      const service = registry.getService(CleanupService);
      if (!service) throw new Error('Service not defined');
      expect(service.destroyed).toBe(false);
    });

    it('should clear all internal maps even on error', async () => {
      @Injectable()
      class FailService implements AsyncInjectableService {
        async onDestroy(): Promise<void> {
          throw new Error('Cleanup failed');
        }
      }

      await registry.registerAsync(FailService);

      try {
        await registry.destroyAsync();
      } catch {
        // Expected
      }

      // Attempt to access after failed destroy
      registry.register(CleanupService);
      const service = registry.getService(CleanupService);
      expect(service).toBeDefined();
    });

    it('should track custom service instance names', async () => {
      @Injectable()
      class CustomService implements AsyncInjectableService {
        public customProp = 'test';

        async initializeAsync(): Promise<void> {
          // Initialize
        }

        async onDestroy(): Promise<void> {
          throw new Error('Custom failure');
        }
      }

      const customInstance = new CustomService();
      registry.registerCustomServiceInstance(CustomService, customInstance);
      // Need to initialize the custom instance
      await registry.getServiceAsync(CustomService);

      try {
        await registry.destroyAsync();
        expect.fail('Should have thrown');
      } catch (error) {
        const aggError = error as AggregateDestructionError;
        expect(aggError.failures).toHaveLength(1);
        expect(aggError.failures[0].serviceName).toBe('CustomService');
      }
    });
  });

  describe('Real-World Scenarios', () => {
    it('should cleanup database connections', async () => {
      const connectionLog: string[] = [];

      @Injectable()
      class TestDatabaseService implements AsyncInjectableService {
        private connected = false;

        async initializeAsync(): Promise<void> {
          connectionLog.push('connect-start');
          await new Promise((resolve) => setTimeout(resolve, 5));
          this.connected = true;
          connectionLog.push('connect-complete');
        }

        async onDestroy(): Promise<void> {
          if (this.connected) {
            connectionLog.push('disconnect-start');
            await new Promise((resolve) => setTimeout(resolve, 5));
            this.connected = false;
            connectionLog.push('disconnect-complete');
          }
        }
      }

      await registry.registerAsync(TestDatabaseService);
      await registry.destroyAsync();

      expect(connectionLog).toEqual([
        'connect-start',
        'connect-complete',
        'disconnect-start',
        'disconnect-complete',
      ]);
    });

    it('should cleanup timers and intervals', async () => {
      await registry.registerAsync(TimerService);
      const service = await registry.getServiceAsync(TimerService);
      if (!service) throw new Error('Service not defined');

      expect(service.timers).toHaveLength(1);
      expect(service.cleaned).toBe(false);

      await registry.destroyAsync();

      expect(service.cleaned).toBe(true);
      expect(service.timers).toHaveLength(0);
    });

    it('should handle slow cleanup operations', async () => {
      const startTime = Date.now();
      await registry.registerAsync(SlowCleanupService);

      await registry.destroyAsync();

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(30);
    });
  });

  describe('Scoped Destruction', () => {
    it('should destroy scoped services asynchronously', async () => {
      const testScope = 'test-scope';
      InjectionContext.createScope(testScope);

      const registryScoped = InjectionContext.getRegistry(testScope);
      await registryScoped.registerAsync(CleanupService);
      const service = await registryScoped.getServiceAsync(CleanupService);
      if (!service) throw new Error('Service not defined');

      expect(service.destroyed).toBe(false);
      await InjectionContext.destroyScopeAsync(testScope);
      expect(service.destroyed).toBe(true);
    });

    it('should clear all scopes asynchronously', async () => {
      const scope1 = 'scope1';
      const scope2 = 'scope2';

      InjectionContext.createScope(scope1);
      InjectionContext.createScope(scope2);

      const reg1 = InjectionContext.getRegistry(scope1);
      const reg2 = InjectionContext.getRegistry(scope2);

      await reg1.registerAsync(CleanupService);
      await reg2.registerAsync(CleanupService);

      const service1 = await reg1.getServiceAsync(CleanupService);
      const service2 = await reg2.getServiceAsync(CleanupService);
      if (!service1 || !service2) throw new Error('Services not defined');

      await InjectionContext.clearAllAsync();

      expect(service1.destroyed).toBe(true);
      expect(service2.destroyed).toBe(true);
      expect(InjectionContext.getActiveScopes()).toHaveLength(0);
    });

    it('should aggregate errors across multiple scopes', async () => {
      const scope1 = 'scope1';
      const scope2 = 'scope2';

      InjectionContext.createScope(scope1);
      InjectionContext.createScope(scope2);

      const reg1 = InjectionContext.getRegistry(scope1);
      const reg2 = InjectionContext.getRegistry(scope2);

      await reg1.registerAsync(ErrorCleanupService);
      await reg2.registerAsync(ErrorCleanupService);

      await expect(InjectionContext.clearAllAsync()).rejects.toThrow(
        AggregateDestructionError
      );
    });
  });

  describe('Integration with Global Utility', () => {
    beforeEach(() => {
      // Reset the global registry for these tests
      InjectionContext.clearAll();
    });

    it('should destroy all services via utility function', async () => {
      const registryGlobal = getServiceRegistry();

      await registryGlobal.registerAsync(CleanupService);
      const service = await registryGlobal.getServiceAsync(CleanupService);
      if (!service) throw new Error('Service not defined');

      expect(service.destroyed).toBe(false);
      await destroyAllServicesAsync();
      expect(service.destroyed).toBe(true);
    });

    it('should handle cleanup lifecycle with database example', async () => {
      const registryGlobal = getServiceRegistry();

      @Injectable()
      class ExampleDatabaseService implements AsyncInjectableService {
        public connection: string | null = null;

        async initializeAsync(): Promise<void> {
          this.connection = 'connected';
        }

        async onDestroy(): Promise<void> {
          if (this.connection) {
            this.connection = null;
          }
        }
      }

      await registerAsync(ExampleDatabaseService);
      const db = await registryGlobal.getServiceAsync(ExampleDatabaseService);
      if (!db) throw new Error('DB service not defined');

      expect(db.connection).toBe('connected');
      await destroyAllServicesAsync();
      expect(db.connection).toBe(null);
    });
  });

  describe('Type safety', () => {
    it('should allow services to implement AsyncInjectableService with onDestroy', () => {
      const service: AsyncInjectableService = {
        initializeAsync: async () => {
          // no-op
        },
        onDestroy: async () => {
          // no-op
        },
      };

      expect(service.onDestroy).toBeDefined();
      expect(typeof service.onDestroy).toBe('function');
    });
  });
});
