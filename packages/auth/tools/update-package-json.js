#!/usr/bin/env node

/**
 * This script updates the main package.json file after copying the Angular build artifacts.
 * It reads the Angular package.json exports and merges them into the main package.json,
 * and replaces `workspace:` dependency ranges with the concrete versions of the
 * sibling workspace packages, since the published manifest is consumed outside
 * this workspace.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packagesDir = path.resolve(__dirname, '../..');

/**
 * Map every workspace package name to the version in its source manifest.
 */
function readWorkspaceVersions() {
  const versions = new Map();

  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const manifestPath = path.join(packagesDir, entry.name, 'package.json');
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.name && manifest.version) {
      versions.set(manifest.name, manifest.version);
    }
  }

  return versions;
}

/**
 * Translate a single `workspace:` range into a publishable one.
 * `workspace:*` becomes the exact version, `workspace:^`/`workspace:~` keep
 * their range prefix, and an explicit range (`workspace:^1.2.3`) is passed
 * through with the protocol stripped.
 */
function resolveWorkspaceRange(range, version) {
  const specifier = range.slice('workspace:'.length);

  if (specifier === '*') return version;
  if (specifier === '^' || specifier === '~') return `${specifier}${version}`;
  return specifier;
}

/**
 * Replace all `workspace:` ranges in the manifest's dependency sections.
 * Throws when a workspace dependency cannot be resolved, so a broken manifest
 * fails the build instead of reaching npm.
 */
function resolveWorkspaceDependencies(manifest, versions) {
  for (const section of [
    'dependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    const deps = manifest[section];
    if (!deps) continue;

    for (const [name, range] of Object.entries(deps)) {
      if (typeof range !== 'string' || !range.startsWith('workspace:')) continue;

      const version = versions.get(name);
      if (!version) {
        throw new Error(
          `Cannot resolve "${range}" for ${section} entry "${name}": no workspace package with that name.`
        );
      }

      deps[name] = resolveWorkspaceRange(range, version);
      console.log(`Resolved ${section} "${name}": ${range} -> ${deps[name]}`);
    }
  }
}

// Paths to package.json files
const mainPackagePath = path.resolve(
  __dirname,
  '../../../node_modules/@analog-tools/auth/package.json'
);
const sourcePackagePath = path.resolve(
  __dirname,
  '../package.json'
);
const angularPackagePath = path.resolve(
  __dirname,
  '../../../node_modules/@analog-tools/auth/angular/package.json'
);

// Read package.json files
try {
  if (!fs.existsSync(mainPackagePath)) {
    console.warn(
      'Main package.json missing in build output. Copying from packages/auth/package.json...'
    );
    fs.mkdirSync(path.dirname(mainPackagePath), { recursive: true });
    fs.copyFileSync(sourcePackagePath, mainPackagePath);
  }

  const mainPackage = JSON.parse(fs.readFileSync(mainPackagePath, 'utf8'));
  const angularPackage = JSON.parse(
    fs.readFileSync(angularPackagePath, 'utf8')
  );

  console.log('Reading package.json files...');

  // The copied manifest still carries the workspace-only dependency protocol.
  // `pnpm publish` runs from node_modules/@analog-tools/auth, which is not a
  // workspace project, so it cannot resolve those ranges itself.
  resolveWorkspaceDependencies(mainPackage, readWorkspaceVersions());

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
