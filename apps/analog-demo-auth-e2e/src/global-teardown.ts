import { rm } from 'fs/promises';
import { join } from 'path';
import { workspaceRoot } from '@nx/devkit';

export default async function globalTeardown() {
  try {
    await rm(join(workspaceRoot, '.sessions'), {
      recursive: true,
      force: true,
    });
    console.log('✓ Cleaned .sessions directory');
  } catch {
    // Directory may not exist, that's fine
  }
}
