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

  it('should update tsconfig.base.json with backend path mapping when api is enabled', async () => {
    await libraryGenerator(tree, { ...options, api: true });
    const tsConfig = readJson(tree, 'tsconfig.base.json');
    const expectedPath = `@${npmScope}/${options.name}/backend`;
    const expectedFilePath = [`libs/${options.name}/src/api/index.ts`];

    expect(tsConfig.compilerOptions.paths[expectedPath]).toEqual(
      expectedFilePath
    );
  });

  it('should update tsconfig.base.json with backend path mapping when trpc is enabled', async () => {
    await libraryGenerator(tree, { ...options, trpc: true });
    const tsConfig = readJson(tree, 'tsconfig.base.json');
    const expectedPath = `@${npmScope}/${options.name}/backend`;
    const expectedFilePath = [`libs/${options.name}/src/api/index.ts`];

    expect(tsConfig.compilerOptions.paths[expectedPath]).toEqual(
      expectedFilePath
    );
  });

  it('should not add backend path mapping when api and trpc are disabled', async () => {
    await libraryGenerator(tree, { ...options, api: false, trpc: false });
    const tsConfig = readJson(tree, 'tsconfig.base.json');
    const backendPath = `@${npmScope}/${options.name}/backend`;

    expect(tsConfig.compilerOptions.paths[backendPath]).toBeUndefined();
  });

  it('should create backend index.ts when api is enabled', async () => {
    await libraryGenerator(tree, { ...options, api: true });
    const backendIndexExists = tree.exists(`libs/${options.name}/src/api/index.ts`);

    expect(backendIndexExists).toBe(true);
  });

  it('should create backend index.ts when trpc is enabled', async () => {
    await libraryGenerator(tree, { ...options, trpc: true });
    const backendIndexExists = tree.exists(`libs/${options.name}/src/api/index.ts`);

    expect(backendIndexExists).toBe(true);
  });

  it('should not create backend index.ts when both api and trpc are disabled', async () => {
    await libraryGenerator(tree, { ...options, api: false, trpc: false });
    const backendIndexExists = tree.exists(`libs/${options.name}/src/api/index.ts`);

    expect(backendIndexExists).toBe(false);
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

  it('should create example files by default', async () => {
    await libraryGenerator(tree, options);
    const componentExists = tree.exists(
      `libs/${options.name}/src/lib/test-lib/test-lib.component.ts`
    );
    const specExists = tree.exists(
      `libs/${options.name}/src/lib/test-lib/test-lib.component.spec.ts`
    );
    const modelExists = tree.exists(
      `libs/${options.name}/src/lib/test-lib/test-lib.model.ts`
    );

    expect(componentExists).toBe(true);
    expect(specExists).toBe(true);
    expect(modelExists).toBe(true);
  });

  it('should skip example files when skipExamples is true', async () => {
    await libraryGenerator(tree, { ...options, skipExamples: true });
    const componentExists = tree.exists(
      `libs/${options.name}/src/lib/test-lib/test-lib.component.ts`
    );
    const specExists = tree.exists(
      `libs/${options.name}/src/lib/test-lib/test-lib.component.spec.ts`
    );
    const modelExists = tree.exists(
      `libs/${options.name}/src/lib/test-lib/test-lib.model.ts`
    );

    expect(componentExists).toBe(false);
    expect(specExists).toBe(false);
    expect(modelExists).toBe(false);
  });

  it('should keep lib directory when skipExamples is true', async () => {
    await libraryGenerator(tree, { ...options, skipExamples: true });
    const libDirExists = tree.exists(`libs/${options.name}/src/lib/test-lib`);
    const gitkeepExists = tree.exists(`libs/${options.name}/src/lib/test-lib/.gitkeep`);

    expect(libDirExists).toBe(true);
    expect(gitkeepExists).toBe(true);
  });

  it('should remove hello.ts API route when skipExamples is true and api is true', async () => {
    await libraryGenerator(tree, {
      ...options,
      skipExamples: true,
      api: true,
    });
    const helloApiExists = tree.exists(
      `libs/${options.name}/src/api/routes/api/test-lib/hello.ts`
    );

    expect(helloApiExists).toBe(false);
  });

  it('should keep hello.ts API route when skipExamples is false and api is true', async () => {
    await libraryGenerator(tree, {
      ...options,
      skipExamples: false,
      api: true,
    });
    const helloApiExists = tree.exists(
      `libs/${options.name}/src/api/routes/api/test-lib/hello.ts`
    );

    expect(helloApiExists).toBe(true);
  });

  it('should remove example page files when skipExamples is true and pages is true', async () => {
    await libraryGenerator(tree, {
      ...options,
      skipExamples: true,
      pages: true,
    });
    const page1Exists = tree.exists(
      `libs/${options.name}/src/pages/test-lib/test-lib.page.ts`
    );
    const page2Exists = tree.exists(
      `libs/${options.name}/src/pages/test-lib/(test-lib).page.ts`
    );

    expect(page1Exists).toBe(false);
    expect(page2Exists).toBe(false);
  });

  it('should keep example page files when skipExamples is false and pages is true', async () => {
    await libraryGenerator(tree, {
      ...options,
      skipExamples: false,
      pages: true,
    });
    const page1Exists = tree.exists(
      `libs/${options.name}/src/pages/test-lib/test-lib.page.ts`
    );
    const page2Exists = tree.exists(
      `libs/${options.name}/src/pages/test-lib/(test-lib).page.ts`
    );

    expect(page1Exists).toBe(true);
    expect(page2Exists).toBe(true);
  });

  it('should keep pages directory when skipExamples is true and pages is true', async () => {
    await libraryGenerator(tree, {
      ...options,
      skipExamples: true,
      pages: true,
    });
    const pagesDirExists = tree.exists(`libs/${options.name}/src/pages/test-lib`);
    const gitkeepExists = tree.exists(`libs/${options.name}/src/pages/test-lib/.gitkeep`);

    expect(pagesDirExists).toBe(true);
    expect(gitkeepExists).toBe(true);
  });

  it('should keep api directory when skipExamples is true and api is true with no trpc', async () => {
    await libraryGenerator(tree, {
      ...options,
      skipExamples: true,
      api: true,
      trpc: false,
    });
    const apiDirExists = tree.exists(`libs/${options.name}/src/api/routes/api/test-lib`);
    const gitkeepExists = tree.exists(`libs/${options.name}/src/api/routes/api/test-lib/.gitkeep`);

    expect(apiDirExists).toBe(true);
    expect(gitkeepExists).toBe(true);
  });
});
