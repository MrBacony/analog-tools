import {
  addDependenciesToPackageJson,
  formatFiles,
  joinPathFragments,
  logger,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { InitAuthGeneratorSchema } from './schema';

function ensureNamedImport(
  content: string,
  moduleSpecifier: string,
  importName: string
): string {
  const importRegex = new RegExp(
    `import\\s*\\{([^}]*)\\}\\s*from\\s*['\"]${moduleSpecifier.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    )}['\"];?`
  );

  const match = content.match(importRegex);
  if (!match) {
    return content;
  }

  const existingImports = match[1]
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (existingImports.includes(importName)) {
    return content;
  }

  const updatedImports = [...existingImports, importName].join(', ');
  return content.replace(importRegex, `import { ${updatedImports} } from '${moduleSpecifier}';`);
}

function findFunctionCallBounds(
  content: string,
  functionName: string
): { argsStart: number; argsEnd: number } | null {
  const callRegex = new RegExp(`${functionName}\\s*\\(`);
  const match = callRegex.exec(content);

  if (!match) {
    return null;
  }

  const argsStart = match.index + match[0].length;
  let depth = 1;
  let inString = false;
  let stringChar = '';

  for (let index = argsStart; index < content.length; index++) {
    const char = content[index];
    const prevChar = index > 0 ? content[index - 1] : '';

    if ((char === '"' || char === '\'' || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
    }

    if (!inString) {
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
      }
    }

    if (depth === 0) {
      return {
        argsStart,
        argsEnd: index,
      };
    }
  }

  return null;
}

export function ensureAuthInterceptorFeature(content: string): string {
  const provideHttpClientBounds = findFunctionCallBounds(content, 'provideHttpClient');
  if (!provideHttpClientBounds) {
    logger.warn('provideHttpClient() not found in app.config.ts. Skipping interceptor update.');
    return content;
  }

  const { argsStart, argsEnd } = provideHttpClientBounds;
  const args = content.slice(argsStart, argsEnd);

  let updatedArgs = args;

  const withInterceptorsMatch = args.match(/withInterceptors\(\[([\s\S]*?)\]\)/);
  if (withInterceptorsMatch) {
    const interceptors = withInterceptorsMatch[1];

    if (!interceptors.includes('authInterceptor')) {
      const trimmedInterceptors = interceptors.trim();
      const updatedInterceptors = trimmedInterceptors
        ? `${trimmedInterceptors}, authInterceptor`
        : 'authInterceptor';

      updatedArgs = args.replace(
        /withInterceptors\(\[([\s\S]*?)\]\)/,
        `withInterceptors([${updatedInterceptors}])`
      );
    }
  } else {
    const trimmedArgs = args.trim();
    updatedArgs = trimmedArgs
      ? `${trimmedArgs}, withInterceptors([authInterceptor])`
      : 'withInterceptors([authInterceptor])';
  }

  if (updatedArgs === args) {
    return content;
  }

  return `${content.slice(0, argsStart)}${updatedArgs}${content.slice(argsEnd)}`;
}

/**
 * Gets the version of the generator package to use for installing dependencies
 */
function getGeneratorVersion(tree: Tree): string {
  try {
    const nodeModulesPath = 'node_modules/@analog-tools/generator/package.json';
    if (tree.exists(nodeModulesPath)) {
      const generatorPackageJson = readJson(tree, nodeModulesPath);
      if (generatorPackageJson.version) {
        return generatorPackageJson.version;
      }
    }
    
    const monorepoPath = 'packages/generator/package.json';
    if (tree.exists(monorepoPath)) {
      const generatorPackageJson = readJson(tree, monorepoPath);
      if (generatorPackageJson.version) {
        return generatorPackageJson.version;
      }
    }
    
    logger.warn('Could not determine generator version from package.json, using "latest"');
    return 'latest';
  } catch (e) {
    logger.warn('Could not read generator version, using "latest"');
    return 'latest';
  }
}

/**
 * Checks if required packages are installed and adds them if missing
 */
function ensureAuthPackages(tree: Tree) {
  const packageJsonPath = 'package.json';
  
  if (!tree.exists(packageJsonPath)) {
    logger.warn('package.json not found. Skipping package installation.');
    return null;
  }

  const packageJson = JSON.parse(tree.read(packageJsonPath)!.toString('utf-8'));
  
  // Check if we're in the analog-tools monorepo itself
  const isAnalogToolsRepo = packageJson.name === 'analog-tools' || 
                            packageJson.name === '@analog-tools/root';
  
  if (isAnalogToolsRepo) {
    logger.info('✓ Running in analog-tools workspace, packages available locally');
    return null;
  }

  const requiredPackages = [
    '@analog-tools/auth',
    '@analog-tools/inject',
    '@analog-tools/logger',
    '@analog-tools/session',
  ];

  const missingPackages: string[] = [];
  
  for (const pkg of requiredPackages) {
    const isInstalled = 
      (packageJson.dependencies && packageJson.dependencies[pkg]) ||
      (packageJson.devDependencies && packageJson.devDependencies[pkg]);
    
    if (!isInstalled) {
      missingPackages.push(pkg);
    }
  }

  if (missingPackages.length === 0) {
    logger.info('✓ All required auth packages are already installed');
    return null;
  }

  const version = getGeneratorVersion(tree);
  logger.info(`Installing missing packages (version ${version}): ${missingPackages.join(', ')}`);
  
  // Add packages with the same version as the generator
  const dependencies: Record<string, string> = {};
  missingPackages.forEach(pkg => {
    dependencies[pkg] = version;
  });

  return addDependenciesToPackageJson(tree, dependencies, {});
}

/**
 * Updates app.config.ts to add auth providers and interceptor
 */
function updateAppConfig(tree: Tree, appConfigPath: string): void {
  if (!tree.exists(appConfigPath)) {
    logger.warn(`app.config.ts not found at ${appConfigPath}. Skipping update.`);
    return;
  }

  let content = tree.read(appConfigPath)!.toString('utf-8');

  // Check if auth imports already exist
  const hasAuthImport = content.includes('@analog-tools/auth/angular');
  if (hasAuthImport) {
    logger.info('Auth imports already present in app.config.ts');
    return;
  }

  // Add auth imports
  const importRegex = /(import\s+{[^}]+}\s+from\s+['"][^'"]+['"];?\s*\n)+/;
  const lastImportMatch = content.match(importRegex);
  
  if (lastImportMatch) {
    const insertPosition = lastImportMatch.index! + lastImportMatch[0].length;
    const authImport = `import { authInterceptor, provideAuthClient } from '@analog-tools/auth/angular';\n`;
    content = content.slice(0, insertPosition) + authImport + content.slice(insertPosition);
  }

  content = ensureNamedImport(
    content,
    '@angular/common/http',
    'withInterceptors'
  );

  // Add provideAuthClient() to providers
  const providersMatch = content.match(/providers:\s*\[([\s\S]*?)\]/);
  if (providersMatch) {
    const providersContent = providersMatch[1];
    
    // Check if provideAuthClient is already there
    if (!providersContent.includes('provideAuthClient')) {
      // Find the last provider before the closing bracket
      const lastProviderRegex = /,\s*\n\s*(\w+\([^)]*\)|provide\w+\([^)]*\))\s*,?\s*$/;
      const updatedProviders = providersContent.replace(
        lastProviderRegex,
        `,\n    $1,\n    provideAuthClient(),`
      );
      
      // If no match, it might be an empty or simple providers array
      if (updatedProviders === providersContent) {
        content = content.replace(
          /providers:\s*\[/,
          'providers: [\n    provideAuthClient(),'
        );
      } else {
        content = content.replace(providersContent, updatedProviders);
      }
    }

    content = ensureAuthInterceptorFeature(content);
  }

  tree.write(appConfigPath, content);
  logger.info('✓ Updated app.config.ts with auth providers and interceptor');
}

/**
 * Updates vite.config.ts to add @analog-tools/auth to noExternal
 */
function updateViteConfig(tree: Tree, viteConfigPath: string): void {
  if (!tree.exists(viteConfigPath)) {
    logger.warn(`vite.config.ts not found at ${viteConfigPath}. Skipping update.`);
    return;
  }

  let content = tree.read(viteConfigPath)!.toString('utf-8');

  // Find ssr.noExternal array - handle both single-line and multi-line formats
  const noExternalRegex = /ssr:\s*{\s*noExternal:\s*\[([\s\S]*?)\]/;
  const match = content.match(noExternalRegex);
  
  // Check if @analog-tools/auth is already in noExternal array specifically
  if (match && (match[1].includes("'@analog-tools/auth'") || match[1].includes('"@analog-tools/auth"'))) {
    logger.info('@analog-tools/auth already in vite.config.ts noExternal');
    return;
  }

  if (match) {
    const noExternalContent = match[1];
    
    // Parse existing items, handling both string formats and whitespace
    const items = noExternalContent
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
    
    // Add the new item
    items.push("'@analog-tools/auth'");
    
    // Format as a single-line array if short, multi-line if long
    const itemsStr = items.join(', ');
    
    content = content.replace(
      noExternalRegex,
      `ssr: {\n      noExternal: [${itemsStr}]`
    );
  } else {
    // If ssr.noExternal doesn't exist, add it
    // Look for the ssr section or create it
    if (content.includes('ssr:')) {
      content = content.replace(
        /ssr:\s*{/,
        `ssr: {\n      noExternal: ['@analog-tools/auth'],`
      );
    } else {
      // Add ssr section before build section
      const buildMatch = content.match(/build:\s*{/);
      if (buildMatch) {
        const insertPos = buildMatch.index!;
        const ssrConfig = `\n    ssr: {\n      noExternal: ['@analog-tools/auth'],\n    },\n\n    `;
        content = content.slice(0, insertPos) + ssrConfig + content.slice(insertPos);
      }
    }
  }

  tree.write(viteConfigPath, content);
  logger.info('✓ Updated vite.config.ts with @analog-tools/auth in noExternal');
}

/**
 * Finds vite.config file in the project
 */
function findViteConfigPath(tree: Tree, projectRoot: string): string | null {
  const possiblePaths = [
    joinPathFragments(projectRoot, 'vite.config.ts'),
    joinPathFragments(projectRoot, 'vite.config.mts'),
    joinPathFragments(projectRoot, 'vite.config.js'),
    joinPathFragments(projectRoot, 'vite.config.mjs'),
  ];

  return possiblePaths.find(p => tree.exists(p)) || null;
}

export async function initAuthGenerator(
  tree: Tree,
  options: InitAuthGeneratorSchema
) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  const projectRoot = projectConfig.root;

  if (projectConfig.projectType !== 'application') {
    throw new Error(
      `Project "${options.project}" must be an application. Found "${projectConfig.projectType ?? 'unknown'}".`
    );
  }

  logger.info(`Initializing authentication for ${options.project}...`);

  // Step 0: Ensure required packages are installed
  const installTask = ensureAuthPackages(tree);

  // Step 1: Create auth.config.ts in src/
  const authConfigContent = `import { AnalogAuthConfig } from '@analog-tools/auth';

const sessionSecret = process.env['SESSION_SECRET'];

if (!sessionSecret) {
  throw new Error(
    'SESSION_SECRET environment variable is required for Analog auth session storage.'
  );
}

export const authConfig: AnalogAuthConfig = {
  issuer: process.env['AUTH_ISSUER'] || '',
  clientId: process.env['AUTH_CLIENT_ID'] || '',
  clientSecret: process.env['AUTH_CLIENT_SECRET'] || '',
  audience: process.env['AUTH_AUDIENCE'] || '',
  scope: process.env['AUTH_SCOPE'] || 'openid profile email',
  callbackUri: process.env['AUTH_CALLBACK_URL'] || '',
  unprotectedRoutes: [],

  sessionStorage: {
    sessionSecret,
    ttl: 86400, // 24 hours
    driver: {
      type: 'fs',
      options: {
        base: './.sessions',
      },
    },
  },
};
`;
  const authConfigPath = joinPathFragments(projectRoot, 'src/auth.config.ts');
  tree.write(authConfigPath, authConfigContent);
  logger.info('✓ Created auth.config.ts');

  // Step 2: Generate auth middleware in src/server/middleware/
  const middlewarePath = joinPathFragments(projectRoot, 'src/server/middleware');
  
  // Create auth middleware directly
  const authMiddlewareContent = `import { useAnalogAuth } from '@analog-tools/auth';
import { defineEventHandler, H3Event } from 'h3';
import { authConfig } from '../../auth.config';

/**
 * Authentication middleware for protected API routes
 * To be used with Analog.js middleware structure
 */
export default defineEventHandler(async (event: H3Event) => {
  return useAnalogAuth(authConfig, event);
});
`;
  
  const authMiddlewarePath = joinPathFragments(middlewarePath, 'auth.ts');
  tree.write(authMiddlewarePath, authMiddlewareContent);
  logger.info('✓ Created server middleware at src/server/middleware/auth.ts');

  // Step 3: Update app.config.ts
  const appConfigPath = joinPathFragments(projectRoot, 'src/app/app.config.ts');
  updateAppConfig(tree, appConfigPath);

  // Step 4: Update vite.config.ts
  const viteConfigPath = findViteConfigPath(tree, projectRoot);
  if (viteConfigPath) {
    updateViteConfig(tree, viteConfigPath);
  } else {
    logger.warn(
      `Could not find vite.config.* for project '${options.project}'. Please add '@analog-tools/auth' to ssr.noExternal manually.`
    );
  }

  await formatFiles(tree);

  logger.info('');
  logger.info('✓ Authentication initialization complete!');
  logger.info('');
  
  if (installTask) {
    logger.info('Installing packages...');
  }
  
  logger.info('Next steps:');
  logger.info('  1. Configure your authentication provider in auth.config.ts');
  logger.info('  2. Set up environment variables (AUTH_ISSUER, AUTH_CLIENT_ID, etc.)');
  logger.info("  3. Review the filesystem session storage path ('./.sessions') and SESSION_SECRET");
  logger.info('');
  
  return installTask;
}

export default initAuthGenerator;
