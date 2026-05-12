import { rm } from 'fs/promises';
import { join } from 'path';
import { workspaceRoot } from '@nx/devkit';

const keycloakUrl =
  'http://localhost:8080/realms/dev/.well-known/openid-configuration';
const defaultKeycloakDiscoveryTimeoutMs = 10_000;
const sessionDirectory = join(workspaceRoot, '.sessions');

type DiscoveryFetch = (
  input: string,
  init: { signal: AbortSignal }
) => Promise<{ ok: boolean; status: number }>;
type RemoveDirectory = typeof rm;

export function getKeycloakDiscoveryTimeoutMs(
  env: NodeJS.ProcessEnv = process.env
) {
  const configuredTimeout = env['KEYCLOAK_DISCOVERY_TIMEOUT_MS'];

  if (!configuredTimeout) {
    return defaultKeycloakDiscoveryTimeoutMs;
  }

  const timeoutMs = Number(configuredTimeout);

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(
      'KEYCLOAK_DISCOVERY_TIMEOUT_MS must be a positive number of milliseconds'
    );
  }

  return timeoutMs;
}

export async function checkKeycloakDiscovery({
  fetchFn = fetch as DiscoveryFetch,
  timeoutMs = getKeycloakDiscoveryTimeoutMs(),
}: {
  fetchFn?: DiscoveryFetch;
  timeoutMs?: number;
} = {}) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetchFn(keycloakUrl, {
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Keycloak returned ${response.status}`);
    }

    console.log('✓ Keycloak discovery endpoint reachable');
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new Error(`Keycloak discovery timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function cleanupSessionDirectory({
  rmFn = rm,
}: {
  rmFn?: RemoveDirectory;
} = {}) {
  try {
    await rmFn(sessionDirectory, {
      recursive: true,
      force: true,
    });
  } catch (error) {
    throw new Error(
      `Failed to clean up session directory in globalSetup with rm at ${sessionDirectory}.\n` +
        `Error: ${error}`
    );
  }
}

export default async function globalSetup() {
  await cleanupSessionDirectory();

  try {
    await checkKeycloakDiscovery();
  } catch (error) {
    throw new Error(
      `Keycloak is not reachable at ${keycloakUrl}. ` +
        `Start it with: docker compose -f docker/docker-compose.yml up -d\n` +
        `Error: ${error}`
    );
  }
}
