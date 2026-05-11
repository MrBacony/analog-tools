import { rm } from 'fs/promises';
import { join } from 'path';
import { workspaceRoot } from '@nx/devkit';

const sessionDirectory = join(workspaceRoot, '.sessions');

type RemoveDirectory = typeof rm;

function isNotFoundError(error: unknown) {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

export async function cleanupSessionDirectory({
  rm: removeDirectory = rm,
  directory = sessionDirectory,
}: {
  rm?: RemoveDirectory;
  directory?: string;
} = {}) {
  try {
    await removeDirectory(directory, {
      recursive: true,
    });
    console.log('✓ Cleaned .sessions directory');
  } catch (error) {
    if (isNotFoundError(error)) {
      return;
    }

    throw error;
  }
}

export default async function globalTeardown() {
  await cleanupSessionDirectory();
}
