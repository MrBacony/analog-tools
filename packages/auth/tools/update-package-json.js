#!/usr/bin/env node

/**
 * Merges the Angular build's exports into the auth package's published manifest.
 *
 * Runs after tools/scripts/prepare-package-manifest.js has written
 * node_modules/@analog-tools/auth/package.json (copying the source manifest and
 * resolving `workspace:` ranges) and after the auth-angular output has been
 * copied into the angular/ subdirectory.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to package.json files
const mainPackagePath = path.resolve(
  __dirname,
  '../../../node_modules/@analog-tools/auth/package.json'
);
const angularPackagePath = path.resolve(
  __dirname,
  '../../../node_modules/@analog-tools/auth/angular/package.json'
);

/**
 * The published manifest must not carry the workspace-only dependency protocol:
 * npm cannot install it. prepare-package-manifest.js resolves those ranges, so
 * anything left here means the build steps ran out of order.
 */
function assertNoWorkspaceRanges(manifest) {
  for (const section of [
    'dependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    for (const [name, range] of Object.entries(manifest[section] ?? {})) {
      if (typeof range === 'string' && range.startsWith('workspace:')) {
        throw new Error(
          `Unresolved "${range}" for ${section} entry "${name}" in the build output. ` +
            'Run tools/scripts/prepare-package-manifest.js auth before this script.'
        );
      }
    }
  }
}

// Read package.json files
try {
  if (!fs.existsSync(mainPackagePath)) {
    throw new Error(
      'No package.json in the auth build output. ' +
        'Run tools/scripts/prepare-package-manifest.js auth first.'
    );
  }

  const mainPackage = JSON.parse(fs.readFileSync(mainPackagePath, 'utf8'));
  const angularPackage = JSON.parse(
    fs.readFileSync(angularPackagePath, 'utf8')
  );

  console.log('Reading package.json files...');

  assertNoWorkspaceRanges(mainPackage);

  // If angular package has exports, merge them into the main package exports
  if (angularPackage.exports) {
    console.log('Found Angular exports. Merging into main package.json...');

    // Initialize exports object if it doesn't exist
    mainPackage.exports = mainPackage.exports || {};

    // Add angular specific exports with correct paths pointing to the angular directory
    const angularExport = angularPackage.exports['.'];

    // Update paths to point to the angular directory
    if (typeof angularExport === 'object') {
      const modifiedAngularExport = {};

      // Process each export format (types, default, etc.)
      for (const [key, value] of Object.entries(angularExport)) {
        // If it's a path string, prefix with 'angular/'
        if (typeof value === 'string' && !value.startsWith('./angular/')) {
          // Remove leading './' if present, then add './angular/'
          const normalizedPath = value.startsWith('./')
            ? value.substring(2)
            : value;
          modifiedAngularExport[key] = `./angular/${normalizedPath}`;
        } else {
          modifiedAngularExport[key] = value;
        }
      }

      mainPackage.exports['./angular'] = modifiedAngularExport;
    } else if (typeof angularExport === 'string') {
      // Handle case where export is a simple string
      const normalizedPath = angularExport.startsWith('./')
        ? angularExport.substring(2)
        : angularExport;
      mainPackage.exports['./angular'] = `./angular/${normalizedPath}`;
    } else {
      // Just use as-is if format is unexpected
      mainPackage.exports['./angular'] = angularExport;
    }

    console.log('Merged Angular exports into package.json.');

    // Print the updated exports for review
    console.log('Updated exports configuration:');
    console.log(JSON.stringify(mainPackage.exports, null, 2));
  } else {
    console.log('No exports found in Angular package.json.');
  }

  // Save updated package.json
  fs.writeFileSync(
    mainPackagePath,
    JSON.stringify(mainPackage, null, 2),
    'utf8'
  );
  console.log('Successfully updated package.json!');
} catch (error) {
  console.error('Error updating package.json:', error);
  process.exit(1);
}
