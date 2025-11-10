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

  // Normalize options to explicit booleans
  options.trpc = options.trpc === true;
  options.api = options.api === true;
  options.skipExamples = options.skipExamples === true;
  options.pages = options.pages === true;
  options.contentRoutes = options.contentRoutes === true;

  const templateOptions = {
    ...options,
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
  if (!options.pages) {
    tree.write(path.join(libPath, 'pages/.gitkeep'), '');
  }
  tree.write(path.join(libPath, 'services/.gitkeep'), '');
  
  // Create models folder in src/ (only .gitkeep if no schema will be generated)
  if (!(options.api && !options.skipExamples)) {
    tree.write(path.join(projectRoot, 'src/models/.gitkeep'), '');
  }

  // Conditionally generate pages
  if (options.pages) {
    generateFiles(
      tree,
      path.join(__dirname, 'files', 'pages'),
      projectRoot,
      templateOptions
    );
  }

  // Conditionally generate content
  if (options.contentRoutes) {
    generateFiles(
      tree,
      path.join(__dirname, 'files', 'content'),
      projectRoot,
      templateOptions
    );
  }

  // Conditionally generate backend (api OR trpc)
  if (options.api || options.trpc) {
    generateFiles(
      tree,
      path.join(__dirname, 'files', 'backend'),
      projectRoot,
      templateOptions
    );
  }

  // Conditionally generate API example route (only when api is enabled and skipExamples is false)
  if (options.api && !options.skipExamples) {
    generateFiles(
      tree,
      path.join(__dirname, 'files', 'api-example'),
      projectRoot,
      templateOptions
    );
  }

  // Conditionally generate tRPC infrastructure
  if (options.trpc) {
    generateFiles(
      tree,
      path.join(__dirname, 'files', 'trpc-infrastructure'),
      projectRoot,
      templateOptions
    );
  }

  // Conditionally generate tRPC routes handler
  if (options.trpc) {
    generateFiles(
      tree,
      path.join(__dirname, 'files', 'trpc-routes'),
      projectRoot,
      templateOptions
    );
  }

  // Handle skipExamples by removing example files and adding .gitkeep
  if (options.skipExamples) {
    // Remove lib examples
    const libExamples = [
      `${libSourceRoot}/lib/${moduleNames.fileName}/${moduleNames.fileName}.component.ts`,
      `${libSourceRoot}/lib/${moduleNames.fileName}/${moduleNames.fileName}.component.spec.ts`,
      `${libSourceRoot}/lib/${moduleNames.fileName}/${moduleNames.fileName}.model.ts`,
    ];
    libExamples.forEach(file => tree.exists(file) && tree.delete(file));
    tree.write(`${libSourceRoot}/lib/${moduleNames.fileName}/.gitkeep`, '');

    // Remove pages examples if pages were generated
    if (options.pages) {
      const pagesExamples = [
        `${libSourceRoot}/pages/${moduleNames.fileName}/${moduleNames.fileName}.page.ts`,
        `${libSourceRoot}/pages/${moduleNames.fileName}/(${moduleNames.fileName}).page.ts`,
      ];
      pagesExamples.forEach(file => tree.exists(file) && tree.delete(file));
      tree.write(`${libSourceRoot}/pages/${moduleNames.fileName}/.gitkeep`, '');
    }

    // Remove content examples if content was generated
    if (options.contentRoutes) {
      const contentExample = `${libSourceRoot}/content/${moduleNames.fileName}/example-post.md`;
      tree.exists(contentExample) && tree.delete(contentExample);
      tree.write(`${libSourceRoot}/content/${moduleNames.fileName}/.gitkeep`, '');
    }

    // Add .gitkeep for API directory if api was generated (example was not generated due to skipExamples)
    if (options.api) {
      tree.write(`${libSourceRoot}/backend/api/routes/api/${moduleNames.fileName}/.gitkeep`, '');
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
          // Add pages only if explicitly enabled
          addPages: options.pages === true,
          // Add API if either api or trpc is enabled
          addApi: options.api === true || options.trpc === true,
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
