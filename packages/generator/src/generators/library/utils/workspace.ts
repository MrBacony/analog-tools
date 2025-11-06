import { Tree, logger, readNxJson, readJson } from '@nx/devkit';

/**
 * Determines the workspace scope (@scope).
 * Tries nx.json's npmScope first, then falls back to parsing package.json names from packages directory.
 */
export function getWorkspaceScope(tree: Tree): string | null {
  try {
    const nxJson = readNxJson(tree);
    // Use type assertion if we are confident it exists, or check dynamically
    const scopeFromNx = (nxJson as any)?.npmScope;
    if (typeof scopeFromNx === 'string') {
      return scopeFromNx;
    }
  } catch (e) {
    logger.warn('Could not read nx.json or find npmScope, trying package.json');
  }

  // Try to find any package with a scope in the packages directory
  try {
    const packageDirs = ['packages', 'libs'];
    for (const dir of packageDirs) {
      if (tree.exists(dir)) {
        const dirChildren = tree.children(dir);
        for (const child of dirChildren) {
          const packageJsonPath = `${dir}/${child}/package.json`;
          if (tree.exists(packageJsonPath)) {
            try {
              const packageJson = readJson(tree, packageJsonPath);
              const name = packageJson.name;
              if (
                typeof name === 'string' &&
                name.startsWith('@') &&
                name.includes('/')
              ) {
                const scope = name.substring(0, name.indexOf('/'));
                logger.info(`Determined workspace scope from ${packageJsonPath}: ${scope}`);
                return scope;
              }
            } catch (e) {
              // Continue to next package
            }
          }
        }
      }
    }
  } catch (e) {
    logger.warn('Could not scan packages directory for scope.');
  }

  // Fallback: try root package.json
  try {
    if (tree.exists('package.json')) {
      const packageJson = readJson(tree, 'package.json');
      const name = packageJson.name;
      if (
        typeof name === 'string' &&
        name.startsWith('@') &&
        name.includes('/')
      ) {
        return name.substring(0, name.indexOf('/'));
      }
    }
  } catch (e) {
    logger.warn('Could not read root package.json or extract scope from its name.');
  }

  logger.warn(
    `Could not determine workspace scope. Skipping path mapping update.`
  );
  return null;
}
