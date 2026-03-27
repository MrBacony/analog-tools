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
import { patchTailwindImport } from './utils/tailwind';

export async function libraryGenerator(
  tree: Tree,
  options: LibraryGeneratorSchema
) {
  const normalizedOptions: LibraryGeneratorSchema = {
    ...options,
    trpc: options.trpc === true,
    api: options.api === true,
    skipExamples: options.skipExamples === true,
    pages: options.pages === true,
    contentRoutes: options.contentRoutes === true,
    componentPrefix: options.componentPrefix || 'lib',
    patchTailwind: options.patchTailwind !== false,
  };

  const projectRoot = `libs/${normalizedOptions.name}`;
  const libSourceRoot = `${projectRoot}/src`;
  const moduleBaseName =
    normalizedOptions.name.split('/').pop() || normalizedOptions.name;
  const moduleNames = names(moduleBaseName);

  addProjectConfiguration(tree, normalizedOptions.name, {
    root: projectRoot,
    projectType: 'library',
    sourceRoot: libSourceRoot,
    targets: {
      test: {
        executor: '@nx/vite:test',
        outputs: ['{options.reportsDirectory}'],
        options: {
          reportsDirectory: `../../coverage/libs/${normalizedOptions.name}`,
        },
      },
      lint: {
        executor: '@nx/eslint:lint',
      },
    },
  });

  const templateOptions = {
    ...normalizedOptions,
    ...moduleNames,
    tmpl: '',
  };

  // Generate base configuration files (always generated)
  generateFiles(
    tree,
    path.join(__dirname, 'files', 'base-configs'),
    projectRoot,
    templateOptions
  );

  // Generate base source files (index.ts, test-setup.ts - always generated)
  generateFiles(
    tree,
    path.join(__dirname, 'files', 'base'),
    projectRoot,
    templateOptions
  );

  // Create standard lib folder structure with .gitkeep files
  const libPath = path.join(projectRoot, 'src/lib');
  tree.write(path.join(libPath, 'components/.gitkeep'), '');
  // Only add .gitkeep for pages folder if pages are not generated
  if (!normalizedOptions.pages) {
    tree.write(path.join(libPath, 'pages/.gitkeep'), '');
  }
  tree.write(path.join(libPath, 'services/.gitkeep'), '');
  
  // Create models folder in src/ (only .gitkeep if no schema will be generated)
  if (!(normalizedOptions.api && !normalizedOptions.skipExamples)) {
    tree.write(path.join(projectRoot, 'src/models/.gitkeep'), '');
  }

  // Conditionally generate pages
  if (normalizedOptions.pages) {
    generateFiles(
      tree,
      path.join(__dirname, 'files', 'pages'),
      projectRoot,
      templateOptions
    );
  }

  // Conditionally generate content
  if (normalizedOptions.contentRoutes) {
    generateFiles(
      tree,
      path.join(__dirname, 'files', 'content'),
      projectRoot,
      templateOptions
    );
  }

  // Conditionally generate backend (api OR trpc)
  if (normalizedOptions.api || normalizedOptions.trpc) {
    generateFiles(
      tree,
      path.join(__dirname, 'files', 'backend'),
      projectRoot,
      templateOptions
    );
  }

  // Conditionally generate API example route (only when api is enabled and skipExamples is false)
  if (normalizedOptions.api && !normalizedOptions.skipExamples) {
    generateFiles(
      tree,
      path.join(__dirname, 'files', 'api-example'),
      projectRoot,
      templateOptions
    );
  }

  // Conditionally generate tRPC infrastructure
  if (normalizedOptions.trpc) {
    generateFiles(
      tree,
      path.join(__dirname, 'files', 'trpc-infrastructure'),
      projectRoot,
      templateOptions
    );
  }

  // Conditionally generate tRPC routes handler
  if (normalizedOptions.trpc) {
    generateFiles(
      tree,
      path.join(__dirname, 'files', 'trpc-routes'),
      projectRoot,
      templateOptions
    );
  }

  // Handle skipExamples by removing example files and adding .gitkeep
  if (normalizedOptions.skipExamples) {
    // Remove pages examples if pages were generated
    if (normalizedOptions.pages) {
      const pagesExamples = [
        `${libSourceRoot}/pages/${moduleNames.fileName}/${moduleNames.fileName}.page.ts`,
        `${libSourceRoot}/pages/${moduleNames.fileName}/(${moduleNames.fileName}).page.ts`,
      ];
      pagesExamples.forEach(file => tree.exists(file) && tree.delete(file));
      tree.write(`${libSourceRoot}/pages/${moduleNames.fileName}/.gitkeep`, '');
    }

    // Remove content examples if content was generated
    if (normalizedOptions.contentRoutes) {
      const contentExample = `${libSourceRoot}/content/${moduleNames.fileName}/example-post.md`;
      tree.exists(contentExample) && tree.delete(contentExample);
      tree.write(`${libSourceRoot}/content/${moduleNames.fileName}/.gitkeep`, '');
    }

    // Add .gitkeep for API directory if api was generated (example was not generated due to skipExamples)
    if (normalizedOptions.api) {
      tree.write(`${libSourceRoot}/backend/api/routes/api/${moduleNames.fileName}/.gitkeep`, '');
    }
  }

  const viteConfigPath = findViteConfigPath(tree, normalizedOptions.project);
  if (viteConfigPath) {
    logger.info(`Updating ${viteConfigPath}...`);
    const viteConfigContent = tree.read(viteConfigPath)?.toString('utf-8');
    if (viteConfigContent) {
      const updatedViteConfig = updateViteConfig(
        viteConfigContent,
        libSourceRoot,
        {
          // Add pages only if explicitly enabled
          addPages: normalizedOptions.pages === true,
          // Add API if either api or trpc is enabled
          addApi:
            normalizedOptions.api === true || normalizedOptions.trpc === true,
        }
      );
      tree.write(viteConfigPath, updatedViteConfig);
    } else {
      logger.warn(`Could not read ${viteConfigPath}. Skipping update.`);
    }
  } else {
    logger.warn(
      `Could not find vite.config.* for project '${normalizedOptions.project}'. Please update it manually.`
    );
  }

  updateTsConfigBase(tree, normalizedOptions, libSourceRoot);

  // Patch Tailwind CSS import if enabled
  if (normalizedOptions.patchTailwind) {
    patchTailwindImport(tree, normalizedOptions.project);
  }

  await formatFiles(tree);
}

export default libraryGenerator;
