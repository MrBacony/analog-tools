import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration, readJson } from '@nx/devkit';

import { libraryGenerator } from './library';
import { LibraryGeneratorSchema } from './schema';

describe('library generator', () => {
  let tree: Tree;
  const options: LibraryGeneratorSchema = {
    name: 'test-lib',
    project: 'test-app',
  };
  const npmScope = 'myorg'; // Define a scope for testing

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    // Mock nx.json
    tree.write('nx.json', JSON.stringify({ npmScope }));

    // Mock tsconfig.base.json
    tree.write(
      'tsconfig.base.json',
      JSON.stringify({
        compilerOptions: {
          paths: {},
        },
      })
    );

    // Mock app project and vite.config.ts
    tree.write(
      `apps/${options.project}/vite.config.ts`,
      `import { defineConfig } from 'vite';
       import analog from '@analogjs/platform';

       export default defineConfig(({ mode }) => ({
         plugins: [
           analog({
             // Existing options (can be empty)
           }),
         ],
       }));`
    );
    // Mock project config for the app (needed for vite path finding)
    tree.write(
      `apps/${options.project}/project.json`,
      JSON.stringify({
        name: options.project,
        root: `apps/${options.project}`,
        projectType: 'application',
        targets: {},
      })
    );
  });

  it('should run successfully and add project configuration', async () => {
    await libraryGenerator(tree, options);
    const config = readProjectConfiguration(tree, options.name);
    expect(config).toBeDefined();
    expect(config.root).toBe(`libs/${options.name}`);
  });

  it('should update tsconfig.base.json with path mapping', async () => {
    await libraryGenerator(tree, options);
    const tsConfig = readJson(tree, 'tsconfig.base.json');
    const expectedPath = `@${npmScope}/${options.name}`;
    const expectedFilePath = [`libs/${options.name}/src/index.ts`];

    expect(tsConfig.compilerOptions.paths[expectedPath]).toEqual(
      expectedFilePath
    );
  });

  it('should update vite.config.ts with additional dirs', async () => {
    await libraryGenerator(tree, options);
    const viteConfigContent = tree
      .read(`apps/${options.project}/vite.config.ts`)
      ?.toString('utf-8');
    expect(viteConfigContent).toBeDefined();
    // Check for added paths (use string contains for simplicity)
    expect(viteConfigContent).toContain(
      `additionalPagesDirs: ['libs/${options.name}/src/pages']`
    );
    expect(viteConfigContent).toContain(
      `additionalAPIDirs: ['libs/${options.name}/src/api']`
    );
  });

  it('should handle vite.config.ts without existing analog options gracefully', async () => {
    // Overwrite vite config with no options block
    tree.write(
      `apps/${options.project}/vite.config.ts`,
      `import { defineConfig } from 'vite';
       import analog from '@analogjs/platform';

       export default defineConfig(({ mode }) => ({
         plugins: [
           analog(), // Call analog without options object
         ],
       }));`
    );
    await libraryGenerator(tree, options);
    const viteConfigContent = tree
      .read(`apps/${options.project}/vite.config.ts`)
      ?.toString('utf-8');
    expect(viteConfigContent).toBeDefined();
    // Should still add the properties
    expect(viteConfigContent).toContain(
      `additionalPagesDirs: ['libs/${options.name}/src/pages']`
    );
    expect(viteConfigContent).toContain(
      `additionalAPIDirs: ['libs/${options.name}/src/api']`
    );
  });
});
