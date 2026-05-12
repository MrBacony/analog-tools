import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkKeycloakDiscovery,
  cleanupSessionDirectory,
  getKeycloakDiscoveryTimeoutMs,
} from '../src/global-setup';

describe('global setup Keycloak discovery', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the configured discovery timeout', () => {
    expect(
      getKeycloakDiscoveryTimeoutMs({ KEYCLOAK_DISCOVERY_TIMEOUT_MS: '2500' })
    ).toBe(2500);
  });

  it('rejects invalid discovery timeout values', () => {
    expect(() =>
      getKeycloakDiscoveryTimeoutMs({ KEYCLOAK_DISCOVERY_TIMEOUT_MS: '0' })
    ).toThrow('KEYCLOAK_DISCOVERY_TIMEOUT_MS must be a positive number');
  });

  it('aborts Keycloak discovery when the timeout elapses', async () => {
    vi.useFakeTimers();

    const fetchFn = vi.fn(
      (_input: string, init: { signal: AbortSignal }) =>
        new Promise<{ ok: boolean; status: number }>((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        })
    );

    const discoveryPromise = checkKeycloakDiscovery({
      fetchFn,
      timeoutMs: 50,
    });
    const expectedTimeout = expect(discoveryPromise).rejects.toThrow(
      'Keycloak discovery timed out after 50ms'
    );

    await vi.advanceTimersByTimeAsync(50);
    await expectedTimeout;
    expect(fetchFn.mock.calls[0]?.[1].signal.aborted).toBe(true);
  });

  it('reports session cleanup failures without a misleading Keycloak error', async () => {
    const rmFn = vi.fn(async () => {
      throw new Error('permission denied');
    });

    await expect(cleanupSessionDirectory({ rmFn })).rejects.toThrow(
      /Failed to clean up session directory.*permission denied/s
    );
  });
});
