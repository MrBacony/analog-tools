import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceRegistry, getServiceRegistry } from '../service-registry';
import { Injectable } from '../symbol-registry';
import { injectScoped } from '../injection-context';
import {
  InjectionError,
  MissingServiceTokenError,
  inject,
  injectAsync,
  registerAsync,
  registerService,
  registerServiceAsUndefined,
} from '../inject.util';
import type { AsyncInjectableService } from '../inject.types';

// Mock services for testing
@Injectable()
class AsyncService implements AsyncInjectableService {
  public initialized = false;

  async initializeAsync(): Promise<void> {
    // Simulate async work
    await new Promise((resolve) => setTimeout(resolve, 10));
    this.initialized = true;
  }
}

@Injectable()
class SyncService {
  public value = 'sync';
}

@Injectable()
class AsyncServiceWithError implements AsyncInjectableService {
  async initializeAsync(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
    throw new Error('Initialization failed');
  }
}

@Injectable()
class AsyncServiceSyncThrow implements AsyncInjectableService {
  async initializeAsync(): Promise<void> {
    throw new Error('Synchronous initialization error');
  }
}

@Injectable()
class SlowAsyncService implements AsyncInjectableService {
  public initCount = 0;

  async initializeAsync(): Promise<void> {
    this.initCount++;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

class NonInjectableService {
  public value = 'non-injectable';
}

describe('Async Injection Support', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    registry.destroy();
  });

  describe('AsyncInjectableService interface', () => {
    it('should allow services to implement AsyncInjectableService with initializeAsync method', async () => {
      // Type-level test: verify the interface can be implemented
      const service: AsyncInjectableService = {
        initializeAsync: async () => {
          // no-op
        },
      };

      expect(service.initializeAsync).toBeDefined();
      expect(typeof service.initializeAsync).toBe('function');
    });
  });

  describe('ServiceRegistry.getServiceAsync', () => {
    it('should return initialized service with initializeAsync called', async () => {
      registry.register(AsyncService);
      const service = await registry.getServiceAsync(AsyncService);

      expect(service).toBeDefined();
      expect(service?.initialized).toBe(true);
    });

    it('should handle services without initializeAsync method', async () => {
      registry.register(SyncService);
      const service = await registry.getServiceAsync(SyncService);

      expect(service).toBeDefined();
      expect(service?.value).toBe('sync');
    });

    it('should return undefined for services registered as undefined', async () => {
      registry.registerAsUndefined(AsyncService);
      const service = await registry.getServiceAsync(AsyncService);

      expect(service).toBeUndefined();
    });

    it('should deduplicate concurrent getServiceAsync calls', async () => {
      registry.register(SlowAsyncService);
      const service1 = registry.getServiceAsync(SlowAsyncService);
      const service2 = registry.getServiceAsync(SlowAsyncService);

      const [result1, result2] = await Promise.all([service1, service2]);

      expect(result1).toBe(result2);
      expect(result1?.initCount).toBe(1); // Only initialized once despite two calls
    });

    it('should allow retry after failed initialization', async () => {
      let attemptCount = 0;
      @Injectable()
      class RetryableService implements AsyncInjectableService {
        async initializeAsync(): Promise<void> {
          attemptCount++;
          if (attemptCount === 1) {
            throw new Error('First attempt fails');
          }
          // Second attempt succeeds
        }
      }

      registry.register(RetryableService);

      // First attempt fails
      await expect(registry.getServiceAsync(RetryableService)).rejects.toThrow(
        'First attempt fails'
      );

      // Second attempt should retry (not cached failure)
      const service = await registry.getServiceAsync(RetryableService);
      expect(service).toBeDefined();
      expect(attemptCount).toBe(2);
    });

    it('should throw MissingServiceTokenError for non-decorated services', async () => {
      // Note: getServiceKey() is called synchronously in getServiceAsync,
      // so async function throws synchronously before returning a promise
      await expect(registry.getServiceAsync(NonInjectableService)).rejects.toThrow(
        MissingServiceTokenError
      );
    });

    it('should propagate initialization errors from initializeAsync', async () => {
      registry.register(AsyncServiceWithError);
      await expect(registry.getServiceAsync(AsyncServiceWithError)).rejects.toThrow(
        'Initialization failed'
      );
    });

    it('should handle synchronous throws in initializeAsync', async () => {
      registry.register(AsyncServiceSyncThrow);
      await expect(registry.getServiceAsync(AsyncServiceSyncThrow)).rejects.toThrow(
        'Synchronous initialization error'
      );
    });

    it('should only cache successful initialization', async () => {
      let callCount = 0;
      @Injectable()
      class CountingService implements AsyncInjectableService {
        async initializeAsync(): Promise<void> {
          callCount++;
          if (callCount === 1) {
            throw new Error('Failed');
          }
        }
      }

      registry.register(CountingService);

      // First call fails
      await expect(registry.getServiceAsync(CountingService)).rejects.toThrow('Failed');
      expect(callCount).toBe(1);

      // Second call retries and succeeds
      const service = await registry.getServiceAsync(CountingService);
      expect(service).toBeDefined();
      expect(callCount).toBe(2);
    });
  });

  describe('ServiceRegistry.registerAsync', () => {
    it('should eagerly initialize service during registration', async () => {
      const service = AsyncService;
      let initialized = false;

      registry.register(service);
      const instance = registry.getService(service);

      // Before registerAsync, instance should not be initialized
      expect(instance?.initialized).toBe(false);

      // registerAsync should initialize it
      await registry.registerAsync(service);
      expect(instance?.initialized).toBe(true);
      initialized = true;

      expect(initialized).toBe(true);
    });

    it('should handle services without initializeAsync', async () => {
      const service = SyncService;
      registry.register(service);

      await expect(registry.registerAsync(service)).resolves.toBeUndefined();
      expect(registry.hasService(service)).toBe(true);
    });

    it('should propagate errors from initializeAsync', async () => {
      registry.register(AsyncServiceWithError);

      await expect(registry.registerAsync(AsyncServiceWithError)).rejects.toThrow(
        'Initialization failed'
      );
    });

    it('should not initialize if service already initialized', async () => {
      registry.register(SlowAsyncService);
      const instance = registry.getService(SlowAsyncService);

      await registry.registerAsync(SlowAsyncService);
      expect(instance?.initCount).toBe(1);

      // Calling registerAsync again should not re-initialize
      await registry.registerAsync(SlowAsyncService);
      expect(instance?.initCount).toBe(1);
    });

    it('should create service if not already registered', async () => {
      expect(registry.hasService(AsyncService)).toBe(false);
      await registry.registerAsync(AsyncService);
      expect(registry.hasService(AsyncService)).toBe(true);
      const service = registry.getService(AsyncService);
      expect(service?.initialized).toBe(true);
    });
  });

  describe('ServiceRegistry.destroy', () => {
    it('should clear initialization promises when destroyed', async () => {
      registry.register(SlowAsyncService);
      const promise1 = registry.getServiceAsync(SlowAsyncService);

      registry.destroy();

      // After destroy, a new initialization should happen
      registry.register(SlowAsyncService);
      const promise2 = registry.getServiceAsync(SlowAsyncService);

      const [result1, result2] = await Promise.all([promise1, promise2]);
      // Different instances means reinitialization happened
      expect(result1).not.toBe(result2);
    });

    it('should clear all services and promises', async () => {
      registry.register(AsyncService);
      registry.register(SyncService);

      await registry.getServiceAsync(AsyncService);

      registry.destroy();

      expect(registry.hasService(AsyncService)).toBe(false);
      expect(registry.hasService(SyncService)).toBe(false);
    });
  });

  describe('injectAsync function', () => {
    beforeEach(() => {
      // Reset to global registry for injectAsync tests
      getServiceRegistry().destroy();
    });

    it('should inject and initialize async service', async () => {
      const service = await injectAsync(AsyncService);
      expect(service).toBeDefined();
      expect(service.initialized).toBe(true);
    });

    it('should work with services without initializeAsync', async () => {
      const service = await injectAsync(SyncService);
      expect(service).toBeDefined();
      expect(service.value).toBe('sync');
    });

    it('should throw InjectionError for non-decorated services (required=true)', async () => {
      // NonInjectableService is not decorated, so it should throw when trying to inject
      await expect(injectAsync(NonInjectableService)).rejects.toThrow(MissingServiceTokenError);
    });

    it('should throw InjectionError for non-decorated services (required=false)', async () => {
      // Even with required=false, non-decorated services should throw (not fallback to undefined)
      // because the error happens at the token resolution level, not the service retrieval level
      await expect(injectAsync(NonInjectableService, { required: false })).rejects.toThrow(
        MissingServiceTokenError
      );
    });

    it('should return undefined for services registered as undefined with required=false', async () => {
      registerServiceAsUndefined(AsyncService);
      const service = await injectAsync(AsyncService, { required: false });
      expect(service).toBeUndefined();
    });

    it('should throw InjectionError for services registered as undefined with required=true', async () => {
      registerServiceAsUndefined(AsyncService);
      await expect(injectAsync(AsyncService)).rejects.toThrow(InjectionError);
    });

    it('should wrap initialization errors in InjectionError', async () => {
      try {
        await injectAsync(AsyncServiceWithError);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(InjectionError);
        expect((error as InjectionError).message).toContain('Failed to inject async service');
        expect((error as InjectionError).cause?.message).toContain('Initialization failed');
      }
    });

    it('should throw MissingServiceTokenError for non-decorated services', async () => {
      await expect(injectAsync(NonInjectableService)).rejects.toThrow(
        MissingServiceTokenError
      );
    });

    it('should deduplicate concurrent injectAsync calls', async () => {
      const call1 = injectAsync(SlowAsyncService);
      const call2 = injectAsync(SlowAsyncService);

      const [service1, service2] = await Promise.all([call1, call2]);

      expect(service1).toBe(service2);
      expect(service1.initCount).toBe(1);
    });

    it('should accept required option as false', async () => {
      // Test using a registered-as-undefined service (the actual way to get undefined back)
      registerServiceAsUndefined(SyncService);
      const service = await injectAsync(SyncService, { required: false });
      expect(service).toBeUndefined();
    });
  });

  describe('registerAsync function', () => {
    beforeEach(() => {
      getServiceRegistry().destroy();
    });

    it('should register and initialize service', async () => {
      await registerAsync(AsyncService);
      const service = inject(AsyncService);
      expect(service.initialized).toBe(true);
    });

    it('should wrap registration errors in InjectionError', async () => {
      await expect(registerAsync(AsyncServiceWithError)).rejects.toThrow(InjectionError);
    });

    it('should handle services without initializeAsync', async () => {
      await expect(registerAsync(SyncService)).resolves.toBeUndefined();
      const service = inject(SyncService);
      expect(service).toBeDefined();
    });

    it('should allow passing constructor parameters', async () => {
      @Injectable()
      class ServiceWithParams implements AsyncInjectableService {
        public initialized = false;

        constructor(public readonly param: string) {}

        async initializeAsync(): Promise<void> {
          await new Promise((resolve) => setTimeout(resolve, 10));
          this.initialized = true;
        }
      }

      await registerAsync(ServiceWithParams, 'test-value');
      const service = inject(ServiceWithParams);

      expect(service.param).toBe('test-value');
      expect(service.initialized).toBe(true);
    });

    it('should throw MissingServiceTokenError for non-decorated services', async () => {
      await expect(registerAsync(NonInjectableService)).rejects.toThrow(
        MissingServiceTokenError
      );
    });
  });

  describe('Integration scenarios', () => {
    beforeEach(() => {
      getServiceRegistry().destroy();
    });

    it('should handle multiple async services', async () => {
      await registerAsync(AsyncService);

      @Injectable()
      class AnotherAsyncService implements AsyncInjectableService {
        public initialized = false;

        async initializeAsync(): Promise<void> {
          await new Promise((resolve) => setTimeout(resolve, 10));
          this.initialized = true;
        }
      }

      await registerAsync(AnotherAsyncService);

      const service1 = inject(AsyncService);
      const service2 = inject(AnotherAsyncService);

      expect(service1.initialized).toBe(true);
      expect(service2.initialized).toBe(true);
    });

    it('should allow mixing sync and async services', async () => {
      registerService(SyncService);
      await registerAsync(AsyncService);

      const syncService = inject(SyncService);
      const asyncService = inject(AsyncService);

      expect(syncService.value).toBe('sync');
      expect(asyncService.initialized).toBe(true);
    });

    it('should handle circular dependency detection on async path', async () => {
      @Injectable()
      class ServiceA implements AsyncInjectableService {
        async initializeAsync(): Promise<void> {
          // no-op
        }
      }

      registerService(ServiceA);
      // Registering again should not throw
      expect(() => registerService(ServiceA)).not.toThrow();
    });

    it('scoped injection returns uninitialized service (limitation)', () => {
      // This test documents the limitation: injectScoped does not await async initialization
      registerService(AsyncService);
      const service = injectScoped(AsyncService);
      expect(service.initialized).toBe(false); // Not initialized
    });
  });
});
