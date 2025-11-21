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
    const expectedFilePath = [`libs/${options.name}/src/backend/index.ts`];

    expect(tsConfig.compilerOptions.paths[expectedPath]).toEqual(
      expectedFilePath
    );
  });

  it('should update tsconfig.base.json with backend path mapping when trpc is enabled', async () => {
    await libraryGenerator(tree, { ...options, trpc: true });
    const tsConfig = readJson(tree, 'tsconfig.base.json');
    const expectedPath = `@${npmScope}/${options.name}/backend`;
    const expectedFilePath = [`libs/${options.name}/src/backend/index.ts`];

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
    const backendIndexExists = tree.exists(`libs/${options.name}/src/backend/index.ts`);

    expect(backendIndexExists).toBe(true);
  });

  it('should create backend index.ts when trpc is enabled', async () => {
    await libraryGenerator(tree, { ...options, trpc: true });
    const backendIndexExists = tree.exists(`libs/${options.name}/src/backend/index.ts`);

    expect(backendIndexExists).toBe(true);
  });

  it('should not create backend index.ts when both api and trpc are disabled', async () => {
    await libraryGenerator(tree, { ...options, api: false, trpc: false });
    const backendIndexExists = tree.exists(`libs/${options.name}/src/backend/index.ts`);

    expect(backendIndexExists).toBe(false);
  });

  it('should update vite.config.ts with additional dirs when pages and api are explicitly enabled', async () => {
    await libraryGenerator(tree, { ...options, pages: true, api: true });
    const viteConfigContent = tree
      .read(`apps/${options.project}/vite.config.ts`)
      ?.toString('utf-8');
    expect(viteConfigContent).toBeDefined();
    // Check for added paths (use string contains for simplicity)
    expect(viteConfigContent).toContain(
      `additionalPagesDirs: ['/libs/${options.name}/src/pages']`
    );
    expect(viteConfigContent).toContain(
      `additionalAPIDirs: ['/libs/${options.name}/src/backend/api']`
    );
  });

  it('should update vite.config.ts with pages dir when pages is explicitly enabled', async () => {
    // When pages is true, it should be added
    await libraryGenerator(tree, { ...options, pages: true, api: false });
    const viteConfigContent = tree
      .read(`apps/${options.project}/vite.config.ts`)
      ?.toString('utf-8');
    expect(viteConfigContent).toBeDefined();
    // Pages should be added when explicitly true
    expect(viteConfigContent).toContain(
      `additionalPagesDirs: ['/libs/${options.name}/src/pages']`
    );
    // API should not be added when explicitly false
    expect(viteConfigContent).not.toContain('additionalAPIDirs');
  });

  it('should not update vite.config.ts when pages and api are explicitly false', async () => {
    await libraryGenerator(tree, { ...options, pages: false, api: false });
    const viteConfigContent = tree
      .read(`apps/${options.project}/vite.config.ts`)
      ?.toString('utf-8');
    expect(viteConfigContent).toBeDefined();
    // Neither should be added when both are false
    expect(viteConfigContent).not.toContain('additionalPagesDirs');
    expect(viteConfigContent).not.toContain('additionalAPIDirs');
  });

  it('should update vite.config.ts with API dir when trpc is enabled', async () => {
    await libraryGenerator(tree, { ...options, trpc: true, pages: false });
    const viteConfigContent = tree
      .read(`apps/${options.project}/vite.config.ts`)
      ?.toString('utf-8');
    expect(viteConfigContent).toBeDefined();
    // API should be added when trpc is enabled
    expect(viteConfigContent).toContain(
      `additionalAPIDirs: ['/libs/${options.name}/src/backend/api']`
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
    await libraryGenerator(tree, { ...options, pages: true, api: true });
    const viteConfigContent = tree
      .read(`apps/${options.project}/vite.config.ts`)
      ?.toString('utf-8');
    expect(viteConfigContent).toBeDefined();
    // Should still add the properties
    expect(viteConfigContent).toContain(
      `additionalPagesDirs: ['/libs/${options.name}/src/pages']`
    );
    expect(viteConfigContent).toContain(
      `additionalAPIDirs: ['/libs/${options.name}/src/backend/api']`
    );
  });

  it('should add liveReload with mode check when analog has no options', async () => {
    tree.write(
      `apps/${options.project}/vite.config.ts`,
      `import { defineConfig } from 'vite';
       import analog from '@analogjs/platform';

       export default defineConfig(({ mode }) => ({
         plugins: [
           analog(),
         ],
       }));`
    );
    await libraryGenerator(tree, { ...options, pages: true });
    const viteConfigContent = tree
      .read(`apps/${options.project}/vite.config.ts`)
      ?.toString('utf-8');
    expect(viteConfigContent).toBeDefined();
    expect(viteConfigContent).toContain(`liveReload: mode !== 'production'`);
  });

  it('should add liveReload as true when analog has existing options', async () => {
    tree.write(
      `apps/${options.project}/vite.config.ts`,
      `import { defineConfig } from 'vite';
       import analog from '@analogjs/platform';

       export default defineConfig(({ mode }) => ({
         plugins: [
           analog({
             ssr: true
           }),
         ],
       }));`
    );
    await libraryGenerator(tree, { ...options, pages: true });
    const viteConfigContent = tree
      .read(`apps/${options.project}/vite.config.ts`)
      ?.toString('utf-8');
    expect(viteConfigContent).toBeDefined();
    expect(viteConfigContent).toContain(`liveReload: true`);
    expect(viteConfigContent).toContain(`ssr: true`);
  });

  it('should not add liveReload when it already exists', async () => {
    tree.write(
      `apps/${options.project}/vite.config.ts`,
      `import { defineConfig } from 'vite';
       import analog from '@analogjs/platform';

       export default defineConfig(({ mode }) => ({
         plugins: [
           analog({
             liveReload: false
           }),
         ],
       }));`
    );
    await libraryGenerator(tree, { ...options, pages: true });
    const viteConfigContent = tree
      .read(`apps/${options.project}/vite.config.ts`)
      ?.toString('utf-8');
    expect(viteConfigContent).toBeDefined();
    // Should not duplicate liveReload
    const liveReloadCount = (viteConfigContent.match(/liveReload/g) || []).length;
    expect(liveReloadCount).toBe(1);
    expect(viteConfigContent).toContain(`liveReload: false`);
  });

  it('should not create example files', async () => {
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

    expect(componentExists).toBe(false);
    expect(specExists).toBe(false);
    expect(modelExists).toBe(false);
  });

  it('should not create example files when skipExamples is true', async () => {
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
    const libDirExists = tree.exists(`libs/${options.name}/src/lib`);

    expect(libDirExists).toBe(true);
  });

  it('should remove hello.ts API route when skipExamples is true and api is true', async () => {
    await libraryGenerator(tree, {
      ...options,
      skipExamples: true,
      api: true,
    });
    const helloApiExists = tree.exists(
      `libs/${options.name}/src/backend/api/routes/api/test-lib/hello.ts`
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
      `libs/${options.name}/src/backend/api/routes/api/test-lib/hello.ts`
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
    const apiDirExists = tree.exists(`libs/${options.name}/src/backend/api/routes/api/test-lib`);
    const gitkeepExists = tree.exists(`libs/${options.name}/src/backend/api/routes/api/test-lib/.gitkeep`);

    expect(apiDirExists).toBe(true);
    expect(gitkeepExists).toBe(true);
  });

  it('should create example content file when contentRoutes is true and skipExamples is false', async () => {
    await libraryGenerator(tree, {
      ...options,
      contentRoutes: true,
      skipExamples: false,
    });
    const contentFileExists = tree.exists(
      `libs/${options.name}/src/content/test-lib/example-post.md`
    );

    expect(contentFileExists).toBe(true);
  });

  it('should remove example content file when skipExamples is true and contentRoutes is true', async () => {
    await libraryGenerator(tree, {
      ...options,
      contentRoutes: true,
      skipExamples: true,
    });
    const contentFileExists = tree.exists(
      `libs/${options.name}/src/content/test-lib/example-post.md`
    );

    expect(contentFileExists).toBe(false);
  });

  it('should keep content directory when skipExamples is true and contentRoutes is true', async () => {
    await libraryGenerator(tree, {
      ...options,
      contentRoutes: true,
      skipExamples: true,
    });
    const contentDirExists = tree.exists(`libs/${options.name}/src/content/test-lib`);
    const gitkeepExists = tree.exists(`libs/${options.name}/src/content/test-lib/.gitkeep`);

    expect(contentDirExists).toBe(true);
    expect(gitkeepExists).toBe(true);
  });

  it('should remove entire content directory when contentRoutes is false', async () => {
    await libraryGenerator(tree, {
      ...options,
      contentRoutes: false,
    });
    const contentDirExists = tree.exists(`libs/${options.name}/src/content`);

    expect(contentDirExists).toBe(false);
  });

  // Comprehensive tests for all 16 flag combinations
  describe('all 16 flag combinations', () => {
    const combinations = [
      { pages: false, contentRoutes: false, api: false, trpc: false },
      { pages: false, contentRoutes: false, api: false, trpc: true },
      { pages: false, contentRoutes: false, api: true, trpc: false },
      { pages: false, contentRoutes: false, api: true, trpc: true },
      { pages: false, contentRoutes: true, api: false, trpc: false },
      { pages: false, contentRoutes: true, api: false, trpc: true },
      { pages: false, contentRoutes: true, api: true, trpc: false },
      { pages: false, contentRoutes: true, api: true, trpc: true },
      { pages: true, contentRoutes: false, api: false, trpc: false },
      { pages: true, contentRoutes: false, api: false, trpc: true },
      { pages: true, contentRoutes: false, api: true, trpc: false },
      { pages: true, contentRoutes: false, api: true, trpc: true },
      { pages: true, contentRoutes: true, api: false, trpc: false },
      { pages: true, contentRoutes: true, api: false, trpc: true },
      { pages: true, contentRoutes: true, api: true, trpc: false },
      { pages: true, contentRoutes: true, api: true, trpc: true },
    ];

    combinations.forEach((combo, index) => {
      it(`should generate correct files for combination ${index + 1}: ${JSON.stringify(combo)}`, async () => {
        await libraryGenerator(tree, { ...options, ...combo });

        // Check pages directory
        const pagesExists = tree.exists(`libs/${options.name}/src/pages`);
        expect(pagesExists).toBe(combo.pages);

        // Check content directory
        const contentExists = tree.exists(`libs/${options.name}/src/content`);
        expect(contentExists).toBe(combo.contentRoutes);

        // Check backend directory (should exist if api OR trpc)
        const backendExists = tree.exists(`libs/${options.name}/src/backend`);
        expect(backendExists).toBe(combo.api || combo.trpc);

        // Check backend index.ts
        const backendIndexExists = tree.exists(`libs/${options.name}/src/backend/index.ts`);
        expect(backendIndexExists).toBe(combo.api || combo.trpc);

        // Check API hello.ts route
        const helloApiExists = tree.exists(
          `libs/${options.name}/src/backend/api/routes/api/test-lib/hello.ts`
        );
        expect(helloApiExists).toBe(combo.api);

        // Check tRPC files
        const trpcClientExists = tree.exists(`libs/${options.name}/src/backend/trpc/trpc-client.ts`);
        expect(trpcClientExists).toBe(combo.trpc);

        const trpcRouterExists = tree.exists(`libs/${options.name}/src/backend/trpc/routers/index.ts`);
        expect(trpcRouterExists).toBe(combo.trpc);

        const trpcHandlerExists = tree.exists(
          `libs/${options.name}/src/backend/api/routes/api/test-lib/trpc/[trpc].ts`
        );
        expect(trpcHandlerExists).toBe(combo.trpc);

        // Check lib directory (always exists)
        const libExists = tree.exists(`libs/${options.name}/src/lib`);
        expect(libExists).toBe(true);

        // Check base files (always exist)
        const indexExists = tree.exists(`libs/${options.name}/src/index.ts`);
        expect(indexExists).toBe(true);

        const testSetupExists = tree.exists(`libs/${options.name}/src/test-setup.ts`);
        expect(testSetupExists).toBe(true);
      });

      it(`should have correct vite config for combination ${index + 1}: ${JSON.stringify(combo)}`, async () => {
        await libraryGenerator(tree, { ...options, ...combo });
        const viteConfigContent = tree
          .read(`apps/${options.project}/vite.config.ts`)
          ?.toString('utf-8');

        expect(viteConfigContent).toBeDefined();

        if (combo.pages) {
          expect(viteConfigContent).toContain(`additionalPagesDirs: ['/libs/${options.name}/src/pages']`);
        } else {
          expect(viteConfigContent).not.toContain('additionalPagesDirs');
        }

        if (combo.api || combo.trpc) {
          expect(viteConfigContent).toContain(`additionalAPIDirs: ['/libs/${options.name}/src/backend/api']`);
        } else {
          expect(viteConfigContent).not.toContain('additionalAPIDirs');
        }
      });

      it(`should have correct tsconfig for combination ${index + 1}: ${JSON.stringify(combo)}`, async () => {
        await libraryGenerator(tree, { ...options, ...combo });
        const tsConfig = readJson(tree, 'tsconfig.base.json');

        const mainPath = `@${npmScope}/${options.name}`;
        expect(tsConfig.compilerOptions.paths[mainPath]).toBeDefined();

        const backendPath = `@${npmScope}/${options.name}/backend`;
        if (combo.api || combo.trpc) {
          expect(tsConfig.compilerOptions.paths[backendPath]).toEqual([
            `libs/${options.name}/src/backend/index.ts`
          ]);
        } else {
          expect(tsConfig.compilerOptions.paths[backendPath]).toBeUndefined();
        }
      });

      it(`should handle skipExamples correctly for combination ${index + 1}: ${JSON.stringify(combo)}`, async () => {
        await libraryGenerator(tree, { ...options, ...combo, skipExamples: true });

        // Check lib directory exists
        const libDirExists = tree.exists(`libs/${options.name}/src/lib`);
        expect(libDirExists).toBe(true);

        // Check pages .gitkeep
        if (combo.pages) {
          const pagesGitkeepExists = tree.exists(`libs/${options.name}/src/pages/test-lib/.gitkeep`);
          expect(pagesGitkeepExists).toBe(true);
        }

        // Check content .gitkeep
        if (combo.contentRoutes) {
          const contentGitkeepExists = tree.exists(`libs/${options.name}/src/content/test-lib/.gitkeep`);
          expect(contentGitkeepExists).toBe(true);
        }

        // Check api .gitkeep
        if (combo.api) {
          const apiGitkeepExists = tree.exists(
            `libs/${options.name}/src/backend/api/routes/api/test-lib/.gitkeep`
          );
          expect(apiGitkeepExists).toBe(true);
        }
      });
    });
  });
});
