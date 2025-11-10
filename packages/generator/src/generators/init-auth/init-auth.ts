import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  logger,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import * as path from 'path';
import { InitAuthGeneratorSchema } from './schema';

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

    // Add authInterceptor to withInterceptors
    const interceptorsMatch = content.match(/withInterceptors\(\[([^\]]*)\]\)/);
    if (interceptorsMatch) {
      const interceptorsContent = interceptorsMatch[1];
      if (!interceptorsContent.includes('authInterceptor')) {
        const updatedInterceptors = interceptorsContent.trim()
          ? `${interceptorsContent.trim()}, authInterceptor`
          : 'authInterceptor';
        content = content.replace(
          /withInterceptors\(\[([^\]]*)\]\)/,
          `withInterceptors([${updatedInterceptors}])`
        );
      }
    } else {
      // If withInterceptors doesn't exist, we need to add it
      const httpClientMatch = content.match(/provideHttpClient\(([\s\S]*?)\)/);
      if (httpClientMatch) {
        const httpClientContent = httpClientMatch[1];
        if (httpClientContent.includes('withFetch()')) {
          content = content.replace(
            /provideHttpClient\(([\s\S]*?)\)/,
            `provideHttpClient(\n      withFetch(),\n      withInterceptors([authInterceptor])\n    )`
          );
          // Add withInterceptors import if not present
          if (!content.includes('withInterceptors')) {
            content = content.replace(
              /from\s+['"]@angular\/common\/http['"]/,
              `from '@angular/common/http'`
            );
            content = content.replace(
              /import\s+{([^}]+)}\s+from\s+['"]@angular\/common\/http['"]/,
              (match, imports) => {
                if (!imports.includes('withInterceptors')) {
                  return match.replace('}', ', withInterceptors}');
                }
                return match;
              }
            );
          }
        }
      }
    }
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

  // Step 1: Create auth.config.ts in src/
  const authConfigContent = `import { AnalogAuthConfig } from '@analog-tools/auth';

export const authConfig: AnalogAuthConfig = {
  issuer: process.env['AUTH_ISSUER'] || '',
  clientId: process.env['AUTH_CLIENT_ID'] || '',
  clientSecret: process.env['AUTH_CLIENT_SECRET'] || '',
  audience: process.env['AUTH_AUDIENCE'] || '',
  scope: process.env['AUTH_SCOPE'] || 'openid profile email',
  callbackUri: process.env['AUTH_CALLBACK_URL'] || '',
  unprotectedRoutes: [],

  sessionStorage: {
    type: 'redis',
    config: {
      url: process.env['REDIS_URL'] || 'redis://localhost:6379',
      sessionSecret: process.env['SESSION_SECRET'] || 'default-dev-secret',
      ttl: 86400, // 24 hours
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
  logger.info('Next steps:');
  logger.info('  1. Configure your authentication provider in auth.config.ts');
  logger.info('  2. Set up environment variables (AUTH_ISSUER, AUTH_CLIENT_ID, etc.)');
  logger.info('  3. Configure Redis connection (REDIS_URL, SESSION_SECRET)');
  logger.info('');
}

export default initAuthGenerator;
