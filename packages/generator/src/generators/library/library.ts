import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  names,
  Tree,
  logger,
} from '@nx/devkit';
import * as path from 'path';
import { LibraryGeneratorSchema } from './schema';
import { findViteConfigPath, updateViteConfig } from './utils/vite-config';
import { updateTsConfigBase } from './utils/tsconfig';

export async function libraryGenerator(
  tree: Tree,
  options: LibraryGeneratorSchema
) {
  const projectRoot = `libs/${options.name}`;
  const libSourceRoot = `${projectRoot}/src`;
  const moduleBaseName = options.name.split('/').pop() || options.name;
  const moduleNames = names(moduleBaseName);

  addProjectConfiguration(tree, options.name, {
    root: projectRoot,
    projectType: 'library',
    sourceRoot: libSourceRoot,
    targets: {
      test: {
        executor: '@nx/vite:test',
        outputs: ['{options.reportsDirectory}'],
        options: {
          reportsDirectory: `../../coverage/libs/${options.name}`,
        },
      },
      lint: {
        executor: '@nx/eslint:lint',
      },
    },
  });

  // Ensure all boolean options have the correct type
  options.trpc = options.trpc === true;
  options.pages = options.pages === true;
  options.contentRoutes = options.contentRoutes === true;
  options.api = options.api === true;
  options.skipExamples = options.skipExamples === true;

  const templateOptions = {
    ...options,
    ...moduleNames,
    tmpl: '',
  };

  // Generate all files first
  generateFiles(
    tree,
    path.join(__dirname, 'files'),
    projectRoot,
    templateOptions
  );

  // Remove example files if skipExamples is enabled
  if (options.skipExamples) {
    const exampleFiles = [
      `${libSourceRoot}/lib/${moduleNames.fileName}/${moduleNames.fileName}.component.ts`,
      `${libSourceRoot}/lib/${moduleNames.fileName}/${moduleNames.fileName}.component.spec.ts`,
      `${libSourceRoot}/lib/${moduleNames.fileName}/${moduleNames.fileName}.model.ts`,
    ];

    // Remove example API route if api flag is enabled
    if (options.api) {
      exampleFiles.push(
        `${libSourceRoot}/api/routes/api/${moduleNames.fileName}/hello.ts`
      );
    }

    // Remove example page files if pages flag is enabled
    if (options.pages) {
      exampleFiles.push(
        `${libSourceRoot}/pages/${moduleNames.fileName}/${moduleNames.fileName}.page.ts`,
        `${libSourceRoot}/pages/${moduleNames.fileName}/(${moduleNames.fileName}).page.ts`
      );
    }

    exampleFiles.forEach(file => {
      if (tree.exists(file)) {
        tree.delete(file);
      }
    });

    // Add .gitkeep files to preserve empty directories
    tree.write(`${libSourceRoot}/lib/${moduleNames.fileName}/.gitkeep`, '');

    if (options.pages) {
      tree.write(`${libSourceRoot}/pages/${moduleNames.fileName}/.gitkeep`, '');
    }

    if (options.api) {
      tree.write(`${libSourceRoot}/api/routes/api/${moduleNames.fileName}/.gitkeep`, '');
    }
  }

  // Remove files based on options
  if (!options.trpc) {
    // Clean up tRPC files if tRPC is disabled
    const trpcFiles = [
      `${libSourceRoot}/api/trpc/trpc-client.ts`,
      `${libSourceRoot}/api/trpc/trpc.ts`,
      `${libSourceRoot}/api/trpc/context.ts`,
      `${libSourceRoot}/api/trpc/routers/index.ts`,
      `${libSourceRoot}/api/trpc/routers/${moduleNames.fileName}.ts`,
      `${libSourceRoot}/api/routes/api/${moduleNames.fileName}/trpc/[trpc].ts`,
    ];

    trpcFiles.forEach(file => {
      if (tree.exists(file)) {
        tree.delete(file);
      }
    });

    // Also clean up the entire trpc directory structure
    const trpcDirs = [
      `${libSourceRoot}/api/trpc/routers`,
      `${libSourceRoot}/api/trpc`,
      `${libSourceRoot}/api/routes/api/${moduleNames.fileName}/trpc`,
    ];

    // Process directories from deepest to shallowest
    trpcDirs.forEach(dir => {
      if (tree.exists(dir) && tree.children(dir).length === 0) {
        tree.delete(dir);
      }
    });
  }

  if (!options.api) {
    // Clean up API files if API is disabled (but keep tRPC files if enabled)
    const apiFiles = [
      `${libSourceRoot}/api/routes/api/${moduleNames.fileName}/hello.ts`,
    ];

    apiFiles.forEach(file => {
      if (tree.exists(file)) {
        tree.delete(file);
      }
    });
  }

  // Clean up the api/routes directory structure if both API and tRPC are disabled
  if (!options.api && !options.trpc) {
    const apiRouteDirs = [
      `${libSourceRoot}/api/routes/api/${moduleNames.fileName}`,
      `${libSourceRoot}/api/routes/api`,
      `${libSourceRoot}/api/routes`,
      `${libSourceRoot}/api`,
    ];

    // Process directories from deepest to shallowest
    apiRouteDirs.forEach(dir => {
      if (tree.exists(dir) && tree.children(dir).length === 0) {
        tree.delete(dir);
      }
    });
  }

  if (!options.pages) {
    // Clean up pages files if pages is disabled
    const pagesPath = `${libSourceRoot}/pages`;
    if (tree.exists(pagesPath)) {
      const deleteRecursively = (dirPath: string) => {
        tree.children(dirPath).forEach(child => {
          const fullPath = `${dirPath}/${child}`;
          if (tree.isFile(fullPath)) {
            tree.delete(fullPath);
          } else {
            deleteRecursively(fullPath);
          }
        });

        // If the directory is now empty, delete it too
        if (tree.children(dirPath).length === 0) {
          tree.delete(dirPath);
        }
      };

      deleteRecursively(pagesPath);
    }
  }

  if (!options.contentRoutes) {
    // Clean up content routes if contentRoutes is disabled
    // But keep tRPC routes if tRPC is enabled and API routes if API is enabled
    const routesPath = `${libSourceRoot}/api/routes`;
    if (tree.exists(routesPath)) {
      const deleteRouteFolder = (folderPath: string) => {
        // Skip /api/routes/api/libname/trpc if tRPC is enabled
        if (options.trpc && folderPath.includes('/routes/api/') && folderPath.endsWith('/trpc')) {
          return;
        }

        // Skip /api/routes/api/libname if API is enabled (but still process subdirectories like trpc)
        const apiRoutePattern = `/api/routes/api/${moduleNames.fileName}`;
        if (options.api && folderPath === `${libSourceRoot}${apiRoutePattern}`) {
          // Only delete subdirectories, not the API directory itself
          if (tree.exists(folderPath)) {
            tree.children(folderPath).forEach(child => {
              const fullPath = `${folderPath}/${child}`;
              if (!tree.isFile(fullPath)) {
                // It's a directory, process it (like trpc subdirectory)
                deleteRouteFolder(fullPath);
              }
              // Don't delete files in the API directory (like hello.ts)
            });
          }
          return;
        }

        if (tree.exists(folderPath)) {
          tree.children(folderPath).forEach(file => {
            const fullPath = `${folderPath}/${file}`;
            if (tree.isFile(fullPath)) {
              tree.delete(fullPath);
            } else {
              // If it's not a file, it must be a directory
              deleteRouteFolder(fullPath);
            }
          });

          // If the directory is now empty, delete it too
          if (tree.children(folderPath).length === 0) {
            tree.delete(folderPath);
          }
        }
      };

      deleteRouteFolder(routesPath);
    }
  }

  const viteConfigPath = findViteConfigPath(tree, options.project);
  if (viteConfigPath) {
    logger.info(`Updating ${viteConfigPath}...`);
    const viteConfigContent = tree.read(viteConfigPath)?.toString('utf-8');
    if (viteConfigContent) {
      const updatedViteConfig = updateViteConfig(
        viteConfigContent,
        libSourceRoot,
        {
          addPages: options.pages,
          addApi: options.api || options.trpc,
        }
      );
      tree.write(viteConfigPath, updatedViteConfig);
    } else {
      logger.warn(`Could not read ${viteConfigPath}. Skipping update.`);
    }
  } else {
    logger.warn(
      `Could not find vite.config.* for project '${options.project}'. Please update it manually.`
    );
  }

  updateTsConfigBase(tree, options, libSourceRoot);

  await formatFiles(tree);
}

export default libraryGenerator;
