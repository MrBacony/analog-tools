import { Tree, logger, readProjectConfiguration } from '@nx/devkit';
import * as path from 'path';

/**
 * Finds the vite.config.* file path for a given project.
 * Checks the project root first, then common locations.
 */
export function findViteConfigPath(
  tree: Tree,
  projectName: string
): string | null {
  const possiblePaths = [
    // Add common variations first
    `apps/${projectName}/vite.config.ts`,
    `apps/${projectName}/vite.config.js`,
    `apps/${projectName}/vite.config.mts`,
    `apps/${projectName}/vite.config.mjs`,
    `${projectName}/vite.config.ts`,
    `${projectName}/vite.config.js`,
    `${projectName}/vite.config.mts`,
    `${projectName}/vite.config.mjs`,
    // Add root variations later as fallback
    `vite.config.ts`,
    `vite.config.js`,
    `vite.config.mts`,
    `vite.config.mjs`,
  ];

  try {
    const projectConfig = readProjectConfiguration(tree, projectName);
    if (projectConfig.root) {
      const projectRootPaths = [
        path.join(projectConfig.root, 'vite.config.ts'),
        path.join(projectConfig.root, 'vite.config.js'),
        path.join(projectConfig.root, 'vite.config.mts'),
        path.join(projectConfig.root, 'vite.config.mjs'),
      ];
      // Prioritize project root paths
      possiblePaths.unshift(...projectRootPaths);
    }
  } catch (e) {
    logger.warn(
      `Could not read project configuration for '${projectName}'. Relying on standard path checks.`
    );
  }

  for (const p of possiblePaths) {
    if (tree.exists(p)) {
      return p;
    }
  }
  return null;
}

/**
 * Updates the vite.config.* file content to add library paths
 * to Analog plugin options.
 */
export function updateViteConfig(
  content: string,
  libSrcRoot: string,
  options: { addPages?: boolean; addApi?: boolean } = {}
): string {
  let updatedContent = content;

  // Default to adding both if not specified
  const shouldAddPages = options.addPages !== false;
  const shouldAddApi = options.addApi !== false;

  // Ensure paths use forward slashes and don't start with /
  const pagesDir = path.join(libSrcRoot, 'pages').replace(/\\/g, '/');
  const pagesDirFormatted = `'${pagesDir}'`;

  const apiDir = path.join(libSrcRoot, 'backend', 'api').replace(/\\/g, '/');
  const apiDirFormatted = `'${apiDir}'`;

  // Find the analog() call and its content
  const analogCallRegex = /analog\s*\(/;
  const analogMatch = analogCallRegex.exec(updatedContent);

  if (!analogMatch) {
    logger.warn('Could not find analog() call in vite config');
    return updatedContent;
  }

  const startPos = analogMatch.index + analogMatch[0].length;

  // Find the matching closing parenthesis
  let depth = 1;
  let endPos = startPos;
  let inString = false;
  let stringChar = '';

  for (let i = startPos; i < updatedContent.length && depth > 0; i++) {
    const char = updatedContent[i];
    const prevChar = i > 0 ? updatedContent[i - 1] : '';

    // Handle string literals
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
    }

    if (!inString) {
      if (char === '(') depth++;
      if (char === ')') depth--;
    }

    if (depth === 0) {
      endPos = i;
      break;
    }
  }

  if (depth !== 0) {
    logger.warn('Could not find matching closing parenthesis for analog() call');
    return updatedContent;
  }

  const analogContent = updatedContent.substring(startPos, endPos).trim();

  // Check if it's analog() with no arguments or analog({}) or only comments/whitespace
  const contentWithoutCommentsAndWhitespace = analogContent
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .replace(/\s+/g, ''); // Remove all whitespace
  
  const isEmpty = contentWithoutCommentsAndWhitespace === '' || contentWithoutCommentsAndWhitespace === '{}';

  let newAnalogContent = analogContent;

  if (isEmpty) {
    // Start fresh with new options
    const newOptions: string[] = [];
    if (shouldAddPages) {
      newOptions.push(`additionalPagesDirs: [${pagesDirFormatted}]`);
    }
    if (shouldAddApi) {
      newOptions.push(`additionalAPIDirs: [${apiDirFormatted}]`);
    }
    newAnalogContent = newOptions.length > 0
      ? `{\n        ${newOptions.join(',\n        ')}\n      }`
      : '{}';
  } else {
    // analog() has existing content
    // Remove outer braces if present
    let innerContent = analogContent;
    if (analogContent.startsWith('{') && analogContent.endsWith('}')) {
      innerContent = analogContent.substring(1, analogContent.length - 1);
    }

    // Check if additionalPagesDirs or additionalAPIDirs already exist
    const hasPagesDir = /additionalPagesDirs\s*:/.test(innerContent);
    const hasApiDir = /additionalAPIDirs\s*:/.test(innerContent);

    if (shouldAddPages && hasPagesDir) {
      // Add to existing additionalPagesDirs array
      newAnalogContent = analogContent.replace(
        /additionalPagesDirs:\s*\[([^\]]*)\]/,
        (match, dirs) => {
          const existingDirs = dirs.trim().length > 0 ? dirs.trim() + ', ' : '';
          return `additionalPagesDirs: [${existingDirs}${pagesDirFormatted}]`;
        }
      );
    } else if (shouldAddPages && !hasPagesDir) {
      // Add new additionalPagesDirs at the end
      const trimmedInner = innerContent.trim();
      const needsComma = trimmedInner.length > 0 && !trimmedInner.endsWith(',');
      newAnalogContent = `{\n${innerContent}${needsComma ? ',' : ''}\n        additionalPagesDirs: [${pagesDirFormatted}]\n      }`;
    }

    // Re-get the content after pages update
    innerContent = newAnalogContent.startsWith('{') && newAnalogContent.endsWith('}')
      ? newAnalogContent.substring(1, newAnalogContent.length - 1)
      : newAnalogContent;

    if (shouldAddApi && hasApiDir) {
      // Add to existing additionalAPIDirs array
      newAnalogContent = newAnalogContent.replace(
        /additionalAPIDirs:\s*\[([^\]]*)\]/,
        (match, dirs) => {
          const existingDirs = dirs.trim().length > 0 ? dirs.trim() + ', ' : '';
          return `additionalAPIDirs: [${existingDirs}${apiDirFormatted}]`;
        }
      );
    } else if (shouldAddApi && !hasApiDir) {
      // Add new additionalAPIDirs
      const trimmedInner = innerContent.trim();
      const needsComma = trimmedInner.length > 0 && !trimmedInner.endsWith(',');
      newAnalogContent = newAnalogContent.startsWith('{')
        ? newAnalogContent.replace(/\}\s*$/, `${needsComma ? ',' : ''}\n        additionalAPIDirs: [${apiDirFormatted}]\n      }`)
        : `{\n${innerContent}${needsComma ? ',' : ''}\n        additionalAPIDirs: [${apiDirFormatted}]\n      }`;
    }
  }

  // Replace the analog() call content
  const before = updatedContent.substring(0, startPos);
  const after = updatedContent.substring(endPos);
  updatedContent = `${before}${newAnalogContent}${after}`;

  return updatedContent;
}
