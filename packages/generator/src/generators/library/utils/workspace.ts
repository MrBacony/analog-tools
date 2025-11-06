import { Tree, logger, readNxJson, readJson } from '@nx/devkit';

/**
 * Determines the workspace scope (@scope).
 * Tries nx.json's npmScope first, then falls back to parsing the root package.json name.
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
    logger.warn('Could not read package.json or extract scope from its name.');
  }

  logger.warn(
    `Could not determine workspace scope. Skipping path mapping update.`
  );
  return null;
}
