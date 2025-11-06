import { Tree, logger, updateJson, joinPathFragments } from '@nx/devkit';
import { LibraryGeneratorSchema } from '../schema'; // Adjust import path
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
    return; // Warning already logged by getWorkspaceScope
  }

  // Construct the paths
  // Ensure options.name is treated as the full logical name for the path
  const importPath = `${npmScope}/${options.name}`;
  // Nx usually expects paths relative to the workspace root in tsconfig.base.json
  const relativeLibIndexPath = joinPathFragments(libSourceRoot, 'index.ts');

  try {
    updateJson(tree, tsConfigBasePath, (tsConfigJson) => {
      // Ensure compilerOptions and paths exist
      tsConfigJson.compilerOptions = tsConfigJson.compilerOptions ?? {};
      const paths = tsConfigJson.compilerOptions.paths ?? {};

      // Add the new path mapping
      paths[importPath] = [relativeLibIndexPath];

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
