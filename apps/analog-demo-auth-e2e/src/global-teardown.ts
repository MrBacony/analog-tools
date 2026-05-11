import { rm } from 'fs/promises';
import { join } from 'path';

export default async function globalTeardown() {
  try {
    await rm(join(process.cwd(), '.sessions'), {
      recursive: true,
      force: true,
    });
    console.log('✓ Cleaned .sessions directory');
  } catch {
    // Directory may not exist, that's fine
  }
}
