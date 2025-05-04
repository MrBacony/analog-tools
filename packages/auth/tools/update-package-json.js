#!/usr/bin/env node

/**
 * This script updates the main package.json file after copying the Angular build artifacts.
 * It reads the Angular package.json exports and merges them into the main package.json.
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

// Read package.json files
try {
  const mainPackage = JSON.parse(fs.readFileSync(mainPackagePath, 'utf8'));
  const angularPackage = JSON.parse(
    fs.readFileSync(angularPackagePath, 'utf8')
  );

  console.log('Reading package.json files...');

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

    // Save updated package.json
    fs.writeFileSync(
      mainPackagePath,
      JSON.stringify(mainPackage, null, 2),
      'utf8'
    );
    console.log('Successfully updated package.json with Angular exports!');

    // Print the updated exports for review
    console.log('Updated exports configuration:');
    console.log(JSON.stringify(mainPackage.exports, null, 2));
  } else {
    console.log('No exports found in Angular package.json.');
  }
} catch (error) {
  console.error('Error updating package.json:', error);
  process.exit(1);
}
