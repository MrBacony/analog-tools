import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { initAuthGenerator } from './init-auth';
import { InitAuthGeneratorSchema } from './schema';

describe('init-auth generator', () => {
  let tree: Tree;
  const options: InitAuthGeneratorSchema = { project: 'test-app' };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    
    // Create a basic application structure
    tree.write('apps/test-app/project.json', JSON.stringify({
      name: 'test-app',
      projectType: 'application',
      root: 'apps/test-app',
      sourceRoot: 'apps/test-app/src',
    }));

    // Create basic app.config.ts
    tree.write('apps/test-app/src/app/app.config.ts', `
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
  ],
};
    `.trim());

    // Create basic vite.config.ts
    tree.write('apps/test-app/vite.config.ts', `
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
  },
});
    `.trim());
  });

  it('should create auth.config.ts', async () => {
    await initAuthGenerator(tree, options);
    
    expect(tree.exists('apps/test-app/src/auth.config.ts')).toBeTruthy();
    const content = tree.read('apps/test-app/src/auth.config.ts', 'utf-8');
    expect(content).toContain('AnalogAuthConfig');
    expect(content).toContain('authConfig');
  });

  it('should create auth middleware', async () => {
    await initAuthGenerator(tree, options);
    
    expect(tree.exists('apps/test-app/src/server/middleware/auth.ts')).toBeTruthy();
    const content = tree.read('apps/test-app/src/server/middleware/auth.ts', 'utf-8');
    expect(content).toContain('useAnalogAuth');
    expect(content).toContain('defineEventHandler');
  });

  it('should update app.config.ts with auth providers', async () => {
    await initAuthGenerator(tree, options);
    
    const content = tree.read('apps/test-app/src/app/app.config.ts', 'utf-8');
    expect(content).toContain('@analog-tools/auth/angular');
    expect(content).toContain('provideAuthClient');
    expect(content).toContain('authInterceptor');
  });

  it('should update vite.config.ts with noExternal', async () => {
    await initAuthGenerator(tree, options);
    
    const content = tree.read('apps/test-app/vite.config.ts', 'utf-8');
    expect(content).toContain('ssr:');
    expect(content).toContain('noExternal:');
    expect(content).toContain('@analog-tools/auth');
  });

  it('should throw error if project is not an application', async () => {
    tree.write('libs/test-lib/project.json', JSON.stringify({
      name: 'test-lib',
      projectType: 'library',
      root: 'libs/test-lib',
      sourceRoot: 'libs/test-lib/src',
    }));

    await expect(
      initAuthGenerator(tree, { project: 'test-lib' })
    ).rejects.toThrow('must be an application');
  });
});
