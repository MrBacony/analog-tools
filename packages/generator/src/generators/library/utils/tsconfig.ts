import { Tree, logger, updateJson, joinPathFragments } from '@nx/devkit';
import { LibraryGeneratorSchema } from '../schema'; 
import { getWorkspaceScope } from './workspace';

/**
 * Updates the root tsconfig.base.json to add path mapping
 * for the newly generated library.
 */
export function updateTsConfigBase(
  tree: Tree,
  options: LibraryGeneratorSchema,
  libSourceRoot: string
) {
  const tsConfigBasePath = 'tsconfig.base.json';

  if (!tree.exists(tsConfigBasePath)) {
    logger.warn(
      `Could not find ${tsConfigBasePath}. Skipping path mapping update.`
    );
    return;
  }

  const npmScope = getWorkspaceScope(tree);
  if (!npmScope) {
    return; 
  }

  // Construct the paths
  // Main library import path: @scope/libname
  const importPath = `${npmScope}/${options.name}`;
  const relativeLibIndexPath = joinPathFragments(libSourceRoot, 'index.ts');

  // Backend import path: @scope/libname/backend
  const backendImportPath = `${npmScope}/${options.name}/backend`;
  const relativeBackendIndexPath = joinPathFragments(libSourceRoot, 'backend/index.ts');

  try {
    updateJson(tree, tsConfigBasePath, (tsConfigJson) => {
      // Ensure compilerOptions and paths exist
      tsConfigJson.compilerOptions = tsConfigJson.compilerOptions ?? {};
      const paths = tsConfigJson.compilerOptions.paths ?? {};

      // Add the main library path mapping
      paths[importPath] = [relativeLibIndexPath];

      // Add the backend path mapping if api or trpc is enabled
      if (options.api || options.trpc) {
        paths[backendImportPath] = [relativeBackendIndexPath];
      }

      // Sort paths for consistency (optional but nice)
      const sortedPaths = Object.keys(paths)
        .sort()
        .reduce((obj, key) => {
          obj[key] = paths[key];
          return obj;
        }, {} as Record<string, string[]>);

      tsConfigJson.compilerOptions.paths = sortedPaths;

      logger.info(
        `Updated ${tsConfigBasePath} with path mapping for ${importPath}`
      );
      if (options.api || options.trpc) {
        logger.info(
          `Updated ${tsConfigBasePath} with path mapping for ${backendImportPath}`
        );
      }
      return tsConfigJson;
    });
  } catch (error) {
    logger.error(
      `Failed to update ${tsConfigBasePath}: ${
        error instanceof Error ? error.message : error
      }`
    );
  }
}
